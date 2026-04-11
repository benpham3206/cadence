export class TypingStage {
  constructor(container, { onFocus, onBlur }) {
    this.container = container;
    this.onFocus = onFocus;
    this.onBlur = onBlur;
    this.spans = [];
    this.renderShell();
  }

  renderShell() {
    this.container.innerHTML = `
      <div class="stage-header">
        <span class="stage-title">Cadence</span>
        <div class="pill-group" id="mode-pills">
          <button class="pill active" id="pill-quote">quote</button>
          <button class="pill" id="pill-chunk" style="display:none">chunk</button>
          <button class="pill" id="pill-transfer" style="display:none">transfer</button>
        </div>
      </div>
      <div class="typing-area" style="position:relative;">
        <div class="wpm-display" id="stage-wpm">—</div>
        <div class="text-display" id="stage-text"></div>
        <div class="ghost-overlay" id="stage-ghost" style="position:absolute;top:0;left:0;width:100%;pointer-events:none;opacity:0.18;font-family:var(--font-mono);font-size:22px;line-height:1.9;letter-spacing:0.01em;white-space:pre-wrap;z-index:0;color:var(--color-text-subtle);display:none;"></div>
        <canvas id="particle-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;"></canvas>
        <div class="text-attribution" id="stage-attr"></div>
      </div>
    `;
    this.els = {
      wpm: document.getElementById('stage-wpm'),
      text: document.getElementById('stage-text'),
      ghost: document.getElementById('stage-ghost'),
      attr: document.getElementById('stage-attr'),
      pillQuote: document.getElementById('pill-quote'),
      pillChunk: document.getElementById('pill-chunk'),
      pillTransfer: document.getElementById('pill-transfer'),
    };
  }

  renderText(text, attr) {
    this.els.attr.textContent = attr ? `— ${attr}` : '';
    let html = '';
    this.spans = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '\n') {
        html += '<br/>';
        continue;
      }
      const display = ch === ' ' ? '\u00A0' : ch;
      const cls = i === 0 ? 'char char-current' : 'char char-pending';
      html += `<span class="${cls}" data-i="${i}">${display}</span>`;
    }
    this.els.text.innerHTML = html;
  }

  markCorrect(index) {
    const span = this.els.text.querySelector(`[data-i="${index}"]`);
    if (span) span.className = 'char char-correct';
  }

  markError(index) {
    const span = this.els.text.querySelector(`[data-i="${index}"]`);
    if (span) span.className = 'char char-shake';
  }

  setCurrent(index) {
    const span = this.els.text.querySelector(`[data-i="${index}"]`);
    if (span) span.className = 'char char-current';
  }

  updateChunkZone(cursorPos, zoneEnd) {
    for (let i = cursorPos + 1; i < this.els.text.children.length; i++) {
      const span = this.els.text.querySelector(`[data-i="${i}"]`);
      if (!span || span.classList.contains('char-correct')) continue;
      if (i <= zoneEnd) {
        span.className = 'char char-chunk-zone';
      } else {
        span.className = 'char char-pending';
      }
    }
  }

  updateWpm(wpm) {
    this.els.wpm.textContent = wpm > 0 ? wpm : '—';
    this.els.wpm.classList.toggle('active', wpm > 0);
  }

  updateMode(mode, showSub) {
    this.els.pillQuote.textContent = mode;
    this.els.pillQuote.className = mode === 'practice' ? 'pill active-accent' : 'pill active';
    this.els.pillChunk.style.display = showSub ? '' : 'none';
    this.els.pillTransfer.style.display = showSub ? '' : 'none';
  }

  updateChunk(active) {
    this.els.pillChunk.classList.toggle('active', active);
  }

  showGhost(text, ghostPos) {
    if (!text) { this.els.ghost.style.display = 'none'; return; }
    const visible = text.slice(0, ghostPos + 1).replace(/ /g, '\u00A0');
    const hidden = text.slice(ghostPos + 1).replace(/ /g, '\u00A0');
    const nlToBr = (s) => s.replace(/\n/g, '<br/>');
    this.els.ghost.innerHTML = `<span style="color:var(--color-text-muted);">${nlToBr(visible)}</span><span style="opacity:0;">${nlToBr(hidden)}</span>`;
    this.els.ghost.style.display = 'block';
  }

  hideGhost() {
    this.els.ghost.style.display = 'none';
  }
}
