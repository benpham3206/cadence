const WEAK_LIST_SIZE = 8;
const MIN_SAMPLES = 5;
export const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function buildDigraphKey(prev, cur) {
  if (prev == null || cur == null) return null;
  return (prev + cur).toLowerCase();
}

export class DigraphMap {
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
    return {
      count: s.count,
      mean: s.mean,
      stddev: Math.sqrt(variance),
    };
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
        result.push({
          from: LETTERS[i],
          to: LETTERS[j],
          key,
          count: s ? s.count : 0,
          mean: s ? s.mean : 0,
        });
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
