import { fingerForChar, FINGER_LABELS, isSameFingerBigram } from './keyboard-layout.js';

/**
 * Diagnostic tips derived from a completed run.
 *
 * Every tip must name something the typist can change on the next passage.
 * "Type faster" is not a tip; "sc is a same-finger transition, roll it instead
 * of lifting" is.
 */

/** Below this many keystrokes there is not enough signal to say anything. */
const MIN_STROKES = 25;

/** Second-half dwell must exceed the first half by this factor to call fatigue. */
const FATIGUE_RATIO = 1.2;

/** Accuracy under this suggests speed is outrunning control. */
const ACCURACY_FLOOR = 96;

/**
 * @typedef {{ kind: string, message: string, severity: 'info'|'warn'|'good' }} Tip
 */

/**
 * @param {{
 *   dwells: number[],
 *   accuracy: number,
 *   consistency: number,
 *   weakDigraphs: Array<{ digraph: string, mean: number }>,
 *   wpm: number
 * }} run
 * @param {number} [limit]
 * @returns {Tip[]}
 */
export function analyzeRun(run, limit = 3) {
  /** @type {Tip[]} */
  const tips = [];
  const { dwells = [], accuracy = 100, consistency = 0, weakDigraphs = [], wpm = 0 } = run ?? {};

  if (dwells.length >= MIN_STROKES) {
    const mid = Math.floor(dwells.length / 2);
    const firstHalf = dwells.slice(0, mid);
    const secondHalf = dwells.slice(mid);
    const avgFirst = mean(firstHalf);
    const avgSecond = mean(secondHalf);

    if (avgFirst > 0 && avgSecond > avgFirst * FATIGUE_RATIO) {
      tips.push({
        kind: 'fatigue',
        severity: 'warn',
        message: 'Your key dwell climbed through the passage. Reset your hands to home row and breathe.',
      });
    }
  }

  if (accuracy < ACCURACY_FLOOR && wpm > 0) {
    tips.push({
      kind: 'accuracy',
      severity: 'warn',
      message: `Accuracy ${accuracy.toFixed(0)}% — at this speed, corrections cost more than the pace gains.`,
    });
  }

  for (const weak of weakDigraphs.slice(0, 3)) {
    const digraph = weak?.digraph;
    if (typeof digraph !== 'string' || digraph.length !== 2) continue;

    if (isSameFingerBigram(digraph[0], digraph[1])) {
      const finger = fingerForChar(digraph[0]);
      tips.push({
        kind: 'same-finger',
        severity: 'info',
        message: `"${digraph}" uses the ${FINGER_LABELS[finger ?? ''] ?? 'same finger'} twice. Roll the motion instead of lifting and resetting.`,
      });
      continue;
    }

    const fromFinger = fingerForChar(digraph[0]);
    const toFinger = fingerForChar(digraph[1]);
    if (fromFinger && toFinger && sameHand(fromFinger, toFinger) && isPinkyReach(digraph)) {
      tips.push({
        kind: 'pinky-reach',
        severity: 'info',
        message: `"${digraph}" is a pinky stretch on one hand. Let the whole hand shift rather than splaying the finger.`,
      });
    }
  }

  if (consistency > 90 && dwells.length >= MIN_STROKES) {
    tips.push({
      kind: 'consistency',
      severity: 'good',
      message: 'Rhythm is very even — your motor pattern for this material is automatic.',
    });
  }

  return tips.slice(0, limit);
}

/**
 * @param {number[]} values
 * @returns {number}
 */
function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * @param {string} a
 * @param {string} b
 */
function sameHand(a, b) {
  return a[0] === b[0];
}

/**
 * @param {string} digraph
 */
function isPinkyReach(digraph) {
  return [digraph[0], digraph[1]].some((ch) => fingerForChar(ch)?.endsWith('pinky'));
}
