import { ok, fail } from './result.js';

/**
 * Quote selection.
 *
 * Two modes matter:
 *
 *   1. Rotation — shuffle the corpus and walk it, the default reading experience.
 *   2. Targeting — find real prose that is unusually dense in the transitions
 *      the typist is slowest at, so drill time is still spent reading literature
 *      rather than generated word salad.
 */

/** Candidates considered for the weighted pick, so repeats are rare. */
const DEFAULT_SHORTLIST = 20;

/**
 * Weighted signal a quote should carry to count as a solid drill.
 *
 * Calibrated against 300-character drills: with typical deficit weights near
 * 0.4, this is roughly four reps of a targeted transition.
 */
const DEFAULT_MIN_WEIGHTED_HITS = 1.5;

/** Quotes served this recently are skipped when a fresh one is available. */
const DEFAULT_RECENT_MEMORY = 40;

/** Targeted drills stay short so the return to reading is quick. */
const DEFAULT_MAX_TARGETED_LENGTH = 300;

/**
 * Converts a weak-digraph list into per-digraph weights expressing how much
 * slower than the typist's own baseline each transition is.
 *
 * A digraph 40% slower than baseline gets weight 0.4. Using relative deficit
 * rather than raw flight time keeps the weighting meaningful as overall speed
 * improves — at 150 WPM everything is fast, but the gaps still rank.
 *
 * @param {Array<{digraph:string, mean:number}>} weakDigraphs
 * @param {number} overallMean  Mean flight time across all observed digraphs, ms.
 * @returns {Map<string, number>}
 */
export function buildDigraphWeights(weakDigraphs, overallMean) {
  /** @type {Map<string, number>} */
  const weights = new Map();
  if (!Array.isArray(weakDigraphs) || weakDigraphs.length === 0) return weights;

  const baseline = overallMean > 0 ? overallMean : 0;

  for (const entry of weakDigraphs) {
    const digraph = typeof entry === 'string' ? entry : entry?.digraph;
    if (typeof digraph !== 'string' || digraph.length !== 2) continue;

    const mean = typeof entry === 'string' ? 0 : Number(entry.mean) || 0;
    const deficit = baseline > 0 ? (mean - baseline) / baseline : 0;

    // Every listed digraph is worth some practice even if the deficit rounds
    // to nothing, so the floor keeps it in the running.
    weights.set(digraph, Math.max(0.1, deficit));
  }

  return weights;
}

/**
 * Precompiles a weight map into character-code keys.
 *
 * Scoring runs over ~1.4M two-character windows per selection. Building the
 * window as a string allocates on every step and dominated the cost; packing
 * both char codes into one integer removes the allocation entirely.
 *
 * @param {Map<string, number>} weights
 * @returns {{ lookup: Map<number, number>, labels: Map<number, string> }}
 */
export function compileWeights(weights) {
  /** @type {Map<number, number>} */
  const lookup = new Map();
  /** @type {Map<number, string>} */
  const labels = new Map();

  for (const [pair, weight] of weights) {
    if (pair.length !== 2) continue;
    const code = (pair.charCodeAt(0) << 16) | pair.charCodeAt(1);
    lookup.set(code, weight);
    labels.set(code, pair);
  }

  return { lookup, labels };
}

/**
 * Counts occurrences of each weighted digraph in one pass.
 *
 * @param {string} lowerText
 * @param {{ lookup: Map<number, number>, labels: Map<number, string> }} compiled
 * @returns {{ weightedHits: number, hits: Map<string, number> }}
 */
export function scoreCompiled(lowerText, compiled) {
  /** @type {Map<string, number>} */
  const hits = new Map();
  let weightedHits = 0;

  const { lookup, labels } = compiled;
  if (lookup.size === 0) return { weightedHits, hits };

  const limit = lowerText.length - 1;
  let prev = lowerText.charCodeAt(0);

  for (let i = 0; i < limit; i++) {
    const cur = lowerText.charCodeAt(i + 1);
    const weight = lookup.get((prev << 16) | cur);
    prev = cur;
    if (weight === undefined) continue;
    const label = /** @type {string} */ (labels.get((lowerText.charCodeAt(i) << 16) | cur));
    hits.set(label, (hits.get(label) || 0) + 1);
    weightedHits += weight;
  }

  return { weightedHits, hits };
}

/**
 * Convenience wrapper that compiles and scores in one call.
 *
 * @param {string} lowerText
 * @param {Map<string, number>} weights
 * @returns {{ weightedHits: number, hits: Map<string, number> }}
 */
export function scoreText(lowerText, weights) {
  return scoreCompiled(lowerText, compileWeights(weights));
}

/**
 * Density score for a quote.
 *
 * Dividing by the square root of length rather than length itself stops a
 * 30-character quote with a single lucky hit from outranking a 200-character
 * quote saturated with the target transitions.
 *
 * @param {number} weightedHits
 * @param {number} length
 * @returns {number}
 */
export function densityScore(weightedHits, length) {
  if (length <= 0) return 0;
  return weightedHits / Math.sqrt(length);
}

/**
 * Picks one item from a shortlist, biased toward the higher scores but not
 * deterministic, so the same top quote is not served every drill.
 *
 * @template T
 * @param {Array<{ item: T, score: number }>} shortlist
 * @param {() => number} rng
 * @returns {T}
 */
function weightedPick(shortlist, rng) {
  const total = shortlist.reduce((sum, entry) => sum + entry.score, 0);
  if (total <= 0) return shortlist[0].item;

  let threshold = rng() * total;
  for (const entry of shortlist) {
    threshold -= entry.score;
    if (threshold <= 0) return entry.item;
  }
  return shortlist[shortlist.length - 1].item;
}

/**
 * Finds a real quote densely populated with the typist's slowest transitions.
 *
 * @param {import('./corpus.js').Corpus} corpus
 * @param {Array<{digraph:string, mean:number}>} weakDigraphs
 * @param {{
 *   overallMean?: number,
 *   groupFilter?: number[]|null,
 *   maxLength?: number,
 *   recentIds?: Iterable<number>,
 *   shortlistSize?: number,
 *   minWeightedHits?: number,
 *   rng?: () => number
 * }} [options]
 * @returns {import('./result.js').Success<{
 *   quote: any, weightedHits: number, score: number, targeted: string[]
 * }> | import('./result.js').Failure}
 */
export function selectTargetedQuote(corpus, weakDigraphs, options = {}) {
  const {
    overallMean = 0,
    groupFilter = null,
    maxLength = DEFAULT_MAX_TARGETED_LENGTH,
    recentIds = [],
    shortlistSize = DEFAULT_SHORTLIST,
    minWeightedHits = DEFAULT_MIN_WEIGHTED_HITS,
    rng = Math.random,
  } = options;

  if (!corpus || corpus.size === 0) {
    return fail('selector.targeted', 'not-found', 'corpus is empty or unavailable');
  }

  const weights = buildDigraphWeights(weakDigraphs, overallMean);
  if (weights.size === 0) {
    return fail('selector.targeted', 'validation', 'no weak digraphs supplied, nothing to target', {
      weakDigraphCount: Array.isArray(weakDigraphs) ? weakDigraphs.length : 0,
    });
  }

  const recent = new Set(recentIds);
  const compiled = compileWeights(weights);

  // Targeted practice should be a short, concentrated rep. A 1,700-character
  // passage accumulates hits by sheer bulk while diluting the transitions it is
  // supposed to be drilling, and it delays the return to reading.
  const candidates = corpus.filterByGroups(groupFilter).filter((q) => q.length <= maxLength);

  /** @type {Array<{ item: any, score: number, weightedHits: number, hits: Map<string, number> }>} */
  const scored = [];

  for (const quote of candidates) {
    if (recent.has(quote.id)) continue;
    const { weightedHits, hits } = scoreCompiled(corpus.lowerText(quote), compiled);
    if (weightedHits <= 0) continue;
    scored.push({ item: quote, score: densityScore(weightedHits, quote.length), weightedHits, hits });
  }

  if (scored.length === 0) {
    return fail(
      'selector.targeted',
      'not-found',
      'no quote within the length limit contains any of these transitions',
      { targets: [...weights.keys()], maxLength, candidatesScanned: candidates.length }
    );
  }

  // The density floor is a preference, not a precondition. Rare transitions
  // paired with a short length limit can put the ideal threshold out of reach,
  // and a good-enough drill beats refusing to drill at all.
  let qualifying = scored.filter((entry) => entry.weightedHits >= minWeightedHits);
  let metFloor = qualifying.length > 0;
  if (!metFloor) qualifying = scored;

  qualifying.sort((a, b) => b.score - a.score);
  const shortlist = qualifying.slice(0, Math.max(1, shortlistSize));
  const chosen = weightedPick(shortlist, rng);
  const chosenEntry = shortlist.find((entry) => entry.item === chosen) ?? shortlist[0];

  const byFrequency = [...chosenEntry.hits.entries()].sort((a, b) => b[1] - a[1]);

  return ok({
    quote: chosenEntry.item,
    weightedHits: chosenEntry.weightedHits,
    score: chosenEntry.score,
    metFloor,
    targeted: byFrequency.map(([digraph]) => digraph),
    hitCounts: byFrequency.map(([digraph, count]) => ({ digraph, count })),
  });
}

/**
 * Sequential shuffled rotation through the corpus, the default reading mode.
 */
export class QuoteRotation {
  /**
   * @param {import('./corpus.js').Corpus} corpus
   * @param {{ groupFilter?: number[]|null, rng?: () => number }} [options]
   */
  constructor(corpus, options = {}) {
    this.corpus = corpus;
    this.rng = options.rng ?? Math.random;
    this.setGroupFilter(options.groupFilter ?? null);
  }

  /**
   * @param {number[]|null} groupFilter
   */
  setGroupFilter(groupFilter) {
    this.groupFilter = groupFilter;
    this.pool = this.corpus.filterByGroups(groupFilter);
    this.order = this.pool.map((_, i) => i);
    this.cursor = this.order.length;
  }

  _reshuffle() {
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }
    this.cursor = 0;
  }

  /**
   * @returns {import('./result.js').Success<any> | import('./result.js').Failure}
   */
  next() {
    if (this.pool.length === 0) {
      return fail('selector.rotation', 'not-found', 'no quotes match the active length filter');
    }
    if (this.cursor >= this.order.length) this._reshuffle();
    return ok(this.pool[this.order[this.cursor++]]);
  }
}

/**
 * Fixed-size memory of recently served quote ids, used to avoid repeats.
 */
export class RecentQuotes {
  /** @param {number} [limit] */
  constructor(limit = DEFAULT_RECENT_MEMORY) {
    this.limit = limit;
    /** @type {number[]} */
    this.ids = [];
  }

  /** @param {number} id */
  add(id) {
    if (typeof id !== 'number') return;
    this.ids.push(id);
    while (this.ids.length > this.limit) this.ids.shift();
  }

  /** @param {number} id */
  has(id) {
    return this.ids.includes(id);
  }
}
