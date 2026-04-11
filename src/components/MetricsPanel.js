import { LETTERS } from '../core/digraph.js';

export class MetricsPanel {
  constructor(container, digraphMap, onWeakDigraphClick) {
    this.container = container;
    this.digraphMap = digraphMap;
    this.onWeakDigraphClick = onWeakDigraphClick;
    this.hmCells = {};
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="section-label">Metrics</div>
      <div class="stat-cards">
        <div class="stat-card"><span class="stat-label">Avg Dwell</span><span class="stat-value" id="m-dwell">—<span class="stat-unit"> ms</span></span></div>
        <div class="stat-card"><span class="stat-label">Avg Flight</span><span class="stat-value" id="m-flight">—<span class="stat-unit"> ms</span></span></div>
        <div class="stat-card"><span class="stat-label">Consistency</span><span class="stat-value" id="m-consistency">—<span class="stat-unit">%</span></span></div>
        <div class="stat-card"><span class="stat-label">Keystrokes</span><span class="stat-value" id="m-ks">0</span></div>
      </div>

      <div class="section-label">WPM over time</div>
      <div class="wpm-chart-wrap"><svg id="m-wpm-svg" preserveAspectRatio="none"></svg></div>

      <div class="section-label">Per-key timing</div>
      <div class="vis-row" id="m-vis"></div>

      <div class="section-label">Weak digraphs</div>
      <div id="m-weak"></div>

      <div class="section-label">Digraph heatmap</div>
      <div class="heatmap-container" id="m-heatmap">
        <div class="heatmap-grid" id="m-hm-grid"></div>
        <div class="hm-tooltip" id="m-hm-tooltip"></div>
      </div>

      <div class="section-label">Finger map</div>
      <div class="finger-map" id="m-finger-map"></div>
    `;

    this.els = {
      dwell: document.getElementById('m-dwell'),
      flight: document.getElementById('m-flight'),
      consistency: document.getElementById('m-consistency'),
      ks: document.getElementById('m-ks'),
      svg: document.getElementById('m-wpm-svg'),
      vis: document.getElementById('m-vis'),
      weak: document.getElementById('m-weak'),
      hmGrid: document.getElementById('m-hm-grid'),
      hmTooltip: document.getElementById('m-hm-tooltip'),
      fingerMap: document.getElementById('m-finger-map'),
    };

    this.buildHeatmap();
    this.buildFingerMap();
  }

  updateStats({ ksCount, avgDwell, avgFlight, consistency }) {
    this.els.ks.textContent = ksCount;
    this.els.dwell.innerHTML = avgDwell != null ? `${avgDwell}<span class="stat-unit"> ms</span>` : '—<span class="stat-unit"> ms</span>';
    this.els.flight.innerHTML = avgFlight != null ? `${avgFlight}<span class="stat-unit"> ms</span>` : '—<span class="stat-unit"> ms</span>';
    this.els.consistency.innerHTML = consistency != null ? `${consistency}<span class="stat-unit">%</span>` : '—<span class="stat-unit">%</span>';
  }

  renderKeyBars(typed) {
    const recent = typed.slice(-20);
    if (!recent.length) { this.els.vis.innerHTML = ''; return; }

    const maxVal = Math.max(
      ...recent.map(e => e.dwell || 0),
      ...recent.map(e => (e.flight != null && e.flight >= 0 && e.flight < 2000) ? e.flight : 0),
      10
    );

    this.els.vis.innerHTML = recent.map(e => {
      const dh = Math.max(1, Math.round(((e.dwell || 0) / maxVal) * 48));
      const validFlight = e.flight != null && e.flight >= 0 && e.flight < 2000;
      const fh = validFlight ? Math.max(1, Math.round((e.flight / maxVal) * 48)) : 0;
      const label = e.key === ' ' ? '·' : e.key.length === 1 ? e.key : '?';
      return `<div class="bar-group">
        <div class="bar bar-flight" style="height:${fh}px"></div>
        <div class="bar bar-dwell" style="height:${dh}px"></div>
        <div class="bar-key">${label}</div>
      </div>`;
    }).join('');
  }

  renderWeakDigraphs() {
    const weakList = this.digraphMap.getWeakList();
    if (weakList.length === 0) {
      this.els.weak.innerHTML = '<div style="font-size:11px;color:var(--color-text-subtle)">Type more to reveal weak transitions</div>';
      return;
    }
    const maxMean = Math.max(...weakList.map(w => w.mean), 1);
    this.els.weak.innerHTML = weakList.map(w => {
      const pct = Math.min(100, (w.mean / maxMean) * 100);
      return `<div class="weak-item" data-digraph="${w.digraph}">
        <span class="weak-label">${w.digraph}</span>
        <div class="weak-bar-bg"><div class="weak-bar-fill" style="width:${pct}%"></div></div>
        <span class="weak-val">${Math.round(w.mean)} ms</span>
      </div>`;
    }).join('') + '<div class="weak-hint" style="font-size:9px;color:var(--color-text-subtle);opacity:0.5;margin-top:2px;font-style:italic;">click to drill</div>';
  }

  updateWpmChart(history) {
    const svg = this.els.svg;
    if (history.length < 2) { svg.innerHTML = ''; return; }
    const w = svg.clientWidth || 260;
    const h = 50;
    const maxWpm = Math.max(...history, 20);

    const pts = history.map((wpm, i) => ({
      x: (i / (history.length - 1)) * w,
      y: h - 4 - ((wpm / maxWpm) * (h - 12)),
    }));

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cp = (pts[i].x + pts[i - 1].x) / 2;
      d += ` C ${cp} ${pts[i - 1].y}, ${cp} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
    }

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = `
      <path d="${d}" fill="none" stroke="#00d084" stroke-width="1.5" />
      <path d="${d} L ${pts[pts.length - 1].x} ${h} L ${pts[0].x} ${h} Z" fill="rgba(0,208,132,0.08)" />
      <text x="${w - 4}" y="10" font-size="9" fill="rgba(136,136,136,0.6)" text-anchor="end">${maxWpm}</text>
    `;
  }

  buildHeatmap() {
    let html = '<div class="hm-corner hm-header"></div>';
    const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
    for (let j = 0; j < 26; j++) html += `<div class="hm-header">${LETTERS[j]}</div>`;
    for (let i = 0; i < 26; i++) {
      html += `<div class="hm-header">${LETTERS[i]}</div>`;
      for (let j = 0; j < 26; j++) {
        const key = LETTERS[i] + LETTERS[j];
        html += `<div class="hm-cell" data-dg="${key}" id="hm-${key}"></div>`;
      }
    }
    this.els.hmGrid.innerHTML = html;

    for (let i = 0; i < 26; i++) {
      for (let j = 0; j < 26; j++) {
        const key = LETTERS[i] + LETTERS[j];
        this.hmCells[key] = document.getElementById(`hm-${key}`);
      }
    }

    this.els.hmGrid.addEventListener('mouseover', (e) => {
      const dg = e.target.dataset?.dg;
      if (!dg) { this.els.hmTooltip.classList.remove('visible'); return; }
      const stats = this.digraphMap.getStats(dg);
      if (!stats || stats.count === 0) {
        this.els.hmTooltip.classList.remove('visible');
        return;
      }
      this.els.hmTooltip.innerHTML = `<strong>${dg}</strong>  ${Math.round(stats.mean)} ms · ${stats.count} samples`;
      const rect = e.target.getBoundingClientRect();
      const containerRect = this.els.hmGrid.getBoundingClientRect();
      this.els.hmTooltip.style.left = (rect.left - containerRect.left + 12) + 'px';
      this.els.hmTooltip.style.top = (rect.top - containerRect.top - 28) + 'px';
      this.els.hmTooltip.classList.add('visible');
    });

    this.els.hmGrid.addEventListener('mouseleave', () => {
      this.els.hmTooltip.classList.remove('visible');
    });
  }

  updateHeatmap() {
    const data = this.digraphMap.toHeatmapData();
    const means = data.filter(d => d.count > 0).map(d => d.mean);
    if (means.length === 0) return;
    const minMean = Math.min(...means);
    const maxMean = Math.max(...means);
    const range = maxMean - minMean || 1;

    for (const d of data) {
      const cell = this.hmCells[d.key];
      if (!cell) continue;
      if (d.count === 0) { cell.style.backgroundColor = ''; continue; }
      const t = (d.mean - minMean) / range;
      const r = Math.round(30 + t * 200);
      const g = Math.round(160 - t * 120);
      const b = Math.round(120 - t * 80);
      const alpha = Math.min(0.9, 0.3 + (d.count / 30) * 0.6);
      cell.style.backgroundColor = `rgba(${r},${g},${b},${alpha})`;
    }
  }

  buildFingerMap() {
    const rows = [
      ['`','1','2','3','4','5','6','7','8','9','0','-','='],
      ['q','w','e','r','t','y','u','i','o','p','[',']','\\'],
      ['a','s','d','f','g','h','j','k','l',';','\''],
      ['z','x','c','v','b','n','m',',','.','/'],
    ];
    const keyW = 18, keyH = 22, gap = 2;
    const offsets = [0, 10, 14, 18];
    let svg = `<svg viewBox="0 0 280 110" style="width:100%;height:auto;">`;
    rows.forEach((row, r) => {
      const off = offsets[r];
      row.forEach((ch, c) => {
        const x = off + c * (keyW + gap);
        const y = r * (keyH + gap);
        svg += `<rect class="finger-key" id="fm-${ch}" x="${x}" y="${y}" width="${keyW}" height="${keyH}" rx="3" />`;
        svg += `<text x="${x + keyW/2}" y="${y + keyH/2 + 4}" text-anchor="middle" font-size="9" fill="#888" pointer-events="none">${ch}</text>`;
      });
    });
    // Spacebar
    svg += `<rect class="finger-key" id="fm-space" x="80" y="96" width="120" height="16" rx="3" />`;
    svg += '</svg>';
    this.els.fingerMap.innerHTML = svg;
  }

  updateFingerMap(activeKey) {
    if (!activeKey) {
      this.els.fingerMap.querySelectorAll('.finger-key').forEach(el => el.classList.remove('active'));
      return;
    }
    const id = activeKey === ' ' ? 'fm-space' : `fm-${activeKey.toLowerCase()}`;
    const el = this.els.fingerMap.querySelector(`[id="${id}"]`);
    if (el) {
      this.els.fingerMap.querySelectorAll('.finger-key').forEach(k => k.classList.remove('active'));
      el.classList.add('active');
    }
  }

  clear() {
    this.els.dwell.innerHTML = '—<span class="stat-unit"> ms</span>';
    this.els.flight.innerHTML = '—<span class="stat-unit"> ms</span>';
    this.els.consistency.innerHTML = '—<span class="stat-unit">%</span>';
    this.els.ks.textContent = '0';
    this.els.svg.innerHTML = '';
    this.els.vis.innerHTML = '';
    this.els.weak.innerHTML = '';
    this.updateHeatmap();
    this.updateFingerMap(null);
  }
}
