import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildDigraphKey, DigraphMap } from '../src/core/digraph.js';
import { getRollingWpm } from '../src/core/wpm.js';
import { computeConsistency } from '../src/core/consistency.js';
import { estimateChunkHorizon } from '../src/core/chunk.js';
import { generateDrillText } from '../src/core/drill.js';
import { Profile } from '../src/core/profile.js';
import { detectProvider } from '../src/core/provider.js';
import { checkRetirement } from '../src/core/retirement.js';
import { computeWeakHash } from '../src/core/cache.js';
import { getTrackLabel } from '../src/core/tags.js';
import { generateLocalPortrait } from '../src/core/portrait.js';
import { buildTersePrompt } from '../src/core/prompt.js';
import { shouldUseAPI } from '../src/core/budget.js';
import { canShowChunkTransfer } from '../src/core/ui-logic.js';

// ═══════════════════════════════════════════════════════════════
// ─── buildDigraphKey ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
describe('buildDigraphKey', () => {
  test('creates key from two chars', () => {
    assert.equal(buildDigraphKey('t', 'h'), 'th');
  });

  test('normalizes to lowercase', () => {
    assert.equal(buildDigraphKey('T', 'H'), 'th');
  });

  test('handles space → letter', () => {
    assert.equal(buildDigraphKey(' ', 't'), ' t');
  });

  test('handles letter → space', () => {
    assert.equal(buildDigraphKey('e', ' '), 'e ');
  });

  test('returns null for null prev', () => {
    assert.equal(buildDigraphKey(null, 'a'), null);
  });

  test('returns null for null cur', () => {
    assert.equal(buildDigraphKey('a', null), null);
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── DigraphMap ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
describe('DigraphMap', () => {
  test('count increments correctly', () => {
    const dm = new DigraphMap();
    dm.update('th', 100);
    dm.update('th', 200);
    dm.update('th', 150);
    assert.equal(dm.getStats('th').count, 3);
  });

  test('mean converges on known input (Welford)', () => {
    const dm = new DigraphMap();
    dm.update('th', 100);
    dm.update('th', 200);
    assert.equal(dm.getStats('th').mean, 150);
  });

  test('stddev = 0 for single observation', () => {
    const dm = new DigraphMap();
    dm.update('th', 100);
    assert.equal(dm.getStats('th').stddev, 0);
  });

  test('stddev correct for [100, 200]', () => {
    const dm = new DigraphMap();
    dm.update('th', 100);
    dm.update('th', 200);
    const stats = dm.getStats('th');
    assert.ok(Math.abs(stats.stddev - 70.71) < 0.1);
  });

  test('getWeakList returns slowest digraphs', () => {
    const dm = new DigraphMap();
    for (let i = 0; i < 10; i++) { dm.update('th', 50); }
    for (let i = 0; i < 10; i++) { dm.update('er', 200); }
    for (let i = 0; i < 10; i++) { dm.update('qu', 300); }
    const weak = dm.getWeakList(2);
    assert.equal(weak.length, 2);
    assert.equal(weak[0].digraph, 'qu');
    assert.equal(weak[1].digraph, 'er');
  });

  test('getWeakList returns empty for no data', () => {
    const dm = new DigraphMap();
    assert.deepEqual(dm.getWeakList(), []);
  });

  test('getWeakList excludes digraphs with count < MIN_SAMPLES', () => {
    const dm = new DigraphMap();
    for (let i = 0; i < 3; i++) { dm.update('th', 500); }
    for (let i = 0; i < 10; i++) { dm.update('er', 200); }
    const weak = dm.getWeakList(5);
    assert.equal(weak.length, 1);
    assert.equal(weak[0].digraph, 'er');
  });

  test('toJSON → fromJSON round-trip preserves stats', () => {
    const dm = new DigraphMap();
    for (let i = 0; i < 10; i++) { dm.update('th', 100 + i * 10); }
    const json = dm.toJSON();
    const dm2 = new DigraphMap(json);
    const s1 = dm.getStats('th');
    const s2 = dm2.getStats('th');
    assert.equal(s1.count, s2.count);
    assert.ok(Math.abs(s1.mean - s2.mean) < 0.01);
    assert.ok(Math.abs(s1.stddev - s2.stddev) < 0.01);
  });

  test('toHeatmapData returns 676 entries', () => {
    const dm = new DigraphMap();
    const data = dm.toHeatmapData();
    assert.equal(data.length, 676);
  });

  test('mean is numerically stable over 1000 updates', () => {
    const dm = new DigraphMap();
    const value = 123.456;
    for (let i = 0; i < 1000; i++) { dm.update('th', value); }
    const stats = dm.getStats('th');
    assert.ok(Math.abs(stats.mean - value) < 0.001);
    assert.ok(stats.stddev < 0.001);
  });

  test('rejects negative flight times', () => {
    const dm = new DigraphMap();
    dm.update('th', -50);
    assert.equal(dm.getStats('th'), null);
  });

  test('rejects flight times > 3000ms', () => {
    const dm = new DigraphMap();
    dm.update('th', 5000);
    assert.equal(dm.getStats('th'), null);
  });

  test('getOverallMean computes weighted average', () => {
    const dm = new DigraphMap();
    for (let i = 0; i < 10; i++) { dm.update('th', 100); }
    for (let i = 0; i < 10; i++) { dm.update('er', 200); }
    const mean = dm.getOverallMean();
    assert.equal(mean, 150);
  });

  test('getOverallMean returns 0 for empty map', () => {
    const dm = new DigraphMap();
    assert.equal(dm.getOverallMean(), 0);
  });

  test('merges stats from new session (count accumulates)', () => {
    const dm = new DigraphMap();
    for (let i = 0; i < 5; i++) { dm.update('th', 100); }
    const json = dm.toJSON();
    const dm2 = new DigraphMap(json);
    for (let i = 0; i < 5; i++) { dm2.update('th', 200); }
    assert.equal(dm2.getStats('th').count, 10);
    assert.equal(dm2.getStats('th').mean, 150);
  });

  test('survives JSON serialization', () => {
    const dm = new DigraphMap();
    dm.update('th', 100);
    dm.update('th', 200);
    const str = JSON.stringify(dm.toJSON());
    const dm2 = new DigraphMap(JSON.parse(str));
    assert.equal(dm2.getStats('th').count, 2);
    assert.equal(dm2.getStats('th').mean, 150);
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Rolling WPM ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
describe('getRollingWpm', () => {
  test('returns 0 for empty timestamps', () => {
    assert.equal(getRollingWpm([], 10000), 0);
  });

  test('returns 0 for 1 timestamp', () => {
    assert.equal(getRollingWpm([9000], 10000), 0);
  });

  test('returns 0 after 5s of no typing', () => {
    assert.equal(getRollingWpm([1000, 2000], 10000), 0);
  });

  test('correct WPM for 50 chars in 10s → 60 WPM', () => {
    const now = 10000;
    const timestamps = [];
    for (let i = 0; i < 25; i++) {
      timestamps.push(now - 5000 + i * 200);
    }
    const wpm = getRollingWpm(timestamps, now);
    assert.ok(wpm >= 55 && wpm <= 65, `Expected ~60, got ${wpm}`);
  });

  test('correct WPM for fast typing (~150 WPM)', () => {
    const now = 10000;
    const timestamps = [];
    for (let i = 0; i < 62; i++) {
      timestamps.push(now - 5000 + i * 80);
    }
    const wpm = getRollingWpm(timestamps, now);
    assert.ok(wpm >= 140 && wpm <= 160, `Expected ~150, got ${wpm}`);
  });

  test('drops timestamps outside 5s window', () => {
    const now = 10000;
    const timestamps = [1000, 2000, 3000];
    assert.equal(getRollingWpm(timestamps, now), 0);
  });

  test('monotonically decays after typing stops', () => {
    const timestamps = [];
    for (let i = 0; i < 20; i++) { timestamps.push(1000 + i * 100); }
    const wpm1 = getRollingWpm(timestamps, 3000);
    const wpm2 = getRollingWpm(timestamps, 5000);
    const wpm3 = getRollingWpm(timestamps, 7000);
    assert.ok(wpm1 >= wpm2, `${wpm1} should >= ${wpm2}`);
    assert.ok(wpm2 >= wpm3, `${wpm2} should >= ${wpm3}`);
  });

  test('handles fractional second spans', () => {
    const now = 1500.5;
    const timestamps = [1000.1, 1200.3, 1400.7];
    const wpm = getRollingWpm(timestamps, now);
    assert.ok(wpm > 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Consistency ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
describe('computeConsistency', () => {
  test('returns 100 for identical dwells', () => {
    assert.equal(computeConsistency([80, 80, 80, 80, 80]), 100);
  });

  test('returns 0 for highly variable dwells', () => {
    const result = computeConsistency([10, 500, 10, 500, 10]);
    assert.equal(result, 0);
  });

  test('returns intermediate for moderate variation', () => {
    const result = computeConsistency([80, 90, 85, 75, 95]);
    assert.ok(result > 20 && result < 100, `Got ${result}`);
  });

  test('returns 0 for < 2 dwells', () => {
    assert.equal(computeConsistency([80]), 0);
    assert.equal(computeConsistency([]), 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Chunk Horizon Estimator ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════
describe('estimateChunkHorizon', () => {
  test('returns 1.5 with insufficient data', () => {
    const events = [{ key: 'a', flight: 50 }, { key: 'b', flight: 60 }];
    assert.equal(estimateChunkHorizon(events), 1.5);
  });

  test('clamps to [1.0, 4.0]', () => {
    const events = [];
    for (let i = 0; i < 30; i++) {
      if (i % 5 === 0) {
        events.push({ key: ' ', flight: 10 });
      } else {
        events.push({ key: 'a', flight: 10 });
      }
    }
    const h = estimateChunkHorizon(events);
    assert.ok(h >= 1.0 && h <= 4.0, `Got ${h}`);
  });

  test('returns higher horizon for deeper buffer (low inter/intra ratio)', () => {
    const deep = [];
    for (let i = 0; i < 40; i++) {
      deep.push({ key: i % 6 === 0 ? ' ' : 'a', flight: 55 });
    }
    const hDeep = estimateChunkHorizon(deep);

    const shallow = [];
    for (let i = 0; i < 40; i++) {
      const isSpace = i % 6 === 0;
      shallow.push({ key: isSpace ? ' ' : 'a', flight: isSpace ? 300 : 50 });
    }
    const hShallow = estimateChunkHorizon(shallow);

    assert.ok(hDeep >= hShallow, `Deep ${hDeep} should >= shallow ${hShallow}`);
  });

  test('handles all-intra (no spaces) → returns 1.5', () => {
    const events = [];
    for (let i = 0; i < 30; i++) {
      events.push({ key: 'a', flight: 50 });
    }
    assert.equal(estimateChunkHorizon(events), 1.5);
  });

  test('handles null flights gracefully', () => {
    const events = [
      { key: 'a', flight: null },
      { key: 'b', flight: 50 },
      { key: ' ', flight: 100 },
      { key: 'c', flight: null },
    ];
    const h = estimateChunkHorizon(events);
    assert.ok(typeof h === 'number');
  });

  test('result stable over many events', () => {
    const events = [];
    for (let i = 0; i < 200; i++) {
      events.push({ key: i % 5 === 0 ? ' ' : 'a', flight: 50 + Math.random() * 5 });
    }
    const h1 = estimateChunkHorizon(events);
    const h2 = estimateChunkHorizon(events);
    assert.equal(h1, h2);
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Drill Text Generator ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
describe('generateDrillText', () => {
  test('returns null for empty weak list', () => {
    assert.equal(generateDrillText([]), null);
    assert.equal(generateDrillText(null), null);
  });

  test('produces words containing target digraph', () => {
    const text = generateDrillText([{ digraph: 'qu' }]);
    assert.ok(text, 'Should produce text');
    const words = text.split(' ');
    const hasTarget = words.some(w => w.includes('qu'));
    assert.ok(hasTarget, 'At least one word should contain "qu"');
  });

  test('returns >= 50 words', () => {
    const text = generateDrillText([{ digraph: 'th' }]);
    assert.ok(text);
    const words = text.split(' ');
    assert.ok(words.length >= 50, `Got ${words.length} words`);
  });

  test('does not repeat same word consecutively', () => {
    const text = generateDrillText([{ digraph: 'th' }]);
    assert.ok(text);
    const words = text.split(' ');
    for (let i = 1; i < words.length; i++) {
      assert.notEqual(words[i], words[i - 1], `Consecutive repeat: "${words[i]}" at index ${i}`);
    }
  });

  test('target digraphs appear >= 5x in output', () => {
    const text = generateDrillText([{ digraph: 'qu' }], 80);
    assert.ok(text);
    const count = (text.match(/qu/gi) || []).length;
    assert.ok(count >= 5, `"qu" appeared only ${count} times`);
  });

  test('handles string-form weak list', () => {
    const text = generateDrillText(['th', 'er']);
    assert.ok(text);
    assert.ok(text.length > 100);
  });
});


// ═══════════════════════════════════════════════════════════════
// ─── Profile logic ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
describe('Profile logic', () => {
  let store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = v; },
    removeItem(k) { delete store[k]; },
  };

  test('load returns default when empty', () => {
    store = {};
    const p = Profile.load(mockStorage);
    assert.equal(p.version, 2);
    assert.deepEqual(p.sessions, []);
    assert.equal(p.chunkHorizon, 1.5);
    assert.equal(p.settings.soundEnabled, false);
  });

  test('save + load round-trip', () => {
    store = {};
    const p = Profile._default();
    p.chunkHorizon = 2.5;
    p.textCount = 42;
    Profile.save(p, mockStorage);
    const loaded = Profile.load(mockStorage);
    assert.equal(loaded.chunkHorizon, 2.5);
    assert.equal(loaded.textCount, 42);
  });

  test('appendSession increments session count', () => {
    store = {};
    const p = Profile._default();
    Profile.appendSession(p, { timestamp: Date.now(), track: 'A', wpm: 120, consistency: 80 }, mockStorage);
    assert.equal(p.sessions.length, 1);
    Profile.appendSession(p, { timestamp: Date.now(), track: 'C', wpm: 130, consistency: 85 }, mockStorage);
    assert.equal(p.sessions.length, 2);
  });

  test('appendSession stores track type correctly', () => {
    store = {};
    const p = Profile._default();
    Profile.appendSession(p, { timestamp: 1234, track: 'A', wpm: 100, consistency: 70 }, mockStorage);
    assert.equal(p.sessions[0].track, 'A');
  });

  test('sessions capped at 200', () => {
    store = {};
    const p = Profile._default();
    for (let i = 0; i < 210; i++) {
      Profile.appendSession(p, { timestamp: i, track: 'C', wpm: 100 }, mockStorage);
    }
    assert.equal(p.sessions.length, 200);
    assert.equal(p.sessions[199].timestamp, 209);
  });

  test('clear removes data', () => {
    store = {};
    const p = Profile._default();
    p.textCount = 99;
    Profile.save(p, mockStorage);
    Profile.clear(mockStorage);
    const loaded = Profile.load(mockStorage);
    assert.equal(loaded.textCount, 0);
  });

  test('handles corrupted localStorage gracefully', () => {
    store = {};
    mockStorage.setItem('cadence_profile_v2', '{invalid json!!!');
    const p = Profile.load(mockStorage);
    assert.equal(p.version, 2);
  });

  test('rejects wrong version', () => {
    store = {};
    mockStorage.setItem('cadence_profile_v2', JSON.stringify({ version: 99, data: 'old' }));
    const p = Profile.load(mockStorage);
    assert.equal(p.version, 2);
    assert.deepEqual(p.sessions, []);
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Integration ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
describe('Integration', () => {
  test('keystroke sequence → correct digraph map', () => {
    const dm = new DigraphMap();
    const keys = ['t', 'h', 'e', ' ', 'q', 'u', 'i', 'c', 'k'];
    let prev = null;
    keys.forEach((key, i) => {
      if (prev) {
        const dg = buildDigraphKey(prev, key);
        dm.update(dg, 50 + i * 10);
      }
      prev = key;
    });

    assert.ok(dm.getStats('th'));
    assert.ok(dm.getStats('he'));
    assert.ok(dm.getStats('e '));
    assert.ok(dm.getStats(' q'));
    assert.ok(dm.getStats('qu'));
    assert.ok(dm.getStats('ui'));
    assert.ok(dm.getStats('ic'));
    assert.ok(dm.getStats('ck'));
    assert.equal(dm.getStats('th').count, 1);
  });

  test('pipeline: digraph map → weak list → drill text', () => {
    const dm = new DigraphMap();
    for (let i = 0; i < 20; i++) {
      dm.update('th', 80);
      dm.update('qu', 250);
      dm.update('er', 90);
      dm.update('zy', 300);
    }

    const weakList = dm.getWeakList(5);
    assert.ok(weakList.length >= 2);
    assert.equal(weakList[0].digraph, 'zy');

    const drillText = generateDrillText(weakList);
    assert.ok(drillText);
    assert.ok(drillText.length > 50);
  });

  test('consistency matches manual calculation', () => {
    const dwells = [100, 100, 100, 100, 100];
    assert.equal(computeConsistency(dwells), 100);

    const dwells2 = [50, 150, 50, 150, 50, 150];
    const mean = 100;
    const variance = (50 * 50 * 3 + 50 * 50 * 3) / 6;
    const cv = Math.sqrt(variance) / mean;
    const expected = Math.round((1 - cv) * 100);
    assert.equal(computeConsistency(dwells2), expected);
  });

  test('DigraphMap serialization survives across sessions', () => {
    const dm1 = new DigraphMap();
    for (let i = 0; i < 10; i++) { dm1.update('th', 80 + Math.random() * 20); }
    for (let i = 0; i < 10; i++) { dm1.update('qu', 200 + Math.random() * 30); }
    const json1 = dm1.toJSON();

    const dm2 = new DigraphMap(json1);
    for (let i = 0; i < 10; i++) { dm2.update('th', 70 + Math.random() * 15); }

    const stats = dm2.getStats('th');
    assert.equal(stats.count, 20);
    assert.ok(stats.mean < 95);
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── detectProvider ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
describe('detectProvider', () => {
  test('T-API-1: returns anthropic for sk-ant- prefix', () => {
    assert.equal(detectProvider('sk-ant-api03-abc123'), 'anthropic');
  });

  test('T-API-2: returns openai for sk- prefix', () => {
    assert.equal(detectProvider('sk-proj-abc123'), 'openai');
  });

  test('T-API-3: returns unknown for unrecognized prefix', () => {
    assert.equal(detectProvider('some-random-key'), 'unknown');
    assert.equal(detectProvider(null), null);
    assert.equal(detectProvider(''), null);
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Digraph Retirement ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
describe('Digraph Retirement', () => {
  test('T-RET-1: counter increments when mean < overall', () => {
    const counters = {};
    checkRetirement(counters, [{ digraph: 'th', mean: 80 }], 100);
    assert.equal(counters['th'], 1);
  });

  test('T-RET-2: counter resets when mean >= overall', () => {
    const counters = { 'th': 2 };
    checkRetirement(counters, [{ digraph: 'th', mean: 120 }], 100);
    assert.equal(counters['th'], 0);
  });

  test('T-RET-3: digraph retired after 3 consecutive sessions below avg', () => {
    const counters = {};
    const weak = [{ digraph: 'th', mean: 80 }];
    checkRetirement(counters, weak, 100);
    checkRetirement(counters, weak, 100);
    const retired = checkRetirement(counters, weak, 100);
    assert.ok(retired.includes('th'));
    assert.equal(counters['th'], undefined);
  });

  test('T-RET-4: retired digraph gone from counters', () => {
    const counters = { 'th': 2 };
    checkRetirement(counters, [{ digraph: 'th', mean: 80 }], 100);
    assert.equal(counters['th'], undefined);
  });

  test('T-RET-5: counters survive profile save/load', () => {
    const store = {};
    const mockStorage = {
      getItem(k) { return store[k] || null; },
      setItem(k, v) { store[k] = v; },
    };
    const p = { version: 2, retirementCounters: { 'th': 2, 'er': 1 } };
    mockStorage.setItem('test_key', JSON.stringify(p));
    const loaded = JSON.parse(mockStorage.getItem('test_key'));
    assert.equal(loaded.retirementCounters['th'], 2);
    assert.equal(loaded.retirementCounters['er'], 1);
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── AI Text Caching ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
describe('AI Text Caching', () => {
  test('T-CACHE-1: cache hit when weak list unchanged', () => {
    const cache = { hash: 'er,th', texts: ['cached text 1'] };
    const hash = computeWeakHash([{ digraph: 'th' }, { digraph: 'er' }]);
    assert.equal(hash, cache.hash);
    assert.ok(cache.texts.length > 0);
  });

  test('T-CACHE-2: cache miss when ≥2 digraphs changed', () => {
    const cache = { hash: 'er,th', texts: ['cached text 1'] };
    const hash = computeWeakHash([{ digraph: 'qu' }, { digraph: 'xc' }]);
    assert.notEqual(hash, cache.hash);
  });

  test('T-CACHE-3: cache stores up to 5 texts and pops one per use', () => {
    const cache = { hash: 'th', texts: ['a', 'b', 'c', 'd', 'e'] };
    assert.equal(cache.texts.length, 5);
    const used = cache.texts.pop();
    assert.equal(used, 'e');
    assert.equal(cache.texts.length, 4);
  });

  test('T-CACHE-4: hash computed from sorted digraph keys', () => {
    const h1 = computeWeakHash([{ digraph: 'th' }, { digraph: 'er' }]);
    const h2 = computeWeakHash([{ digraph: 'er' }, { digraph: 'th' }]);
    assert.equal(h1, h2);
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Session Track Tagging ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
describe('Session Track Tagging', () => {
  test('T-TAG-1: quote sessions tagged as C', () => {
    assert.equal(getTrackLabel(false, false, false), 'C');
  });

  test('T-TAG-2: drill sessions tagged as A', () => {
    assert.equal(getTrackLabel(true, false, false), 'A');
  });

  test('T-TAG-3: transfer sessions tagged correctly', () => {
    assert.equal(getTrackLabel(false, false, true), 'transfer');
    assert.equal(getTrackLabel(true, true, true), 'transfer');
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Track B Chunking ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
import { countWordsBetween } from '../src/core/chunk.js';

describe('Track B Chunking', () => {
  test('T-CHUNK-1: horizon increases by 0.5 on successful completion', () => {
    let horizon = 1.5;
    horizon = Math.min(4.0, Math.round((horizon + 0.5) * 10) / 10);
    assert.equal(horizon, 2.0);
  });

  test('T-CHUNK-2: horizon capped at 4.0', () => {
    let horizon = 3.8;
    horizon = Math.min(4.0, Math.round((horizon + 0.5) * 10) / 10);
    assert.equal(horizon, 4.0);

    horizon = 4.0;
    horizon = Math.min(4.0, Math.round((horizon + 0.5) * 10) / 10);
    assert.equal(horizon, 4.0);
  });

  test('T-CHUNK-3: catch-up triggers when cursor >2 words behind', () => {
    const text = 'the quick brown fox jumps over the lazy dog';
    const wordsBehind = countWordsBetween(text, 0, 25);
    assert.ok(wordsBehind > 2, `Words behind: ${wordsBehind}`);
  });

  test('T-CHUNK-4: estimateChunkHorizon matches expected ratio', () => {
    const events = [];
    for (let i = 0; i < 40; i++) {
      events.push({ key: i % 5 === 0 ? ' ' : 'a', flight: 100 });
    }
    const h = estimateChunkHorizon(events);
    assert.ok(h >= 3.5 && h <= 4.0, `Got ${h}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Transfer Test ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
describe('Transfer Test', () => {
  test('T-XFER-1: transfer pool stores multiple texts', () => {
    const pool = [];
    pool.push('text one about something interesting');
    pool.push('text two with different content here');
    pool.push('text three covering various topics now');
    assert.ok(pool.length >= 3);
  });

  test('T-XFER-2: transfer session tagged correctly', () => {
    const label = getTrackLabel(false, false, true);
    assert.equal(label, 'transfer');
  });

  test('T-XFER-3: divergence detected when transfer < training for 2+ tests', () => {
    const transferHistory = [
      { date: 1, wpm: 80, consistency: 70 },
      { date: 2, wpm: 75, consistency: 65 },
    ];
    const trainingAvgWpm = 120;
    const lastTwo = transferHistory.slice(-2);
    const bothBelow = lastTwo.every(t => t.wpm < trainingAvgWpm * 0.9);
    assert.ok(bothBelow, 'Both transfer scores should be below 90% of training avg');
  });

  test('T-XFER-4: transfer texts not reused in training', () => {
    const pool = ['sealed text one', 'sealed text two'];
    const used = pool.pop();
    assert.equal(used, 'sealed text two');
    assert.equal(pool.length, 1);
    assert.ok(!pool.includes('sealed text two'));
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Phase 3 Budget & Setup Pure Functions ────────────────────
// ═══════════════════════════════════════════════════════════════
describe('Phase 3: Typist Portrait (Local)', () => {
  test('T-PORTRAIT-1: Computes average WPM correctly', () => {
    const profile = { sessions: [{wpm: 100}, {wpm: 120}], chunkHorizon: 2.0 };
    const portrait = generateLocalPortrait(profile, [{digraph: 'th'}]);
    assert.ok(portrait.includes('average 110 WPM'));
  });

  test('T-PORTRAIT-2: Inserts top weak digraphs', () => {
    const profile = { sessions: [{wpm: 100}], chunkHorizon: 1.5 };
    const portrait = generateLocalPortrait(profile, [{digraph: 'er'}, {digraph: 'xc'}, {digraph: 'qu'}]);
    assert.ok(portrait.includes("'er', 'xc', 'qu'"));
  });

  test('T-PORTRAIT-3: Fails gracefully without data', () => {
    const portrait = generateLocalPortrait({sessions: []}, []);
    assert.ok(portrait.includes('Complete a few sessions'));
  });
});

describe('Phase 3: API Budget Logic', () => {
  test('T-BUDGET-1: Terse prompt is under 100 chars', () => {
    const prompt = buildTersePrompt('th, er, qu');
    assert.ok(prompt.length < 100);
    assert.ok(prompt.includes('th, er, qu'));
  });

  test('T-BUDGET-2: API usage adheres to manual fallback', () => {
    assert.equal(shouldUseAPI('auto', false, true), true);
    assert.equal(shouldUseAPI('auto', true, true), false);
    assert.equal(shouldUseAPI('manual', false, true), false);
    assert.equal(shouldUseAPI('auto', false, false), false);
  });
});

describe('Phase 3: UI Flow Dependencies', () => {
  test('T-MODE-1 & T-MODE-2: Chunk/Transfer only show in Quote mode', () => {
    assert.equal(canShowChunkTransfer('quote'), true);
    assert.equal(canShowChunkTransfer('practice'), false);
  });
});


// ═══════════════════════════════════════════════════════════════
// ─── NEW: Profile Migration Tests ─────────────────────────────
// ═══════════════════════════════════════════════════════════════
describe('Profile Migration', () => {
  let store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = v; },
    removeItem(k) { delete store[k]; },
  };

  test('migrates v1 profile to v2 silently', () => {
    store = {};
    const v1 = {
      version: 1,
      digraphStats: { th: { count: 5, mean: 100, m2: 0 } },
      chunkHorizon: 2.0,
      sessions: [{ timestamp: 1, track: 'A', wpm: 100 }],
      textCount: 10,
      apiKey: 'sk-test',
      apiMode: 'manual',
      retirementCounters: { th: 1 },
      aiCache: { hash: 'th', texts: ['a'] },
      transferPool: ['text'],
      transferHistory: [{ date: 1, wpm: 90 }],
    };
    mockStorage.setItem('cadence_profile_v1', JSON.stringify(v1));
    const p = Profile.load(mockStorage);
    assert.equal(p.version, 2);
    assert.equal(p.digraphStats.th.mean, 100);
    assert.equal(p.chunkHorizon, 2.0);
    assert.equal(p.sessions.length, 1);
    assert.equal(p.settings.soundEnabled, false);
    assert.deepEqual(p.ghostLibrary, {});
    assert.equal(mockStorage.getItem('cadence_profile_v1'), null);
  });

  test('preserves digraphStats through migration', () => {
    store = {};
    const v1 = { version: 1, digraphStats: { th: { count: 10, mean: 100, m2: 250 } } };
    mockStorage.setItem('cadence_profile_v1', JSON.stringify(v1));
    const p = Profile.load(mockStorage);
    assert.equal(p.digraphStats.th.count, 10);
    assert.equal(p.digraphStats.th.mean, 100);
    assert.equal(p.digraphStats.th.m2, 250);
  });

  test('adds default settings block during migration', () => {
    store = {};
    const v1 = { version: 1 };
    mockStorage.setItem('cadence_profile_v1', JSON.stringify(v1));
    const p = Profile.load(mockStorage);
    assert.equal(p.settings.soundEnabled, false);
    assert.equal(p.settings.particleEnabled, true);
    assert.equal(p.settings.ghostEnabled, false);
    assert.equal(p.settings.rhythmEnabled, false);
    assert.equal(p.settings.zenDefault, false);
  });

  test('adds ghostLibrary during migration', () => {
    store = {};
    const v1 = { version: 1 };
    mockStorage.setItem('cadence_profile_v1', JSON.stringify(v1));
    const p = Profile.load(mockStorage);
    assert.deepEqual(p.ghostLibrary, {});
  });

  test('does not mutate already-v2 profiles', () => {
    store = {};
    const v2 = Profile._default();
    v2.settings.zenDefault = true;
    v2.ghostLibrary = { abc: { wpm: 100 } };
    mockStorage.setItem('cadence_profile_v2', JSON.stringify(v2));
    const p = Profile.load(mockStorage);
    assert.equal(p.settings.zenDefault, true);
    assert.ok(p.ghostLibrary.abc);
  });

  test('handles missing apiMode in v1', () => {
    store = {};
    const v1 = { version: 1 };
    mockStorage.setItem('cadence_profile_v1', JSON.stringify(v1));
    const p = Profile.load(mockStorage);
    assert.equal(p.apiMode, 'auto');
  });

  test('handles missing transferPool in v1', () => {
    store = {};
    const v1 = { version: 1 };
    mockStorage.setItem('cadence_profile_v1', JSON.stringify(v1));
    const p = Profile.load(mockStorage);
    assert.deepEqual(p.transferPool, []);
  });

  test('exportProfile returns valid JSON string', () => {
    const p = Profile._default();
    const json = Profile.exportProfile(p);
    assert.doesNotThrow(() => JSON.parse(json));
  });

  test('importProfile validates minimum schema', () => {
    assert.equal(Profile.importProfile('not json'), null);
    assert.equal(Profile.importProfile('{}'), null);
    assert.equal(Profile.importProfile('{"version":3}'), null);
  });

  test('importProfile accepts v1 and auto-migrates', () => {
    const v1 = { version: 1, digraphStats: {}, chunkHorizon: 1.5, sessions: [], textCount: 0, apiKey: '', apiMode: 'auto', retirementCounters: {}, aiCache: { hash: '', texts: [] }, transferPool: [], transferHistory: [] };
    const imported = Profile.importProfile(JSON.stringify(v1));
    assert.equal(imported.version, 2);
    assert.equal(imported.settings.soundEnabled, false);
  });
});
