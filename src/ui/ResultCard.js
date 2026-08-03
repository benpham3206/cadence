/**
 * Post-passage result.
 *
 * Shown between passages rather than during them. It auto-dismisses so a
 * session stays continuous — at 130 WPM a quote takes about eight seconds, and
 * a modal that demands a click every eight seconds destroys the rhythm the app
 * is trying to build. Any keystroke dismisses it immediately.
 */

const AUTO_DISMISS_MS = 1700;

export class ResultCard {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.root = root;
    this.timer = null;
    /** @type {(() => void)|null} */
    this.onDismiss = null;

    root.innerHTML = `
      <div class="result" id="result-layer">
        <div class="result__card">
          <div class="result__headline">
            <div>
              <span class="result__wpm" id="result-wpm">0</span>
              <span class="result__wpm-unit">wpm</span>
            </div>
            <span class="result__delta" id="result-delta"></span>
          </div>
          <div class="result__grid" id="result-grid"></div>
          <ul class="result__tips" id="result-tips"></ul>
          <div class="result__actions">
            <span>next passage loading — press any key to continue</span>
          </div>
        </div>
      </div>
    `;

    this.els = {
      layer: /** @type {HTMLElement} */ (root.querySelector('#result-layer')),
      wpm: /** @type {HTMLElement} */ (root.querySelector('#result-wpm')),
      delta: /** @type {HTMLElement} */ (root.querySelector('#result-delta')),
      grid: /** @type {HTMLElement} */ (root.querySelector('#result-grid')),
      tips: /** @type {HTMLElement} */ (root.querySelector('#result-tips')),
    };
  }

  get visible() {
    return this.els.layer.classList.contains('result--visible');
  }

  /**
   * @param {{
   *   wpm: number,
   *   accuracy: number,
   *   consistency: number,
   *   errors: number,
   *   seconds: number,
   *   deltaVsAverage: number|null,
   *   tips: Array<{ message: string, severity: string }>
   * }} summary
   * @param {() => void} onDismiss
   */
  show(summary, onDismiss) {
    this.onDismiss = onDismiss;

    this.els.wpm.textContent = String(Math.round(summary.wpm));

    if (summary.deltaVsAverage === null) {
      this.els.delta.textContent = '';
      this.els.delta.className = 'result__delta';
    } else {
      const delta = summary.deltaVsAverage;
      const rounded = Math.round(Math.abs(delta));
      const direction = delta >= 0 ? 'up' : 'down';
      this.els.delta.textContent =
        rounded === 0 ? 'on par with your average' : `${delta >= 0 ? '+' : '-'}${rounded} vs your average`;
      this.els.delta.className = `result__delta result__delta--${direction}`;
    }

    const cells = [
      { label: 'ACCURACY', value: `${summary.accuracy.toFixed(1)}%` },
      { label: 'CONSISTENCY', value: `${Math.round(summary.consistency)}%` },
      { label: 'ERRORS', value: String(summary.errors) },
      { label: 'TIME', value: `${summary.seconds.toFixed(1)}s` },
    ];

    this.els.grid.innerHTML = cells
      .map(
        (c) => `<div class="stat">
                  <span class="stat__label">${c.label}</span>
                  <span class="stat__value">${c.value}</span>
                </div>`
      )
      .join('');

    this.els.tips.innerHTML = summary.tips
      .map((t) => `<li class="tip tip--${t.severity}">${escapeHtml(t.message)}</li>`)
      .join('');

    this.els.layer.classList.add('result--visible');

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.dismiss(), AUTO_DISMISS_MS);
  }

  dismiss() {
    if (!this.visible) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.els.layer.classList.remove('result--visible');
    const callback = this.onDismiss;
    this.onDismiss = null;
    callback?.();
  }
}

/** @param {string} v */
function escapeHtml(v) {
  return v.replace(/[&<>"']/g, (ch) =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  );
}
