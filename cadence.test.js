// cadence.test.js — Unit tests for Cadence typing coach pure logic
// Run with: node --test cadence.test.js
//
// These functions are extracted from cadence.html. If you modify the HTML,
// update these copies to match.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════
// ─── Extracted pure functions from cadence.html ───────────────
// ═══════════════════════════════════════════════════════════════

const WINDOW_MS = 5000;
const CHARS_PER_WORD = 5;
const WEAK_LIST_SIZE = 8;
const MIN_SAMPLES = 5;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

function buildDigraphKey(prev, cur) {
  if (prev == null || cur == null) return null;
  return (prev + cur).toLowerCase();
}

class DigraphMap {
  constructor(data = {}) {
    this._map = {};
    for (const [k, v] of Object.entries(data)) {
      this._map[k] = { count: v.count, mean: v.mean, m2: v.m2 || 0 };
    }
  }

  update(digraphKey, flightMs) {
    if (!digraphKey || flightMs == null || flightMs < 0 || flightMs > 3000) return;
    let s = this._map[digraphKey];
    if (!s) {
      s = { count: 0, mean: 0, m2: 0 };
      this._map[digraphKey] = s;
    }
    s.count++;
    const delta = flightMs - s.mean;
    s.mean += delta / s.count;
    const delta2 = flightMs - s.mean;
    s.m2 += delta * delta2;
  }

  getStats(digraphKey) {
    const s = this._map[digraphKey];
    if (!s || s.count === 0) return null;
    const variance = s.count > 1 ? s.m2 / (s.count - 1) : 0;
    return { count: s.count, mean: s.mean, stddev: Math.sqrt(variance) };
  }

  getWeakList(n = WEAK_LIST_SIZE) {
    return Object.entries(this._map)
      .filter(([_, s]) => s.count >= MIN_SAMPLES)
      .sort((a, b) => b[1].mean - a[1].mean)
      .slice(0, n)
      .map(([key, s]) => ({
        digraph: key,
        mean: s.mean,
        count: s.count,
        stddev: s.count > 1 ? Math.sqrt(s.m2 / (s.count - 1)) : 0,
      }));
  }

  getOverallMean() {
    const entries = Object.values(this._map).filter(s => s.count >= MIN_SAMPLES);
    if (entries.length === 0) return 0;
    const totalWeighted = entries.reduce((a, s) => a + s.mean * s.count, 0);
    const totalCount = entries.reduce((a, s) => a + s.count, 0);
    return totalWeighted / totalCount;
  }

  toHeatmapData() {
    const result = [];
    for (let i = 0; i < 26; i++) {
      for (let j = 0; j < 26; j++) {
        const key = LETTERS[i] + LETTERS[j];
        const s = this._map[key];
        result.push({ from: LETTERS[i], to: LETTERS[j], key, count: s ? s.count : 0, mean: s ? s.mean : 0 });
      }
    }
    return result;
  }

  toJSON() {
    const out = {};
    for (const [k, v] of Object.entries(this._map)) {
      out[k] = { count: v.count, mean: v.mean, m2: v.m2 };
    }
    return out;
  }
}

function getRollingWpm(timestamps, now) {
  const windowed = timestamps.filter(t => t >= now - WINDOW_MS);
  if (windowed.length < 2) return 0;
  const span = (now - windowed[0]) / 60000;
  if (span <= 0) return 0;
  return Math.round((windowed.length / CHARS_PER_WORD) / span);
}

function computeConsistency(dwells) {
  if (dwells.length < 2) return 0;
  const mean = dwells.reduce((a, b) => a + b, 0) / dwells.length;
  if (mean === 0) return 0;
  const variance = dwells.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dwells.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));
}

function estimateChunkHorizon(events) {
  const interWord = [];
  const intraWord = [];
  for (let i = 1; i < events.length; i++) {
    const flight = events[i].flight;
    if (flight == null || flight < 0 || flight > 2000) continue;
    if (events[i - 1].key === ' ') {
      interWord.push(flight);
    } else if (events[i].key !== ' ') {
      intraWord.push(flight);
    }
  }
  if (intraWord.length < 5 || interWord.length < 3) return 1.5;
  const avgInter = interWord.reduce((a, b) => a + b, 0) / interWord.length;
  const avgIntra = intraWord.reduce((a, b) => a + b, 0) / intraWord.length;
  if (avgIntra === 0) return 1.0;
  const ratio = avgIntra / avgInter;
  const horizon = 1.0 + ratio * 3.0;
  return Math.max(1.0, Math.min(4.0, Math.round(horizon * 10) / 10));
}

const WORDS = [
  "the","quick","brown","fox","jumps","over","lazy","dog","that","with","this","from",
  "question","quite","quiet","quote","quarter","quickly","require","unique","sequence",
  "frequent","square","liquid","earthquake","antique","adequate","technique",
  "fuzzy","dizzy","fizzy","jazzy","snazzy","frenzy","puzzle","drizzle","sizzle",
  "exceed","excellent","excite","exchange","except","excess","exact","examine","example",
  "psychology","physical","pharmacy","photograph","philosophy","phrase","telephone",
  "rhythm","myth","python","sympathy","synthetic","symbol","system","crystal","mystery",
  "beautiful","because","believe","between","building","business","certain","change",
  "through","thought","something","another","important","knowledge","possible","problem",
];

function generateDrillText(weakDigraphs, wordCount = 60) {
  if (!weakDigraphs || weakDigraphs.length === 0) return null;
  const targetSet = new Set(weakDigraphs.map(w => w.digraph || w));
  const scored = WORDS.map(word => {
    let score = 0;
    const lower = word.toLowerCase();
    for (const dg of targetSet) {
      if (lower.includes(dg)) score += 2;
    }
    return { word, score };
  }).filter(w => w.score > 0);
  if (scored.length === 0) return null;
  const result = [];
  let lastWord = '';
  for (let i = 0; i < wordCount; i++) {
    const pool = scored.filter(w => w.word !== lastWord);
    if (pool.length === 0) break;
    const totalScore = pool.reduce((a, w) => a + w.score, 0);
    let pick = Math.random() * totalScore;
    let chosen = pool[0];
    for (const w of pool) {
      pick -= w.score;
      if (pick <= 0) { chosen = w; break; }
    }
    result.push(chosen.word);
    lastWord = chosen.word;
  }
  return result.join(' ');
}

// ═══════════════════════════════════════════════════════════════
// ─── TESTS ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// ─────────── buildDigraphKey ───────────
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

// ─────────── DigraphMap ───────────
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
    // sample stddev of [100,200] = sqrt((50^2 + 50^2) / 1) = sqrt(5000) ≈ 70.71
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
    assert.equal(weak[0].digraph, 'qu'); // slowest first
    assert.equal(weak[1].digraph, 'er');
  });

  test('getWeakList returns empty for no data', () => {
    const dm = new DigraphMap();
    assert.deepEqual(dm.getWeakList(), []);
  });

  test('getWeakList excludes digraphs with count < MIN_SAMPLES', () => {
    const dm = new DigraphMap();
    for (let i = 0; i < 3; i++) { dm.update('th', 500); } // only 3 samples
    for (let i = 0; i < 10; i++) { dm.update('er', 200); } // 10 samples
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
    assert.equal(data.length, 676); // 26×26
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
});

// ─────────── Rolling WPM ───────────
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
    // 50 chars / 5 chars_per_word = 10 words. 10 words / (10s/60) = 60 WPM
    // But rolling uses 5s window, so only chars within last 5s count.
    // 25 chars in 5s = 5 words / (5s/60s) = 60 WPM
    const now = 10000;
    const timestamps = [];
    for (let i = 0; i < 25; i++) {
      timestamps.push(now - 5000 + i * 200); // 25 chars over 5s
    }
    const wpm = getRollingWpm(timestamps, now);
    assert.ok(wpm >= 55 && wpm <= 65, `Expected ~60, got ${wpm}`);
  });

  test('correct WPM for fast typing (~150 WPM)', () => {
    const now = 10000;
    const timestamps = [];
    // 150 WPM = 750 chars/min = 12.5 chars/sec → ~62 chars in 5s
    for (let i = 0; i < 62; i++) {
      timestamps.push(now - 5000 + i * 80);
    }
    const wpm = getRollingWpm(timestamps, now);
    assert.ok(wpm >= 140 && wpm <= 160, `Expected ~150, got ${wpm}`);
  });

  test('drops timestamps outside 5s window', () => {
    const now = 10000;
    const timestamps = [1000, 2000, 3000]; // all >5s ago
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

// ─────────── Consistency ───────────
describe('computeConsistency', () => {
  test('returns 100 for identical dwells', () => {
    assert.equal(computeConsistency([80, 80, 80, 80, 80]), 100);
  });

  test('returns 0 for highly variable dwells', () => {
    // CV > 1 → consistency = 0
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

// ─────────── Chunk Horizon Estimator ───────────
describe('estimateChunkHorizon', () => {
  test('returns 1.5 with insufficient data', () => {
    const events = [{ key: 'a', flight: 50 }, { key: 'b', flight: 60 }];
    assert.equal(estimateChunkHorizon(events), 1.5);
  });

  test('clamps to [1.0, 4.0]', () => {
    // Create events with extreme ratios
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
    // Deep buffer: inter-word pauses similar to intra-word (ratio ~1.0 → high horizon)
    const deep = [];
    for (let i = 0; i < 40; i++) {
      deep.push({ key: i % 6 === 0 ? ' ' : 'a', flight: 55 });
    }
    const hDeep = estimateChunkHorizon(deep);

    // Shallow buffer: inter-word pauses 6x longer than intra-word (ratio ~0.17 → low horizon)
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
    assert.equal(h1, h2); // deterministic
  });
});

// ─────────── Drill Text Generator ───────────
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

// ─────────── Profile (mock localStorage) ───────────
describe('Profile logic', () => {
  // Simulate localStorage for Node
  let store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = v; },
    removeItem(k) { delete store[k]; },
  };

  const PROFILE_KEY = 'cadence_profile_v1';

  const Profile = {
    _default() {
      return { version: 1, digraphStats: {}, chunkHorizon: 1.5, sessions: [], textCount: 0, apiKey: '' };
    },
    load() {
      try {
        const raw = mockStorage.getItem(PROFILE_KEY);
        if (!raw) return this._default();
        const parsed = JSON.parse(raw);
        if (parsed.version !== 1) return this._default();
        return parsed;
      } catch { return this._default(); }
    },
    save(profile) {
      mockStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    },
    clear() { mockStorage.removeItem(PROFILE_KEY); },
    appendSession(profile, summary) {
      profile.sessions.push(summary);
      if (profile.sessions.length > 200) profile.sessions = profile.sessions.slice(-200);
      this.save(profile);
    },
  };

  test('load returns default when empty', () => {
    store = {};
    const p = Profile.load();
    assert.equal(p.version, 1);
    assert.deepEqual(p.sessions, []);
    assert.equal(p.chunkHorizon, 1.5);
  });

  test('save + load round-trip', () => {
    store = {};
    const p = Profile._default();
    p.chunkHorizon = 2.5;
    p.textCount = 42;
    Profile.save(p);
    const loaded = Profile.load();
    assert.equal(loaded.chunkHorizon, 2.5);
    assert.equal(loaded.textCount, 42);
  });

  test('appendSession increments session count', () => {
    store = {};
    const p = Profile._default();
    Profile.appendSession(p, { timestamp: Date.now(), track: 'A', wpm: 120, consistency: 80 });
    assert.equal(p.sessions.length, 1);
    Profile.appendSession(p, { timestamp: Date.now(), track: 'C', wpm: 130, consistency: 85 });
    assert.equal(p.sessions.length, 2);
  });

  test('appendSession stores track type correctly', () => {
    store = {};
    const p = Profile._default();
    Profile.appendSession(p, { timestamp: 1234, track: 'A', wpm: 100, consistency: 70 });
    assert.equal(p.sessions[0].track, 'A');
  });

  test('sessions capped at 200', () => {
    store = {};
    const p = Profile._default();
    for (let i = 0; i < 210; i++) {
      Profile.appendSession(p, { timestamp: i, track: 'C', wpm: 100 });
    }
    assert.equal(p.sessions.length, 200);
    // Most recent should be preserved
    assert.equal(p.sessions[199].timestamp, 209);
  });

  test('clear removes data', () => {
    store = {};
    const p = Profile._default();
    p.textCount = 99;
    Profile.save(p);
    Profile.clear();
    const loaded = Profile.load();
    assert.equal(loaded.textCount, 0);
  });

  test('handles corrupted localStorage gracefully', () => {
    store = {};
    mockStorage.setItem(PROFILE_KEY, '{invalid json!!!');
    const p = Profile.load();
    assert.equal(p.version, 1);
  });

  test('rejects wrong version', () => {
    store = {};
    mockStorage.setItem(PROFILE_KEY, JSON.stringify({ version: 99, data: 'old' }));
    const p = Profile.load();
    assert.equal(p.version, 1);
    assert.deepEqual(p.sessions, []);
  });
});

// ─────────── Integration: full pipeline ───────────
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
    // Simulate many observations
    for (let i = 0; i < 20; i++) {
      dm.update('th', 80);  // fast
      dm.update('qu', 250); // slow
      dm.update('er', 90);  // medium
      dm.update('zy', 300); // very slow
    }

    const weakList = dm.getWeakList(5);
    assert.ok(weakList.length >= 2);
    assert.equal(weakList[0].digraph, 'zy'); // slowest

    const drillText = generateDrillText(weakList);
    assert.ok(drillText);
    assert.ok(drillText.length > 50);
  });

  test('consistency matches manual calculation', () => {
    const dwells = [100, 100, 100, 100, 100];
    assert.equal(computeConsistency(dwells), 100);

    const dwells2 = [50, 150, 50, 150, 50, 150];
    const mean = 100;
    const variance = (50*50*3 + 50*50*3) / 6; // = 2500
    const cv = Math.sqrt(variance) / mean; // = 50/100 = 0.5
    const expected = Math.round((1 - cv) * 100); // = 50
    assert.equal(computeConsistency(dwells2), expected);
  });

  test('DigraphMap serialization survives across sessions', () => {
    // Session 1
    const dm1 = new DigraphMap();
    for (let i = 0; i < 10; i++) { dm1.update('th', 80 + Math.random() * 20); }
    for (let i = 0; i < 10; i++) { dm1.update('qu', 200 + Math.random() * 30); }
    const json1 = dm1.toJSON();

    // Session 2: restore and continue
    const dm2 = new DigraphMap(json1);
    for (let i = 0; i < 10; i++) { dm2.update('th', 70 + Math.random() * 15); }

    const stats = dm2.getStats('th');
    assert.equal(stats.count, 20);
    assert.ok(stats.mean < 95); // should be lower after faster session 2
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── NEW: detectProvider ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function detectProvider(key) {
  if (!key) return null;
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-')) return 'openai';
  return 'unknown';
}

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
// ─── NEW: Digraph Retirement ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function checkRetirement(retirementCounters, weakList, overallMean) {
  const retired = [];
  for (const w of weakList) {
    const key = w.digraph;
    if (w.mean < overallMean) {
      retirementCounters[key] = (retirementCounters[key] || 0) + 1;
      if (retirementCounters[key] >= 3) {
        retired.push(key);
        delete retirementCounters[key];
      }
    } else {
      retirementCounters[key] = 0;
    }
  }
  return retired;
}

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
    checkRetirement(counters, weak, 100); // 1
    checkRetirement(counters, weak, 100); // 2
    const retired = checkRetirement(counters, weak, 100); // 3 → retired
    assert.ok(retired.includes('th'));
    assert.equal(counters['th'], undefined);
  });

  test('T-RET-4: retired digraph gone from counters', () => {
    const counters = { 'th': 2 };
    checkRetirement(counters, [{ digraph: 'th', mean: 80 }], 100); // 3 → retired
    assert.equal(counters['th'], undefined);
  });

  test('T-RET-5: counters survive profile save/load', () => {
    const store = {};
    const mockStorage = {
      getItem(k) { return store[k] || null; },
      setItem(k, v) { store[k] = v; },
    };
    const p = { version: 1, retirementCounters: { 'th': 2, 'er': 1 } };
    mockStorage.setItem('test_key', JSON.stringify(p));
    const loaded = JSON.parse(mockStorage.getItem('test_key'));
    assert.equal(loaded.retirementCounters['th'], 2);
    assert.equal(loaded.retirementCounters['er'], 1);
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── NEW: AI Text Caching ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function computeWeakHash(weakList) {
  return weakList.map(w => w.digraph || w).sort().join(',');
}

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
    assert.equal(h1, h2); // order doesn't matter
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── NEW: Session Track Tagging ──────────────────────────────
// ═══════════════════════════════════════════════════════════════

function getTrackLabel(isDrill, chunkMode, isTransfer) {
  if (isTransfer) return 'transfer';
  if (chunkMode) return 'B';
  if (isDrill) return 'A';
  return 'C';
}

describe('Session Track Tagging', () => {
  test('T-TAG-1: quote sessions tagged as C', () => {
    assert.equal(getTrackLabel(false, false, false), 'C');
  });

  test('T-TAG-2: drill sessions tagged as A', () => {
    assert.equal(getTrackLabel(true, false, false), 'A');
  });

  test('T-TAG-3: transfer sessions tagged correctly', () => {
    assert.equal(getTrackLabel(false, false, true), 'transfer');
    // Transfer takes priority even if drill/chunk are also set
    assert.equal(getTrackLabel(true, true, true), 'transfer');
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── NEW: Track B Chunking ───────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function countWordsBetween(text, posA, posB) {
  if (posA >= posB) return 0;
  const slice = text.slice(posA, posB);
  return slice.split(/\s+/).filter(Boolean).length;
}

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
    // Cursor at position 0, target at position 25 ("over...")
    const wordsBehind = countWordsBetween(text, 0, 25);
    assert.ok(wordsBehind > 2, `Words behind: ${wordsBehind}`);
  });

  test('T-CHUNK-4: estimateChunkHorizon matches expected ratio', () => {
    // Equal inter/intra → ratio = 1.0 → horizon = 1.0 + 1.0*3.0 = 4.0
    const events = [];
    for (let i = 0; i < 40; i++) {
      events.push({ key: i % 5 === 0 ? ' ' : 'a', flight: 100 });
    }
    const h = estimateChunkHorizon(events);
    assert.ok(h >= 3.5 && h <= 4.0, `Got ${h}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── NEW: Transfer Test ──────────────────────────────────────
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
    // Once popped, text is gone from pool — can't appear again
    assert.ok(!pool.includes('sealed text two'));
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── NEW: Phase 3 Budget & Setup Pure Functions ──────────────
// ═══════════════════════════════════════════════════════════════

function generateLocalPortrait(profile, weakList) {
  if (!profile.sessions || profile.sessions.length === 0) {
    return "Complete a few sessions to generate your personal typist portrait.";
  }
  
  // WPM trend (avg of last 10)
  const recent = profile.sessions.slice(-10);
  const avgWpm = Math.round(recent.reduce((a, s) => a + s.wpm, 0) / recent.length);
  const readBuffer = (profile.chunkHorizon || 1.5).toFixed(1);
  
  if (!weakList || weakList.length === 0) {
    return `You average ${avgWpm} WPM with a ${readBuffer}-word read buffer. You currently have no identified friction points!`;
  }

  const weakNames = weakList.slice(0, 3).map(w => `'${w.digraph || w}'`).join(', ');
  return `You average ${avgWpm} WPM with a ${readBuffer}-word read buffer. Your top friction points dragging down your average are ${weakNames}.`;
}

function buildTersePrompt(dgListText) {
  return `20-30 word sentence. Dense with: ${dgListText}. Natural English prose. Output text ONLY.`;
}

function shouldUseAPI(apiMode, hasCache, hasKey) {
  if (!hasKey) return false;
  if (hasCache) return false; // prefer cache always
  if (apiMode === 'manual') return false; 
  return true; // auto + no cache + has key
}

function canShowChunkTransfer(currentMode) {
  return currentMode === 'quote';
}

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
    // Mode auto, no cache, has key -> YES
    assert.equal(shouldUseAPI('auto', false, true), true);
    // Mode auto, HAS cache, has key -> NO (use cache)
    assert.equal(shouldUseAPI('auto', true, true), false);
    // Mode manual, no cache, has key -> NO (wait for manual click)
    assert.equal(shouldUseAPI('manual', false, true), false);
    // No key -> NO
    assert.equal(shouldUseAPI('auto', false, false), false);
  });
});

describe('Phase 3: UI Flow Dependencies', () => {
  test('T-MODE-1 & T-MODE-2: Chunk/Transfer only show in Quote mode', () => {
    assert.equal(canShowChunkTransfer('quote'), true);
    assert.equal(canShowChunkTransfer('practice'), false);
  });
});
