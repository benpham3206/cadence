/**
 * Session flow.
 *
 * Cadence alternates between reading and repair:
 *
 *   quote → quote → quote → quote → targeted → targeted → (repeat)
 *
 * The targeted phase only engages once the profile actually knows something.
 * Drilling a typist against noise is worse than not drilling them at all, so
 * until enough transitions have been sampled the flow stays on plain quotes.
 */

export const PHASE_QUOTE = 'quote';
export const PHASE_TARGETED = 'targeted';

const DEFAULT_QUOTES_PER_CYCLE = 4;
const DEFAULT_TARGETED_PER_CYCLE = 2;

/** Distinct transitions that must be well-sampled before targeting activates. */
const DEFAULT_MIN_TARGETS = 4;

export class SessionFlow {
  /**
   * @param {{
   *   quotesPerCycle?: number,
   *   targetedPerCycle?: number,
   *   minTargets?: number
   * }} [options]
   */
  constructor(options = {}) {
    this.quotesPerCycle = Math.max(1, options.quotesPerCycle ?? DEFAULT_QUOTES_PER_CYCLE);
    this.targetedPerCycle = Math.max(0, options.targetedPerCycle ?? DEFAULT_TARGETED_PER_CYCLE);
    this.minTargets = options.minTargets ?? DEFAULT_MIN_TARGETS;
    this.position = 0;
    this.completed = 0;
  }

  get cycleLength() {
    return this.quotesPerCycle + this.targetedPerCycle;
  }

  /**
   * Position within the current cycle, 0-indexed.
   */
  get positionInCycle() {
    return this.position % this.cycleLength;
  }

  /**
   * How many texts remain before the targeted phase begins. Zero while in it.
   *
   * @returns {number}
   */
  get untilTargeted() {
    if (this.targetedPerCycle === 0) return Infinity;
    const pos = this.positionInCycle;
    return pos < this.quotesPerCycle ? this.quotesPerCycle - pos : 0;
  }

  /**
   * Decides what the next text should be.
   *
   * @param {{ availableTargets?: number }} [context]
   * @returns {{ phase: typeof PHASE_QUOTE | typeof PHASE_TARGETED, reason: string }}
   */
  nextPhase(context = {}) {
    const availableTargets = context.availableTargets ?? 0;

    if (this.targetedPerCycle === 0) {
      return { phase: PHASE_QUOTE, reason: 'targeted drills disabled' };
    }
    if (availableTargets < this.minTargets) {
      return {
        phase: PHASE_QUOTE,
        reason: `building profile — ${availableTargets}/${this.minTargets} transitions sampled`,
      };
    }
    if (this.positionInCycle < this.quotesPerCycle) {
      return { phase: PHASE_QUOTE, reason: `${this.untilTargeted} to go before targeted practice` };
    }
    return { phase: PHASE_TARGETED, reason: 'targeting your slowest transitions' };
  }

  /**
   * Advances the cycle. Called once per completed text.
   */
  advance() {
    this.position++;
    this.completed++;
  }

  /**
   * Jumps straight to the targeted phase, for an explicit user request.
   */
  forceTargeted() {
    this.position = Math.floor(this.position / this.cycleLength) * this.cycleLength + this.quotesPerCycle;
  }

  /**
   * Returns to reading, ending the targeted phase early.
   */
  forceQuote() {
    this.position = Math.ceil((this.position + 1) / this.cycleLength) * this.cycleLength;
  }

  reset() {
    this.position = 0;
    this.completed = 0;
  }
}
