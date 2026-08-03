import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { Corpus, parseCorpus } from '../../src/core/corpus.js';
import {
  buildDigraphWeights,
  scoreText,
  densityScore,
  selectTargetedQuote,
  QuoteRotation,
  RecentQuotes,
} from '../../src/core/selector.js';
import { findSlowSections, digraphsFromSections, mergeTargets } from '../../src/core/slow-sections.js';
import { SessionFlow, PHASE_QUOTE, PHASE_TARGETED } from '../../src/core/session-flow.js';

const GROUPS = [
  { name: 'short', min: 0, max: 100 },
  { name: 'medium', min: 101, max: 300 },
];

/**
 * @param {Array<[string, number]>} entries text and group index
 */
function makeCorpus(entries) {
  return new Corpus({
    groups: GROUPS,
    quotes: entries.map(([text, group], i) => ({
      id: i,
      text,
      source: `source-${i}`,
      length: text.length,
      group: group ?? 0,
    })),
  });
}

/** Deterministic RNG so shortlist picks are reproducible. */
function seededRng(seed = 1) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('corpus validation', () => {
  test('rejects a non-object payload with a structured failure', () => {
    const result = parseCorpus('not a corpus');
    assert.equal(result.ok, false);
    assert.equal(result.error.component, 'corpus.parse');
    assert.equal(result.error.failureType, 'validation');
  });

  test('rejects an empty quote list rather than serving nothing', () => {
    const result = parseCorpus({ quotes: [], groups: [] });
    assert.equal(result.ok, false);
    assert.match(result.error.rootCause, /zero quotes/);
  });

  test('rejects entries missing required fields', () => {
    const result = parseCorpus({ quotes: [{ text: 'hi' }], groups: [] });
    assert.equal(result.ok, false);
    assert.match(result.error.rootCause, /missing required/);
  });

  test('accepts a well-formed payload', () => {
    const result = parseCorpus({
      groups: GROUPS,
      quotes: [{ id: 0, text: 'hello there', source: 's', length: 11, group: 0 }],
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.size, 1);
  });

  test('caches lower-cased text per quote', () => {
    const corpus = makeCorpus([['Hello World', 0]]);
    const quote = corpus.quotes[0];
    assert.equal(corpus.lowerText(quote), 'hello world');
    assert.equal(corpus.lowerText(quote), 'hello world');
    assert.equal(corpus._lowerCache.size, 1);
  });

  test('falls back to the full corpus when a group filter matches nothing', () => {
    const corpus = makeCorpus([['short one', 0]]);
    assert.equal(corpus.filterByGroups([1]).length, 1);
  });
});

describe('digraph weighting', () => {
  test('weights transitions by how far above baseline they sit', () => {
    const weights = buildDigraphWeights([{ digraph: 'th', mean: 150 }], 100);
    assert.equal(weights.get('th'), 0.5);
  });

  test('applies a floor so listed transitions are never weightless', () => {
    const weights = buildDigraphWeights([{ digraph: 'er', mean: 90 }], 100);
    assert.equal(weights.get('er'), 0.1);
  });

  test('ignores malformed entries', () => {
    const weights = buildDigraphWeights([{ digraph: 'toolong', mean: 200 }, null, { mean: 200 }], 100);
    assert.equal(weights.size, 0);
  });

  test('accepts bare strings for on-demand drilling', () => {
    const weights = buildDigraphWeights(['th'], 100);
    assert.equal(weights.size, 1);
  });
});

describe('text scoring', () => {
  test('counts every occurrence of each target', () => {
    const weights = new Map([['th', 1]]);
    const { weightedHits, hits } = scoreText('the theme therein', weights);
    assert.equal(hits.get('th'), 3);
    assert.equal(weightedHits, 3);
  });

  test('weights heavier targets more', () => {
    const weights = new Map([
      ['th', 2],
      ['er', 0.5],
    ]);
    const { weightedHits } = scoreText('there', weights);
    assert.equal(weightedHits, 2.5);
  });

  test('returns zero for an empty weight map', () => {
    assert.equal(scoreText('anything', new Map()).weightedHits, 0);
  });

  test('density normalises by square root of length, not length', () => {
    // Same hit count, one quote four times longer: score halves rather than quarters.
    assert.equal(densityScore(4, 100), 0.4);
    assert.equal(densityScore(4, 400), 0.2);
  });
});

describe('targeted quote selection', () => {
  const corpus = makeCorpus([
    ['Nothing relevant appears in this line at all.', 0],
    ['The thither theory: this thing thrives on those thoughts through them.', 0],
    ['A mild mention of the word there and then.', 0],
  ]);

  test('picks the quote densest in the targeted transitions', () => {
    const result = selectTargetedQuote(corpus, [{ digraph: 'th', mean: 200 }], {
      overallMean: 100,
      rng: seededRng(7),
    });
    assert.equal(result.ok, true);
    assert.match(result.value.quote.text, /thither theory/);
    assert.ok(result.value.targeted.includes('th'));
  });

  test('reports which transitions the chosen quote actually exercises', () => {
    const result = selectTargetedQuote(corpus, [{ digraph: 'th', mean: 200 }], {
      overallMean: 100,
      rng: seededRng(3),
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.targeted, ['th']);
  });

  test('fails with a structured payload when no weak digraphs are supplied', () => {
    const result = selectTargetedQuote(corpus, [], { overallMean: 100 });
    assert.equal(result.ok, false);
    assert.equal(result.error.component, 'selector.targeted');
    assert.equal(result.error.failureType, 'validation');
  });

  test('fails cleanly when the transition appears nowhere in the corpus', () => {
    const result = selectTargetedQuote(corpus, [{ digraph: 'zq', mean: 400 }], {
      overallMean: 100,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.failureType, 'not-found');
    assert.deepEqual(result.error.context.targets, ['zq']);
  });

  test('serves the best available quote when the density floor is unreachable', () => {
    // A floor this high cannot be met by any short quote, but refusing to drill
    // is worse than drilling against the densest candidate available.
    const result = selectTargetedQuote(corpus, [{ digraph: 'th', mean: 200 }], {
      overallMean: 100,
      minWeightedHits: 999,
      rng: seededRng(9),
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.metFloor, false);
    assert.ok(result.value.weightedHits > 0);
  });

  test('reports when the density floor was comfortably met', () => {
    const result = selectTargetedQuote(corpus, [{ digraph: 'th', mean: 200 }], {
      overallMean: 100,
      minWeightedHits: 1,
      rng: seededRng(9),
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.metFloor, true);
  });

  test('excludes quotes longer than the drill length limit', () => {
    const long = 'The thing about this: ' + 'th '.repeat(200);
    const mixed = makeCorpus([
      ['Short thing with th and th again.', 0],
      [long, 1],
    ]);
    const result = selectTargetedQuote(mixed, [{ digraph: 'th', mean: 200 }], {
      overallMean: 100,
      maxLength: 300,
      rng: seededRng(6),
    });
    assert.equal(result.ok, true);
    assert.ok(result.value.quote.length <= 300);
  });

  test('fails cleanly on an empty corpus', () => {
    const result = selectTargetedQuote(makeCorpus([]), [{ digraph: 'th', mean: 200 }], {});
    assert.equal(result.ok, false);
    assert.match(result.error.rootCause, /empty or unavailable/);
  });

  test('skips recently served quotes', () => {
    const result = selectTargetedQuote(corpus, [{ digraph: 'th', mean: 200 }], {
      overallMean: 100,
      recentIds: [1],
      minWeightedHits: 0.1,
      rng: seededRng(5),
    });
    assert.equal(result.ok, true);
    assert.notEqual(result.value.quote.id, 1);
  });
});

describe('quote rotation', () => {
  test('serves every quote once before repeating any', () => {
    const corpus = makeCorpus([
      ['alpha text here', 0],
      ['bravo text here', 0],
      ['charlie text here', 0],
    ]);
    const rotation = new QuoteRotation(corpus, { rng: seededRng(11) });

    const firstPass = [rotation.next(), rotation.next(), rotation.next()].map((r) => r.value.id);
    assert.deepEqual([...firstPass].sort(), [0, 1, 2]);

    const fourth = rotation.next();
    assert.equal(fourth.ok, true);
  });

  test('fails with a structured payload when the pool is empty', () => {
    const rotation = new QuoteRotation(makeCorpus([]), { rng: seededRng(2) });
    const result = rotation.next();
    assert.equal(result.ok, false);
    assert.equal(result.error.component, 'selector.rotation');
  });

  test('respects a length group filter', () => {
    const corpus = makeCorpus([
      ['short quote here', 0],
      ['a considerably longer quote lives in group one', 1],
    ]);
    const rotation = new QuoteRotation(corpus, { groupFilter: [1], rng: seededRng(4) });
    assert.equal(rotation.next().value.group, 1);
  });
});

describe('recent quote memory', () => {
  test('evicts the oldest id beyond the limit', () => {
    const recent = new RecentQuotes(2);
    recent.add(1);
    recent.add(2);
    recent.add(3);
    assert.equal(recent.has(1), false);
    assert.equal(recent.has(3), true);
  });

  test('ignores non-numeric ids', () => {
    const recent = new RecentQuotes(2);
    recent.add(/** @type {any} */ ('nope'));
    assert.equal(recent.ids.length, 0);
  });
});

describe('slow section detection', () => {
  /**
   * @param {Array<[string, number]>} pairs char and flight
   */
  function strokes(pairs) {
    return pairs.map(([char, flight], index) => ({ char, flight, index }));
  }

  test('returns nothing when there is too little data', () => {
    assert.deepEqual(findSlowSections(strokes([['a', 100]])), []);
  });

  test('returns nothing when the rhythm is even', () => {
    const even = strokes(Array.from({ length: 20 }, (_, i) => [String.fromCharCode(97 + (i % 26)), 100]));
    assert.deepEqual(findSlowSections(even), []);
  });

  test('finds the stretch where the typist stalled', () => {
    const pairs = [];
    for (let i = 0; i < 10; i++) pairs.push(['a', 80]);
    for (let i = 0; i < 6; i++) pairs.push(['q', 400]);
    for (let i = 0; i < 10; i++) pairs.push(['a', 80]);

    const sections = findSlowSections(strokes(/** @type {any} */ (pairs)));
    assert.equal(sections.length, 1);
    assert.ok(sections[0].ratio > 1.35);
    assert.ok(sections[0].text.includes('q'));
  });

  test('ignores implausible flight times as pauses rather than typing', () => {
    const pairs = Array.from({ length: 12 }, () => ['a', 100]);
    pairs.push(['b', 9999]);
    const sections = findSlowSections(strokes(/** @type {any} */ (pairs)));
    assert.equal(sections.length, 0);
  });

  test('ranks digraphs by how badly and how often they appeared', () => {
    const sections = [
      { ratio: 2, digraphs: ['qu', 'ue'], startIndex: 0, endIndex: 2, meanFlight: 400, text: 'que' },
      { ratio: 1.5, digraphs: ['qu'], startIndex: 5, endIndex: 6, meanFlight: 300, text: 'qu' },
    ];
    const ranked = digraphsFromSections(/** @type {any} */ (sections));
    assert.equal(ranked[0].digraph, 'qu');
    assert.equal(ranked[0].occurrences, 2);
  });
});

describe('target merging', () => {
  test('marks a transition present in both sources', () => {
    const merged = mergeTargets([{ digraph: 'th', mean: 150 }], [{ digraph: 'th', weight: 1 }], {
      overallMean: 100,
    });
    assert.equal(merged[0].source, 'both');
  });

  test('boosts a fresh stumble above a mild profile weakness', () => {
    const merged = mergeTargets(
      [{ digraph: 'er', mean: 105 }],
      [{ digraph: 'zx', weight: 4 }],
      { overallMean: 100 }
    );
    assert.equal(merged[0].digraph, 'zx');
  });

  test('synthesises a plausible mean for recent-only transitions', () => {
    const merged = mergeTargets([], [{ digraph: 'zx', weight: 1 }], { overallMean: 100 });
    assert.equal(merged[0].mean, 200);
    assert.equal(merged[0].source, 'recent');
  });

  test('caps the list at the requested limit', () => {
    const profile = Array.from({ length: 20 }, (_, i) => ({ digraph: `a${i % 10}`, mean: 200 + i }));
    assert.equal(mergeTargets(profile, [], { overallMean: 100, limit: 5 }).length, 5);
  });
});

describe('session flow', () => {
  test('stays on quotes until enough transitions are sampled', () => {
    const flow = new SessionFlow({ minTargets: 4 });
    for (let i = 0; i < 10; i++) {
      assert.equal(flow.nextPhase({ availableTargets: 2 }).phase, PHASE_QUOTE);
      flow.advance();
    }
  });

  test('runs quotes then targeted drills then quotes again', () => {
    const flow = new SessionFlow({ quotesPerCycle: 3, targetedPerCycle: 2, minTargets: 1 });
    const observed = [];
    for (let i = 0; i < 10; i++) {
      observed.push(flow.nextPhase({ availableTargets: 8 }).phase);
      flow.advance();
    }
    assert.deepEqual(observed, [
      PHASE_QUOTE, PHASE_QUOTE, PHASE_QUOTE,
      PHASE_TARGETED, PHASE_TARGETED,
      PHASE_QUOTE, PHASE_QUOTE, PHASE_QUOTE,
      PHASE_TARGETED, PHASE_TARGETED,
    ]);
  });

  test('counts down to the targeted phase', () => {
    const flow = new SessionFlow({ quotesPerCycle: 3, targetedPerCycle: 2, minTargets: 1 });
    assert.equal(flow.untilTargeted, 3);
    flow.advance();
    assert.equal(flow.untilTargeted, 2);
  });

  test('explains why it chose a quote', () => {
    const flow = new SessionFlow({ minTargets: 4 });
    assert.match(flow.nextPhase({ availableTargets: 1 }).reason, /1\/4 transitions sampled/);
  });

  test('never targets when drills are disabled', () => {
    const flow = new SessionFlow({ targetedPerCycle: 0, minTargets: 0 });
    for (let i = 0; i < 5; i++) {
      assert.equal(flow.nextPhase({ availableTargets: 20 }).phase, PHASE_QUOTE);
      flow.advance();
    }
  });

  test('jumps to targeting on explicit request', () => {
    const flow = new SessionFlow({ quotesPerCycle: 4, targetedPerCycle: 2, minTargets: 1 });
    flow.forceTargeted();
    assert.equal(flow.nextPhase({ availableTargets: 8 }).phase, PHASE_TARGETED);
  });

  test('returns to reading on explicit request', () => {
    const flow = new SessionFlow({ quotesPerCycle: 4, targetedPerCycle: 2, minTargets: 1 });
    flow.forceTargeted();
    flow.forceQuote();
    assert.equal(flow.nextPhase({ availableTargets: 8 }).phase, PHASE_QUOTE);
  });
});
