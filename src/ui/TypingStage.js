/**
 * The typing surface.
 *
 * Two constraints shape this component:
 *
 *   1. Keystroke handling must never re-render the passage. Characters are
 *      rendered once into a flat index, and typing only toggles classes on a
 *      single span and moves the caret via transform.
 *   2. Caret position is read from layout rather than computed, so wrapping,
 *      font loading and zoom all stay correct without duplicating the browser's
 *      line-breaking logic.
 */

const IDLE_BLINK_DELAY_MS = 900;

export class TypingStage {
  /**
   * @param {HTMLElement} root
   */
  constructor(root) {
    this.root = root;

    /** @type {HTMLElement[]} */
    this.charEls = [];
    this.text = '';
    this.lineOffset = 0;
    this.cursorIndex = 0;
    this._cachedLineHeight = 0;
    this.idleTimer = null;

    root.innerHTML = `
      <div class="stage__phase">
        <span class="stage__phase-dots" id="phase-dots"></span>
        <span id="phase-label"></span>
        <span class="stage__targets" id="phase-targets"></span>
      </div>

      <div class="typer" id="typer">
        <div class="typer__scroll" id="typer-scroll">
          <div class="typer__text" id="typer-text"></div>
          <!-- Inside the scroller: character offsets are measured against it, so
               the caret must share that coordinate space or it lags a line
               behind once the passage starts scrolling. -->
          <div class="caret" id="caret"></div>
        </div>
        <div class="typer__veil" id="typer-veil">
          <span>click or press any key to focus</span>
        </div>
        <textarea class="typer__input" id="typer-input" autocomplete="off" autocorrect="off"
                  autocapitalize="off" spellcheck="false" aria-label="Typing input"></textarea>
      </div>

      <div class="typer__source" id="typer-source"></div>

      <div class="livebar livebar--hidden" id="livebar">
        <span class="livebar__stat livebar__stat--wpm"><span class="livebar__value" id="live-wpm">0</span> wpm</span>
        <span class="livebar__stat"><span class="livebar__value livebar__value--muted" id="live-acc">100</span>% acc</span>
        <span class="livebar__stat"><span class="livebar__value livebar__value--muted" id="live-progress">0</span>% done</span>
      </div>
    `;

    this.els = {
      typer: /** @type {HTMLElement} */ (root.querySelector('#typer')),
      scroll: /** @type {HTMLElement} */ (root.querySelector('#typer-scroll')),
      text: /** @type {HTMLElement} */ (root.querySelector('#typer-text')),
      caret: /** @type {HTMLElement} */ (root.querySelector('#caret')),
      veil: /** @type {HTMLElement} */ (root.querySelector('#typer-veil')),
      input: /** @type {HTMLTextAreaElement} */ (root.querySelector('#typer-input')),
      source: /** @type {HTMLElement} */ (root.querySelector('#typer-source')),
      phaseDots: /** @type {HTMLElement} */ (root.querySelector('#phase-dots')),
      phaseLabel: /** @type {HTMLElement} */ (root.querySelector('#phase-label')),
      phaseTargets: /** @type {HTMLElement} */ (root.querySelector('#phase-targets')),
      livebar: /** @type {HTMLElement} */ (root.querySelector('#livebar')),
      liveWpm: /** @type {HTMLElement} */ (root.querySelector('#live-wpm')),
      liveAcc: /** @type {HTMLElement} */ (root.querySelector('#live-acc')),
      liveProgress: /** @type {HTMLElement} */ (root.querySelector('#live-progress')),
    };

    this.els.typer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.focus();
    });
    this.els.input.addEventListener('focus', () => this._setFocused(true));
    this.els.input.addEventListener('blur', () => this._setFocused(false));


    window.addEventListener('resize', () => this.refreshCaret());
  }

  /**
   * Shows or hides the focus veil to match reality.
   *
   * Called from the app's existing tick rather than only from focus and blur
   * events. Those events do not fire in every path that changes the active
   * element, and a veil that disagrees with where the keystrokes are going is
   * worse than no veil at all.
   */
  syncFocusVeil() {
    this._setFocused(this.hasFocus);
  }

  /** @param {boolean} focused */
  _setFocused(focused) {
    this.els.veil.classList.toggle('typer__veil--visible', !focused);
  }

  /**
   * Whether keystrokes belong to the passage.
   *
   * Read from the DOM rather than cached from focus events: `focus()` can move
   * the active element without firing an event when the window itself is not
   * focused, and a cached flag that says "blurred" while the input is active
   * swallows every keystroke the typist makes.
   */
  get hasFocus() {
    return document.activeElement === this.els.input;
  }

  focus() {
    this.els.input.focus({ preventScroll: true });
    this._setFocused(this.hasFocus);
  }

  get inputEl() {
    return this.els.input;
  }

  /**
   * Renders a passage. Words are wrapped in inline-block spans so the browser
   * breaks lines between words rather than mid-word.
   *
   * @param {string} text
   * @param {string} source
   */
  render(text, source) {
    this.text = text;
    this.charEls = [];
    this.lineOffset = 0;
    this.els.scroll.style.transform = 'translateY(0)';

    const fragment = document.createDocumentFragment();
    let word = document.createElement('span');
    word.className = 'word';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const span = document.createElement('span');
      span.className = char === ' ' ? 'char char--space' : 'char';
      span.textContent = char === ' ' ? '\u00a0' : char;
      this.charEls.push(span);

      if (char === ' ') {
        // The space belongs to the outgoing word so a trailing space never
        // lands alone at the start of the next line.
        word.appendChild(span);
        fragment.appendChild(word);
        word = document.createElement('span');
        word.className = 'word';
      } else {
        word.appendChild(span);
      }
    }
    if (word.childNodes.length > 0) fragment.appendChild(word);

    this.els.text.replaceChildren(fragment);
    this.els.source.textContent = source ? `— ${source}` : '';
    this.setCursor(0);
    this.setLive({ wpm: 0, accuracy: 100, progress: 0 });
    this.els.livebar.classList.add('livebar--hidden');
  }

  /**
   * @param {number} index
   * @param {'correct'|'incorrect'} state
   */
  markChar(index, state) {
    const el = this.charEls[index];
    if (!el) return;
    el.classList.remove('char--correct', 'char--incorrect');
    el.classList.add(state === 'correct' ? 'char--correct' : 'char--incorrect');
  }

  /** @param {number} index */
  clearChar(index) {
    this.charEls[index]?.classList.remove('char--correct', 'char--incorrect');
  }

  /**
   * Moves the caret and scrolls the passage when the cursor drops to a new line.
   *
   * @param {number} index
   */
  setCursor(index) {
    this.cursorIndex = index;
    const target = this.charEls[index] ?? this.charEls[this.charEls.length - 1];
    if (!target) return;

    const atEnd = index >= this.charEls.length;
    const left = target.offsetLeft + (atEnd ? target.offsetWidth : 0);
    const top = target.offsetTop;

    this.els.caret.style.transform = `translate(${left}px, ${top}px)`;
    this._scrollToLine(top);
    this._resetIdleBlink();
  }

  /**
   * Keeps the active line as the middle of the three visible lines once the
   * passage is long enough to scroll.
   *
   * @param {number} charTop
   */
  _scrollToLine(charTop) {
    const lineHeight = this._lineHeight();
    if (lineHeight <= 0) return;

    const currentLine = Math.round(charTop / lineHeight);
    const desiredOffset = Math.max(0, currentLine - 1) * lineHeight;

    if (desiredOffset !== this.lineOffset) {
      this.lineOffset = desiredOffset;
      this.els.scroll.style.transform = `translateY(${-desiredOffset}px)`;
    }
  }

  _lineHeight() {
    if (this._cachedLineHeight) return this._cachedLineHeight;
    const first = this.charEls[0];
    if (!first) return 0;
    const styles = getComputedStyle(this.els.text);
    this._cachedLineHeight = parseFloat(styles.lineHeight) || first.offsetHeight;
    return this._cachedLineHeight;
  }

  /** Recomputes caret placement after a resize or font swap. */
  refreshCaret() {
    this._cachedLineHeight = 0;
    this.setCursor(this.cursorIndex);
  }

  _resetIdleBlink() {
    this.els.caret.classList.remove('caret--idle');
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.els.caret.classList.add('caret--idle'), IDLE_BLINK_DELAY_MS);
  }

  /**
   * @param {{ wpm: number, accuracy: number, progress: number }} stats
   */
  setLive({ wpm, accuracy, progress }) {
    this.els.livebar.classList.remove('livebar--hidden');
    this.els.liveWpm.textContent = String(Math.round(wpm));
    this.els.liveAcc.textContent = String(Math.round(accuracy));
    this.els.liveProgress.textContent = String(Math.round(progress));
  }

  /**
   * Renders the cycle position: filled dots for completed texts, a diamond for
   * targeted drills, so the typist can see the repair phase coming.
   *
   * @param {{
   *   label: string,
   *   quotesPerCycle: number,
   *   targetedPerCycle: number,
   *   positionInCycle: number,
   *   targets?: Array<{ digraph: string, count: number }>
   * }} state
   */
  setPhase({ label, quotesPerCycle, targetedPerCycle, positionInCycle, targets = [] }) {
    const dots = [];
    const total = quotesPerCycle + targetedPerCycle;

    for (let i = 0; i < total; i++) {
      const isTargeted = i >= quotesPerCycle;
      const classes = ['phase-dot'];
      if (isTargeted) classes.push('phase-dot--targeted');
      if (i === positionInCycle) classes.push('phase-dot--active');
      else if (i < positionInCycle) classes.push('phase-dot--done');
      dots.push(`<span class="${classes.join(' ')}"></span>`);
    }

    this.els.phaseDots.innerHTML = dots.join('');
    this.els.phaseLabel.textContent = label;
    this.els.phaseTargets.innerHTML = targets
      .map(
        (t) =>
          `<span class="target-chip">${escapeHtml(t.digraph)}<span class="target-chip__count">x${t.count}</span></span>`
      )
      .join('');
  }
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}
