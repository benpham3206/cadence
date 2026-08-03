/**
 * Slow-section detection.
 *
 * Global digraph averages tell you what is slow across your whole history.
 * They are noisy about what went wrong *in the quote you just typed*. This
 * module finds the specific stretches where the typist's instantaneous rhythm
 * broke down, so the next targeted quote can address a stumble that happened
 * thirty seconds ago rather than a statistical tendency from last week.
 */

/** Keystrokes per rolling window used to smooth instantaneous speed. */
const DEFAULT_WINDOW = 5;

/** A window is "slow" once its mean flight exceeds the run mean by this factor. */
const DEFAULT_THRESHOLD = 1.35;

/** Flight times outside this range are treated as pauses or artefacts, not typing. */
const MAX_CREDIBLE_FLIGHT_MS = 2000;

/**
 * @typedef {{ char: string, flight: number|null, index: number }} Stroke
 */

/**
 * @typedef {{
 *   startIndex: number,
 *   endIndex: number,
 *   meanFlight: number,
 *   ratio: number,
 *   text: string,
 *   digraphs: string[]
 * }} SlowSection
 */

/**
 * @param {Stroke[]} strokes  Correct keystrokes in typing order.
 * @param {{ window?: number, threshold?: number }} [options]
 * @returns {SlowSection[]} Sections ordered worst-first.
 */
export function findSlowSections(strokes, options = {}) {
  const { window = DEFAULT_WINDOW, threshold = DEFAULT_THRESHOLD } = options;

  if (!Array.isArray(strokes) || strokes.length < window + 1) return [];

  const usable = strokes.filter(
    (s) => typeof s?.flight === 'number' && s.flight > 0 && s.flight < MAX_CREDIBLE_FLIGHT_MS
  );
  if (usable.length < window + 1) return [];

  const runMean = usable.reduce((sum, s) => sum + /** @type {number} */ (s.flight), 0) / usable.length;
  if (runMean <= 0) return [];

  /** @type {Array<{ start: number, end: number, mean: number }>} */
  const slowWindows = [];

  for (let i = 0; i + window <= usable.length; i++) {
    let total = 0;
    for (let j = i; j < i + window; j++) total += /** @type {number} */ (usable[j].flight);
    const mean = total / window;
    if (mean > runMean * threshold) {
      slowWindows.push({ start: i, end: i + window - 1, mean });
    }
  }

  if (slowWindows.length === 0) return [];

  // Merge overlapping or adjacent windows so one stumble reports as one section.
  /** @type {Array<{ start: number, end: number, mean: number }>} */
  const merged = [];
  for (const w of slowWindows) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end + 1) {
      last.end = Math.max(last.end, w.end);
      last.mean = Math.max(last.mean, w.mean);
    } else {
      merged.push({ ...w });
    }
  }

  return merged
    .map((section) => {
      const slice = usable.slice(section.start, section.end + 1);
      const text = slice.map((s) => s.char).join('');
      const digraphs = [];
      for (let i = 0; i < slice.length - 1; i++) {
        const pair = (slice[i].char + slice[i + 1].char).toLowerCase();
        if (pair.length === 2) digraphs.push(pair);
      }
      const meanFlight = slice.reduce((sum, s) => sum + /** @type {number} */ (s.flight), 0) / slice.length;
      return {
        startIndex: slice[0].index,
        endIndex: slice[slice.length - 1].index,
        meanFlight,
        ratio: meanFlight / runMean,
        text,
        digraphs,
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/**
 * Reduces detected sections to a ranked digraph list suitable for targeting.
 *
 * A digraph that appears in several slow sections, or in a badly slow one,
 * outranks a single mild stumble.
 *
 * @param {SlowSection[]} sections
 * @param {number} [limit]
 * @returns {Array<{ digraph: string, weight: number, occurrences: number }>}
 */
export function digraphsFromSections(sections, limit = 8) {
  /** @type {Map<string, { weight: number, occurrences: number }>} */
  const tally = new Map();

  for (const section of sections) {
    const excess = Math.max(0, section.ratio - 1);
    for (const digraph of section.digraphs) {
      const current = tally.get(digraph) ?? { weight: 0, occurrences: 0 };
      current.weight += excess;
      current.occurrences += 1;
      tally.set(digraph, current);
    }
  }

  return [...tally.entries()]
    .map(([digraph, stats]) => ({ digraph, weight: stats.weight, occurrences: stats.occurrences }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}

/**
 * Blends the long-run profile with what just went wrong.
 *
 * Recency matters for motor learning, so a fresh stumble is boosted, but the
 * persistent profile still anchors the list — otherwise every drill would chase
 * whatever noise appeared in the last quote.
 *
 * @param {Array<{digraph:string, mean:number}>} profileWeak  From DigraphMap.getWeakList().
 * @param {Array<{digraph:string, weight:number}>} recentSlow  From digraphsFromSections().
 * @param {{ overallMean?: number, recencyBoost?: number, limit?: number }} [options]
 * @returns {Array<{ digraph: string, mean: number, source: 'profile'|'recent'|'both' }>}
 */
export function mergeTargets(profileWeak, recentSlow, options = {}) {
  const { overallMean = 0, recencyBoost = 0.5, limit = 8 } = options;

  /** @type {Map<string, { mean: number, score: number, source: 'profile'|'recent'|'both' }>} */
  const combined = new Map();

  for (const entry of profileWeak ?? []) {
    if (!entry?.digraph) continue;
    const deficit = overallMean > 0 ? (entry.mean - overallMean) / overallMean : 0;
    combined.set(entry.digraph, { mean: entry.mean, score: Math.max(0.1, deficit), source: 'profile' });
  }

  for (const entry of recentSlow ?? []) {
    if (!entry?.digraph) continue;
    const existing = combined.get(entry.digraph);
    if (existing) {
      existing.score += entry.weight * recencyBoost;
      existing.source = 'both';
    } else {
      // A digraph seen only in this run has no reliable profile mean yet, so
      // synthesise one above baseline to keep the weighting math consistent.
      const mean = overallMean > 0 ? overallMean * (1 + entry.weight) : entry.weight;
      combined.set(entry.digraph, { mean, score: entry.weight * recencyBoost, source: 'recent' });
    }
  }

  return [...combined.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([digraph, stats]) => ({ digraph, mean: stats.mean, source: stats.source }));
}
