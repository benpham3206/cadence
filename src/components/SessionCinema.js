export class SessionCinema {
  constructor(container) {
    this.container = container;
    this.renderShell();
  }

  renderShell() {
    this.container.insertAdjacentHTML('beforeend', `
      <div id="cinema-modal" style="display:none;position:fixed;inset:0;background:rgba(10,10,10,0.92);z-index:200;align-items:center;justify-content:center;flex-direction:column;padding:2rem;">
        <div style="font-family:var(--font-display);font-size:14px;letter-spacing:0.08em;margin-bottom:1rem;">SESSION CINEMA</div>
        <div class="text-display" id="cinema-text" style="max-width:720px;width:100%;margin-bottom:1rem;"></div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem;">
          <button class="pill" id="cinema-play">▶ Play</button>
          <input type="range" id="cinema-scrub" min="0" max="100" value="0" style="width:300px;" />
          <span id="cinema-time" style="font-family:var(--font-mono);font-size:12px;color:var(--color-text-muted);">0.0s</span>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="pill" data-speed="0.5">0.5×</button>
          <button class="pill active" data-speed="1">1×</button>
          <button class="pill" data-speed="2">2×</button>
        </div>
        <button class="pill" id="cinema-close" style="position:absolute;top:1.5rem;right:1.5rem;">✕</button>
      </div>
    `);

    this.els = {
      modal: document.getElementById('cinema-modal'),
      text: document.getElementById('cinema-text'),
      playBtn: document.getElementById('cinema-play'),
      scrub: document.getElementById('cinema-scrub'),
      time: document.getElementById('cinema-time'),
      closeBtn: document.getElementById('cinema-close'),
    };

    this.els.closeBtn.addEventListener('click', () => this.hide());
    this.els.playBtn.addEventListener('click', () => this.togglePlay());
    this.els.scrub.addEventListener('input', (e) => this.scrubTo(Number(e.target.value)));

    this.recording = null;
    this.speed = 1;
    this.playing = false;
    this.startedAt = 0;
    this.scrubValue = 0;
    this.rafId = null;
  }

  load(recording, text) {
    this.recording = recording;
    this.text = text;
    this.renderText(0);
    this.els.scrub.max = recording.events.length ? recording.events[recording.events.length - 1].deltaMs : 0;
    this.els.scrub.value = 0;
  }

  show() {
    this.els.modal.style.display = 'flex';
  }

  hide() {
    this.pause();
    this.els.modal.style.display = 'none';
  }

  togglePlay() {
    if (this.playing) this.pause();
    else this.play();
  }

  play() {
    if (!this.recording) return;
    this.playing = true;
    this.els.playBtn.textContent = '⏸ Pause';
    this.startedAt = performance.now() - (this.scrubValue / this.speed);
    this.loop();
  }

  pause() {
    this.playing = false;
    this.els.playBtn.textContent = '▶ Play';
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  loop() {
    if (!this.playing) return;
    const elapsedRaw = performance.now() - this.startedAt;
    const elapsed = elapsedRaw * this.speed;
    const max = this.recording.events.length ? this.recording.events[this.recording.events.length - 1].deltaMs : 0;
    if (elapsed >= max) {
      this.scrubTo(max);
      this.pause();
      return;
    }
    this.scrubTo(elapsed);
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  scrubTo(ms) {
    if (!this.recording) return;
    this.scrubValue = ms;
    this.els.scrub.value = ms;
    this.els.time.textContent = (ms / 1000).toFixed(1) + 's';

    let idx = 0;
    for (const e of this.recording.events) {
      if (e.deltaMs <= ms) idx = e.charIndex;
      else break;
    }
    this.renderText(idx);
  }

  renderText(cursorIndex) {
    let html = '';
    for (let i = 0; i < this.text.length; i++) {
      const ch = this.text[i];
      if (ch === '\n') {
        html += '<br/>';
        continue;
      }
      const display = ch === ' ' ? '\u00A0' : ch;
      const cls = i < cursorIndex ? 'char char-correct' : (i === cursorIndex ? 'char char-current' : 'char char-pending');
      html += `<span class="${cls}">${display}</span>`;
    }
    this.els.text.innerHTML = html;
  }

  setSpeed(s) {
    this.speed = s;
  }
}
