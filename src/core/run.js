/**
 * A single attempt at one passage.
 *
 * Holds all per-run state so the app layer stays a thin adapter between DOM
 * events and this model, and so the scoring rules are testable without a browser.
 *
 * Two measurement rules matter here:
 *
 *   1. Only correct keystrokes contribute digraph timings. An error is followed
 *      by a recovery pause that has nothing to do with the transition being
 *      measured, and folding those in makes every digraph look slow.
 *   2. Flight time is measured keydown-to-keydown. Keyup timing varies with how
 *      long a typist holds a key, which is dwell, not travel.
 *
 * A wrong key marks the character and holds position: the passage only advances
 * on the right key, so the text typed always matches the text shown and there
 * is nothing to undo. The transition following a miss is still discarded, since
 * its timing is recovery rather than travel.
 */

/** Flight times beyond this are treated as the typist stopping, not typing. */
export const MAX_CREDIBLE_FLIGHT_MS = 2000;

export const PRESS = {
  CORRECT: 'correct',
  INCORRECT: 'incorrect',
  COMPLETE: 'complete',
  IGNORED: 'ignored',
};

export class Run {
  /**
   * @param {string} text
   */
  constructor(text) {
    this.text = text;

    this.cursor = 0;
    // Null rather than 0: a timestamp of zero is legitimate, and treating it as
    // "not started" restarts the clock on the second keystroke.
    /** @type {number|null} */
    this.startedAt = null;
    /** @type {number|null} */
    this.finishedAt = null;

    this.correctPresses = 0;
    this.incorrectPresses = 0;

    /** Indices marked wrong right now, cleared when the right key lands. */
    this.errorIndices = new Set();
    /** Indices that were ever wrong, for per-passage error reporting. */
    this.everWrong = new Set();

    /** @type {number[]} */
    this.dwells = [];
    /** @type {Array<{ char: string, flight: number|null, index: number }>} */
    this.strokes = [];
    /** @type {Array<{ digraph: string, flight: number }>} */
    this.digraphSamples = [];

    this._lastCorrectDownAt = null;
    this._prevCorrectChar = null;
  }

  get started() {
    return this.startedAt !== null;
  }

  get complete() {
    return this.cursor >= this.text.length;
  }

  get expectedChar() {
    return this.cursor < this.text.length ? this.text[this.cursor] : null;
  }

  get totalPresses() {
    return this.correctPresses + this.incorrectPresses;
  }

  /**
   * Share of keystrokes that were correct on first contact.
   * @returns {number} 0-100
   */
  get accuracy() {
    if (this.totalPresses === 0) return 100;
    return (this.correctPresses / this.totalPresses) * 100;
  }

  /** @returns {number} 0-100 */
  get progress() {
    if (this.text.length === 0) return 100;
    return (this.cursor / this.text.length) * 100;
  }

  /**
   * @param {number} [now]
   * @returns {number} elapsed milliseconds
   */
  elapsedMs(now) {
    if (this.startedAt === null) return 0;
    const end = this.finishedAt ?? now ?? this.startedAt;
    return Math.max(0, end - this.startedAt);
  }

  /**
   * Net WPM over the whole run: correctly typed characters divided by five,
   * per minute. This is the number that should be compared across sessions.
   *
   * @param {number} [now]
   * @returns {number}
   */
  wpm(now) {
    const ms = this.elapsedMs(now);
    if (ms <= 0) return 0;
    // The cursor only moves on a correct key, so it is the count of characters
    // standing correct in the passage.
    return (this.cursor / 5) / (ms / 60000);
  }

  /**
   * Registers a keystroke against the passage.
   *
   * @param {string} char        The character produced by the key.
   * @param {number} downAt      Timestamp of the keydown, in ms.
   * @returns {{ status: string, index: number, expected: string|null }}
   */
  press(char, downAt) {
    if (this.complete) {
      return { status: PRESS.IGNORED, index: this.cursor, expected: null };
    }
    if (this.startedAt === null) this.startedAt = downAt;

    const index = this.cursor;
    const expected = this.text[index];

    if (char !== expected) {
      this.incorrectPresses++;
      this.errorIndices.add(index);
      this.everWrong.add(index);
      // A miss invalidates the next transition: whatever follows is a recovery
      // move, not a representative sample of that digraph.
      this._prevCorrectChar = null;
      this._lastCorrectDownAt = null;

      return { status: PRESS.INCORRECT, index, expected };
    }

    const flight = this._lastCorrectDownAt === null ? null : downAt - this._lastCorrectDownAt;
    const credibleFlight = flight !== null && flight > 0 && flight < MAX_CREDIBLE_FLIGHT_MS ? flight : null;

    if (this._prevCorrectChar !== null && credibleFlight !== null) {
      this.digraphSamples.push({
        digraph: (this._prevCorrectChar + char).toLowerCase(),
        flight: credibleFlight,
      });
    }

    this.strokes.push({ char, flight: credibleFlight, index });
    this._prevCorrectChar = char;
    this._lastCorrectDownAt = downAt;

    this.correctPresses++;
    this.errorIndices.delete(index);
    this.cursor++;

    if (this.complete) {
      this.finishedAt = downAt;
      return { status: PRESS.COMPLETE, index, expected };
    }
    return { status: PRESS.CORRECT, index, expected };
  }

  /**
   * Records how long a key was held. Dwell drives the consistency metric.
   *
   * @param {number} dwellMs
   */
  recordDwell(dwellMs) {
    if (typeof dwellMs !== 'number' || dwellMs <= 0 || dwellMs > 1000) return;
    this.dwells.push(dwellMs);
  }
}
