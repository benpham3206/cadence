import { LETTERS } from '../core/digraph.js';
import { FINGER, FINGER_LABELS, fingerForChar } from '../core/keyboard-layout.js';

/**
 * Analytics, kept off the typing screen on purpose.
 *
 * Live dashboards next to a passage split attention, and split attention is
 * exactly what caps a fast typist. Numbers belong in a place you visit between
 * sessions, not in your peripheral vision while reading.
 */

const GOAL_WPM = 130;

/** Order matters: this is the left-to-right finger layout of both hands. */
const FINGER_ORDER = [
  FINGER.L_PINKY,
  FINGER.L_RING,
  FINGER.L_MIDDLE,
  FINGER.L_INDEX,
  FINGER.R_INDEX,
  FINGER.R_MIDDLE,
  FINGER.R_RING,
  FINGER.R_PINKY,
];

const FINGER_SHORT = {
  [FINGER.L_PINKY]: 'L5',
  [FINGER.L_RING]: 'L4',
  [FINGER.L_MIDDLE]: 'L3',
  [FINGER.L_INDEX]: 'L2',
  [FINGER.R_INDEX]: 'R2',
  [FINGER.R_MIDDLE]: 'R3',
  [FINGER.R_RING]: 'R4',
  [FINGER.R_PINKY]: 'R5',
};

const FINGER_COLOR = {
  pinky: 'var(--f-pinky)',
  ring: 'var(--f-ring)',
  middle: 'var(--f-middle)',
  index: 'var(--f-index)',
  thumb: 'var(--f-thumb)',
};

export class StatsView {
  /**
   * @param {HTMLElement} root
   * @param {{ onDrillDigraph: (digraph: string) => void,
   *           onExport: () => void,
   *           onImport: () => void,
   *           onClear: () => void }} handlers
   */
  constructor(root, handlers) {
    this.root = root;
    this.handlers = handlers;

    root.innerHTML = `
      <div class="stats">
        <div class="stats__row" id="stats-summary"></div>

        <section class="panel">
          <h2 class="panel__title">WPM OVER TIME</h2>
          <div id="stats-trend"></div>
        </section>

        <section class="panel">
          <h2 class="panel__title">SLOWEST TRANSITIONS — CLICK TO DRILL</h2>
          <ul class="weaklist" id="stats-weak"></ul>
        </section>

        <section class="panel">
          <h2 class="panel__title">FLIGHT TIME BY FINGER</h2>
          <div id="stats-fingers"></div>
        </section>

        <section class="panel">
          <h2 class="panel__title">TRANSITION HEATMAP</h2>
          <div id="stats-heatmap"></div>
        </section>

        <section class="panel">
          <h2 class="panel__title">YOUR DATA</h2>
          <div class="datarow">
            <button class="btn btn--ghost" id="stats-export">export profile</button>
            <button class="btn btn--ghost" id="stats-import">import profile</button>
            <button class="btn btn--ghost danger" id="stats-clear">clear all data</button>
          </div>
          <p class="panel__empty">Everything is stored in this browser only. Nothing is uploaded.</p>
        </section>
      </div>
    `;

    this.els = {
      summary: /** @type {HTMLElement} */ (root.querySelector('#stats-summary')),
      trend: /** @type {HTMLElement} */ (root.querySelector('#stats-trend')),
      weak: /** @type {HTMLElement} */ (root.querySelector('#stats-weak')),
      fingers: /** @type {HTMLElement} */ (root.querySelector('#stats-fingers')),
      heatmap: /** @type {HTMLElement} */ (root.querySelector('#stats-heatmap')),
    };

    this.els.weak.addEventListener('click', (e) => {
      const item = /** @type {HTMLElement} */ (e.target).closest('[data-digraph]');
      if (item) handlers.onDrillDigraph(/** @type {string} */ (item.getAttribute('data-digraph')));
    });

    root.querySelector('#stats-export')?.addEventListener('click', () => handlers.onExport());
    root.querySelector('#stats-import')?.addEventListener('click', () => handlers.onImport());
    root.querySelector('#stats-clear')?.addEventListener('click', () => handlers.onClear());
  }

  /**
   * @param {{ profile: any, digraphMap: import('../core/digraph.js').DigraphMap }} state
   */
  render({ profile, digraphMap }) {
    this._renderSummary(profile);
    this._renderTrend(profile.sessions);
    this._renderWeak(digraphMap);
    this._renderFingers(digraphMap);
    this._renderHeatmap(digraphMap);
  }

  /** @param {any} profile */
  _renderSummary(profile) {
    const sessions = profile.sessions ?? [];
    const wpms = sessions.map((s) => s.wpm).filter((w) => typeof w === 'number' && w > 0);
    const recent = wpms.slice(-10);

    const best = wpms.length ? Math.max(...wpms) : 0;
    const avgRecent = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    const accs = sessions.map((s) => s.accuracy).filter((a) => typeof a === 'number');
    const avgAcc = accs.length ? accs.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, accs.length) : 0;

    const cards = [
      { label: 'BEST WPM', value: best ? Math.round(best) : '—' },
      { label: 'RECENT AVG', value: avgRecent ? Math.round(avgRecent) : '—' },
      { label: 'TO GOAL', value: avgRecent ? `${Math.max(0, Math.round(GOAL_WPM - avgRecent))}` : '—' },
      { label: 'ACCURACY', value: avgAcc ? `${avgAcc.toFixed(1)}%` : '—' },
      { label: 'PASSAGES', value: profile.textCount ?? 0 },
    ];

    this.els.summary.innerHTML = cards
      .map(
        (c) => `<div class="stat">
                  <span class="stat__label">${c.label}</span>
                  <span class="stat__value">${c.value}</span>
                </div>`
      )
      .join('');
  }

  /**
   * @param {Array<{ wpm: number, phase?: string }>} sessions
   */
  _renderTrend(sessions) {
    const points = (sessions ?? []).filter((s) => typeof s.wpm === 'number' && s.wpm > 0).slice(-60);

    if (points.length < 2) {
      this.els.trend.innerHTML = `<p class="panel__empty">Finish a couple of passages to see a trend.</p>`;
      return;
    }

    const width = 900;
    const height = 180;
    const padX = 34;
    const padY = 16;

    const values = points.map((p) => p.wpm);
    const maxV = Math.max(GOAL_WPM, ...values) * 1.08;
    const minV = Math.min(...values) * 0.9;
    const span = Math.max(1, maxV - minV);

    const x = (i) => padX + (i / (points.length - 1)) * (width - padX * 2);
    const y = (v) => padY + (1 - (v - minV) / span) * (height - padY * 2);

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.wpm).toFixed(1)}`).join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(1)},${height - padY} L${padX},${height - padY} Z`;

    const goalY = y(GOAL_WPM);
    const goalVisible = GOAL_WPM >= minV && GOAL_WPM <= maxV;

    const dots = points
      .map((p, i) =>
        p.phase === 'targeted'
          ? `<circle class="trend__dot--targeted" cx="${x(i).toFixed(1)}" cy="${y(p.wpm).toFixed(1)}" r="3" />`
          : ''
      )
      .join('');

    this.els.trend.innerHTML = `
      <svg class="trend" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img"
           aria-label="WPM over the last ${points.length} passages">
        <path class="trend__area" d="${area}" />
        ${goalVisible ? `<line class="trend__goal" x1="${padX}" y1="${goalY.toFixed(1)}" x2="${width - padX}" y2="${goalY.toFixed(1)}" />` : ''}
        ${goalVisible ? `<text class="trend__goal-label" x="${width - padX + 4}" y="${(goalY + 3).toFixed(1)}">${GOAL_WPM}</text>` : ''}
        <path class="trend__line" d="${line}" />
        ${dots}
        <text class="trend__axis-label" x="4" y="${padY + 4}">${Math.round(maxV)}</text>
        <text class="trend__axis-label" x="4" y="${height - padY}">${Math.round(minV)}</text>
      </svg>
      <p class="panel__empty">Hollow markers are targeted drills. Solid line is every passage.</p>
    `;
  }

  /** @param {import('../core/digraph.js').DigraphMap} digraphMap */
  _renderWeak(digraphMap) {
    const weak = digraphMap.getWeakList(12);

    if (weak.length === 0) {
      this.els.weak.innerHTML = `<li class="panel__empty">Type a few passages and your slowest transitions will surface here.</li>`;
      return;
    }

    const slowest = weak[0].mean;

    this.els.weak.innerHTML = weak
      .map((w) => {
        const sameFinger = fingerForChar(w.digraph[0]) === fingerForChar(w.digraph[1]);
        const pct = slowest > 0 ? (w.mean / slowest) * 100 : 0;
        return `
          <li>
            <button class="weakitem" data-digraph="${w.digraph}" title="Drill quotes dense in &quot;${w.digraph}&quot;">
              <span class="weakitem__digraph">${escapeHtml(w.digraph.replace(/ /g, '␣'))}</span>
              <span class="weakitem__bar"><span class="weakitem__fill" style="width:${pct.toFixed(0)}%"></span></span>
              <span class="weakitem__ms">${Math.round(w.mean)} ms</span>
              <span class="weakitem__samples">${sameFinger ? '<span class="weakitem__flag">1-fing</span>' : `n=${w.count}`}</span>
            </button>
          </li>`;
      })
      .join('');
  }

  /** @param {import('../core/digraph.js').DigraphMap} digraphMap */
  _renderFingers(digraphMap) {
    // Attribute each transition's cost to the finger that pressed the second key.
    const totals = new Map(FINGER_ORDER.map((f) => [f, { sum: 0, count: 0 }]));

    for (const cell of digraphMap.toHeatmapData()) {
      if (cell.count === 0) continue;
      const finger = fingerForChar(cell.to);
      const bucket = finger ? totals.get(finger) : undefined;
      if (!bucket) continue;
      bucket.sum += cell.mean * cell.count;
      bucket.count += cell.count;
    }

    const means = FINGER_ORDER.map((f) => {
      const bucket = /** @type {{sum:number,count:number}} */ (totals.get(f));
      return { finger: f, mean: bucket.count > 0 ? bucket.sum / bucket.count : 0 };
    });

    const maxMean = Math.max(...means.map((m) => m.mean), 1);
    if (means.every((m) => m.mean === 0)) {
      this.els.fingers.innerHTML = `<p class="panel__empty">No finger data yet.</p>`;
      return;
    }

    this.els.fingers.innerHTML = `
      <div class="fingers">
        ${means
          .map((m) => {
            const height = m.mean > 0 ? (m.mean / maxMean) * 100 : 0;
            const kind = /** @type {string} */ (m.finger.split('-')[1]);
            return `
              <div class="fingerbar" title="${FINGER_LABELS[m.finger]}">
                <span class="fingerbar__ms">${m.mean > 0 ? Math.round(m.mean) : '—'}</span>
                <span class="fingerbar__col" style="height:${height.toFixed(0)}%;background:${FINGER_COLOR[kind]}"></span>
                <span class="fingerbar__label">${FINGER_SHORT[m.finger]}</span>
              </div>`;
          })
          .join('')}
      </div>
      <p class="panel__empty">Mean flight time into each finger, in milliseconds. Lower is faster.</p>
    `;
  }

  /** @param {import('../core/digraph.js').DigraphMap} digraphMap */
  _renderHeatmap(digraphMap) {
    const cells = digraphMap.toHeatmapData();
    const sampled = cells.filter((c) => c.count > 0);

    if (sampled.length === 0) {
      this.els.heatmap.innerHTML = `<p class="panel__empty">No transitions recorded yet.</p>`;
      return;
    }

    const means = sampled.map((c) => c.mean);
    const min = Math.min(...means);
    const max = Math.max(...means);
    const span = Math.max(1, max - min);

    const size = 4;
    const offset = 6;
    const dim = offset + 26 * size + 1;

    const rects = cells
      .map((c) => {
        const cx = offset + LETTERS.indexOf(c.to) * size;
        const cy = offset + LETTERS.indexOf(c.from) * size;
        const fill = c.count === 0 ? 'var(--sub-alt)' : heatColor((c.mean - min) / span);
        const title = c.count === 0 ? `${c.key}: no samples` : `${c.key}: ${Math.round(c.mean)}ms over ${c.count}`;
        return `<rect class="heatmap__cell" x="${cx}" y="${cy}" width="${size}" height="${size}"
                      fill="${fill}"><title>${title}</title></rect>`;
      })
      .join('');

    const colLabels = LETTERS.split('')
      .map((ch, i) => `<text class="heatmap__label" x="${offset + i * size + size / 2}" y="4" text-anchor="middle">${ch}</text>`)
      .join('');
    const rowLabels = LETTERS.split('')
      .map((ch, i) => `<text class="heatmap__label" x="3" y="${offset + i * size + size * 0.8}" text-anchor="middle">${ch}</text>`)
      .join('');

    this.els.heatmap.innerHTML = `
      <svg class="heatmap" viewBox="0 0 ${dim} ${dim}" role="img" aria-label="Digraph flight time heatmap">
        ${colLabels}${rowLabels}${rects}
      </svg>
      <div class="heatmap__legend">
        <span>faster</span>
        <span class="heatmap__swatches">
          ${[0, 0.25, 0.5, 0.75, 1].map((t) => `<span class="heatmap__swatch" style="background:${heatColor(t)}"></span>`).join('')}
        </span>
        <span>slower</span>
        <span style="margin-left:.75rem">rows: from · columns: to</span>
      </div>
    `;
  }
}

/**
 * Green through amber to red. Uses HSL so the ramp stays perceptually smooth
 * without pulling in a colour library.
 *
 * @param {number} t 0-1
 */
function heatColor(t) {
  const clamped = Math.max(0, Math.min(1, t));
  const hue = 150 - clamped * 150;
  return `hsl(${hue.toFixed(0)}, 62%, 52%)`;
}

/** @param {string} v */
function escapeHtml(v) {
  return v.replace(/[&<>"']/g, (ch) =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  );
}
