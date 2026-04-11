import { appState } from './state.js';
import { Profile } from '../core/profile.js';
import { DigraphMap, buildDigraphKey } from '../core/digraph.js';
import { getRollingWpm } from '../core/wpm.js';
import { computeConsistency } from '../core/consistency.js';
import { estimateChunkHorizon } from '../core/chunk.js';
import { generateDrillText } from '../core/drill.js';
import { generateLocalPortrait } from '../core/portrait.js';
import { buildTersePrompt } from '../core/prompt.js';
import { shouldUseAPI } from '../core/budget.js';
import { detectProvider } from '../core/provider.js';
import { canShowChunkTransfer } from '../core/ui-logic.js';
import { getTrackLabel } from '../core/tags.js';
import { QUOTES } from '../data/quotes.js';

import { TypingStage } from '../components/TypingStage.js';
import { MetricsPanel } from '../components/MetricsPanel.js';
import { IntelligencePanel } from '../components/IntelligencePanel.js';
import { AudioEngine } from './audio.js';
import { Ghost } from './ghost.js';
import { Coach } from './coach.js';
import { Zen } from './zen.js';
import { SessionCinema } from '../components/SessionCinema.js';
import { ParticleSystem } from './particles.js';

const DRILL_EVERY_N = 5;
const SKIP_KEYS = new Set([
  'Backspace','Shift','Control','Alt','Meta','CapsLock','Tab',
  'Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
  'Escape','Delete','Home','End','PageUp','PageDown',
  'Insert','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'
]);

export class App {
  constructor(mountEl) {
    this.mountEl = mountEl;
    this.profile = Profile.load();
    this.digraphMap = new DigraphMap(this.profile.digraphStats);
    this.audio = new AudioEngine(this.profile.settings?.soundEnabled);
    this.ghost = new Ghost();
    this.coach = new Coach();
    this.zen = new Zen();

    // Session state
    this.keyDownTimes = {};
    this.lastKeyUpTime = null;
    this.prevCharKey = null;
    this.quoteOrder = [];
    this.quoteIndex = 0;
    this.textsTyped = 0;
    this.chunkTimerId = null;
    this.chunkFellBehind = false;

    // DOM refs
    this.els = {};

    // Bind methods
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.handleBeforeInput = this.handleBeforeInput.bind(this);
    this.tick = this.tick.bind(this);
    this.onWeakDigraphClick = this.onWeakDigraphClick.bind(this);
    this.onModeToggle = this.onModeToggle.bind(this);
    this.onChunkToggle = this.onChunkToggle.bind(this);
    this.onTransferToggle = this.onTransferToggle.bind(this);
    this.onZenToggle = this.onZenToggle.bind(this);
  }

  mount() {
    this.shuffleQuotes();

    this.mountEl.innerHTML = `
      <div class="app" id="app-root">
        <aside class="panel-left" id="panel-left"></aside>
        <main class="stage" id="stage"></main>
        <aside class="panel-right" id="panel-right"></aside>
        <div class="session-flash" id="session-flash"></div>
        <div class="chunk-nudge" id="chunk-nudge">catch up — read ahead ▸</div>
        <div class="loading-indicator" id="loading-indicator">generating drill</div>
        <div class="focus-overlay" id="focus-overlay">click to focus</div>
        <div class="rhythm-pulse" id="rhythm-pulse"></div>
        <button class="zen-exit" id="zen-exit" aria-label="Exit zen mode">
          <span></span><span></span><span></span>
        </button>
        <textarea id="hidden-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
      </div>
    `;

    this.els.root = document.getElementById('app-root');
    this.els.flash = document.getElementById('session-flash');
    this.els.nudge = document.getElementById('chunk-nudge');
    this.els.loading = document.getElementById('loading-indicator');
    this.els.focusOverlay = document.getElementById('focus-overlay');
    this.els.hiddenInput = document.getElementById('hidden-input');
    this.els.rhythmPulse = document.getElementById('rhythm-pulse');

    this.intelligencePanel = new IntelligencePanel(
      document.getElementById('panel-left'),
      this.profile,
      this.digraphMap,
      {
        onModeToggle: this.onModeToggle,
        onChunkToggle: this.onChunkToggle,
        onTransferToggle: this.onTransferToggle,
        onZenToggle: this.onZenToggle,
        onWeakDigraphClick: this.onWeakDigraphClick,
        onClearData: () => this.clearData(),
        onSaveApiKey: (key) => this.saveApiKey(key),
        onApiModeChange: (mode) => this.setApiMode(mode),
        onSettingChange: (key, value) => this.updateSetting(key, value),
        onCinema: () => this.openCinema(),
      }
    );

    this.cinema = new SessionCinema(this.mountEl);

    this.typingStage = new TypingStage(
      document.getElementById('stage'),
      {
        onFocus: () => this.els.focusOverlay.classList.remove('visible'),
        onBlur: () => setTimeout(() => this.checkFocus(), 100),
      }
    );

    const particleCanvas = document.getElementById('particle-canvas');
    this.particles = new ParticleSystem(particleCanvas);
    this.resizeParticles();
    window.addEventListener('resize', () => this.resizeParticles());

    this.metricsPanel = new MetricsPanel(
      document.getElementById('panel-right'),
      this.digraphMap,
      this.onWeakDigraphClick
    );

    // MetricsPanel weak digraph clicks
    document.getElementById('panel-right').addEventListener('click', (e) => {
      const item = e.target.closest('.weak-item');
      if (item && item.dataset.digraph) {
        this.onWeakDigraphClick(item.dataset.digraph);
      }
    });
    this.els.hiddenInput.addEventListener('keydown', this.handleKeyDown);
    this.els.hiddenInput.addEventListener('keyup', this.handleKeyUp);
    this.els.hiddenInput.addEventListener('input', this.handleInput);
    this.els.hiddenInput.addEventListener('beforeinput', this.handleBeforeInput);
    this.els.hiddenInput.addEventListener('focus', () => this.els.focusOverlay.classList.remove('visible'));
    this.els.hiddenInput.addEventListener('blur', () => setTimeout(() => this.checkFocus(), 100));
    this.els.focusOverlay.addEventListener('click', () => this.els.hiddenInput.focus());
    document.getElementById('stage').addEventListener('click', (e) => {
      if (!e.target.closest('.settings-body')) this.els.hiddenInput.focus();
    });

    // Zen escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && appState.get().zenMode) {
        this.onZenToggle();
      }
    });

    // Tick loop
    this.tickInterval = setInterval(this.tick, 1000);
    this.ghostInterval = setInterval(() => this.updateGhostOverlay(), 100);

    // Init UI
    this.updateIdentityUI();
    this.loadNextText();
    this.els.hiddenInput.focus();
  }

  checkFocus() {
    if (document.activeElement !== this.els.hiddenInput) {
      this.els.focusOverlay.classList.add('visible');
    }
  }

  resizeParticles() {
    const rect = this.typingStage.els.text.getBoundingClientRect();
    this.particles.resize(rect.width, rect.height);
  }

  shuffleQuotes() {
    this.quoteOrder = QUOTES.map((_, i) => i);
    for (let i = this.quoteOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.quoteOrder[i], this.quoteOrder[j]] = [this.quoteOrder[j], this.quoteOrder[i]];
    }
    this.quoteIndex = 0;
  }

  async loadNextText() {
    const state = appState.get();
    this.textsTyped++;
    this.profile.textCount = (this.profile.textCount || 0) + 1;
    this.stopChunkTimer();

    const weakList = this.digraphMap.getWeakList();

    if (state.appMode === 'practice' && !state.isTransfer) {
      this.els.loading.classList.add('visible');
      const drillText = await this.generateDrillTextWithCache(weakList);
      this.els.loading.classList.remove('visible');
      if (drillText) {
        appState.update(s => ({ ...s, currentText: drillText, currentAttr: '' }));
        this.typingStage.renderText(drillText, '');
        return;
      }
    }

    appState.update(s => ({ ...s, isTransfer: false }));

    if (this.quoteIndex >= this.quoteOrder.length) this.shuffleQuotes();
    const quote = QUOTES[this.quoteOrder[this.quoteIndex++]];
    appState.update(s => ({ ...s, currentText: quote.text, currentAttr: quote.attr }));
    this.typingStage.renderText(quote.text, quote.attr);
    if (state.chunkMode) this.startChunkTimer();
  }

  handleKeyDown(e) {
    if (e.repeat) return;
    if (!this.keyDownTimes[e.key]) {
      this.keyDownTimes[e.key] = performance.now();
    }
  }

  handleKeyUp(e) {
    const now = performance.now();
    const downTime = this.keyDownTimes[e.key];
    if (downTime === undefined) return;

    const dwell = now - downTime;
    const flight = this.lastKeyUpTime !== null ? (downTime - this.lastKeyUpTime) : null;
    delete this.keyDownTimes[e.key];
    this.lastKeyUpTime = now;

    const evt = { key: e.key, dwell, flight, timestamp: downTime };
    appState.update(s => ({ ...s, events: [...s.events, evt] }));

    if (!SKIP_KEYS.has(e.key)) {
      appState.update(s => ({ ...s, keystrokeTimestamps: [...s.keystrokeTimestamps, downTime] }));

      const charKey = e.key.length === 1 ? e.key : null;
      if (charKey && this.prevCharKey) {
        const dgKey = buildDigraphKey(this.prevCharKey, charKey);
        if (dgKey && flight != null) {
          this.digraphMap.update(dgKey, flight);
        }
      }
      if (charKey) this.prevCharKey = charKey;
      else if (e.key === 'Backspace') this.prevCharKey = null;

      // Finger map highlight
      this.metricsPanel.updateFingerMap(e.key);

      // Audio feedback moved to handleCharInput for incorrect strokes only
    }

    this.updateMetrics();
  }

  handleInput(e) {
    const data = e.data;
    if (data && data.length > 0) {
      this.handleCharInput(data[data.length - 1]);
    }
    this.els.hiddenInput.value = '?';
  }

  handleBeforeInput(e) {
    if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteWordBackward') {
      e.preventDefault();
    }
  }

  handleCharInput(typedChar) {
    const state = appState.get();
    if (state.cursorPos >= state.currentText.length) return;
    if (state.sessionStartTime === 0) {
      appState.update(s => ({ ...s, sessionStartTime: performance.now() }));
    }

    const expected = state.currentText[state.cursorPos];
    if (typedChar === expected) {
      this.typingStage.markCorrect(state.cursorPos);
      const newStreak = state.perfectStreak + 1;
      appState.update(s => ({ ...s, cursorPos: s.cursorPos + 1, perfectStreak: newStreak }));
      this.typingStage.setCurrent(appState.get().cursorPos);

      // Particle burst on streak milestones
      if (this.profile.settings?.particleEnabled && newStreak > 0 && newStreak % 10 === 0) {
        const span = this.typingStage.els.text.querySelector(`[data-i="${state.cursorPos}"]`);
        if (span) {
          const rect = span.getBoundingClientRect();
          const canvasRect = this.particles.canvas.getBoundingClientRect();
          this.particles.burst(rect.left - canvasRect.left + rect.width / 2, rect.top - canvasRect.top + rect.height / 2);
        }
      }

      if (appState.get().chunkMode) this.updateChunkZone();
      if (appState.get().cursorPos >= state.currentText.length) {
        this.onTextComplete();
      }
    } else {
      appState.update(s => ({ ...s, sessionErrors: s.sessionErrors + 1, perfectStreak: 0 }));
      this.typingStage.markError(state.cursorPos);
      this.audio.click(); // tactile feedback on error only
      setTimeout(() => this.typingStage.setCurrent(state.cursorPos), 200);
    }
  }

  onTextComplete() {
    const state = appState.get();
    this.els.flash.classList.add('active');
    setTimeout(() => this.els.flash.classList.remove('active'), 400);
    this.stopChunkTimer();

    const duration = performance.now() - state.sessionStartTime;
    const wpm = duration > 0 ? Math.round((state.currentText.length / 5) / (duration / 60000)) : 0;
    const dwells = state.events.filter(e => !SKIP_KEYS.has(e.key)).map(e => e.dwell);
    const consistency = computeConsistency(dwells);

    this.profile.digraphStats = this.digraphMap.toJSON();

    // Transfer divergence detection
    if (state.isTransfer && wpm > 0) {
      this.profile.transferHistory.push({ date: Date.now(), wpm, consistency });
      let trackC = this.profile.sessions.filter(s => s.track === 'C' || s.track === 'quote');
      trackC = trackC.slice(-10);
      if (trackC.length >= 2) {
        const avgTrain = trackC.reduce((a, s) => a + s.wpm, 0) / trackC.length;
        const lastTwo = this.profile.transferHistory.slice(-2);
        if (lastTwo.length === 2 && lastTwo.every(t => t.wpm < avgTrain * 0.9)) {
          this.aiLog('⚠️ Transfer WPM diverged <90% of training avg for 2 tests. Focus on accuracy over burst speed.', 'error');
        }
      }
    }

    // Ghost recording / cinema source
    const ghostRec = this.ghost.encode(state.currentText, state.events, wpm, state.sessionErrors);
    this.lastRecording = ghostRec;
    const textHash = this.ghost.hash(state.currentText);
    const existing = this.profile.ghostLibrary[textHash];
    if (!existing || this.ghost.isBetterThan(ghostRec, existing)) {
      this.profile.ghostLibrary[textHash] = ghostRec;
    }

    // Rhythm pulse toggle check
    if (this.profile.settings?.rhythmEnabled) {
      this.els.rhythmPulse.classList.add('active');
    } else {
      this.els.rhythmPulse.classList.remove('active');
    }

    // Coach tips
    const tips = this.coach.analyze(state.events, this.digraphMap, this.profile.sessions);
    appState.update(s => ({ ...s, coachTips: tips }));

    // Update coach tips UI
    this.intelligencePanel.updateCoachTips(tips);

    // Session append
    const isDrill = state.appMode === 'practice';
    const trackLabel = state.isTransfer ? 'transfer' : (state.chunkMode ? 'B' : (isDrill ? 'A' : 'C'));
    Profile.appendSession(this.profile, {
      timestamp: Date.now(),
      track: trackLabel,
      avgDwell: dwells.length ? dwells.reduce((a, b) => a + b, 0) / dwells.length : 0,
      avgFlight: (() => {
        const flights = state.events.filter(e => e.flight != null && e.flight >= 0 && e.flight < 2000).map(e => e.flight);
        return flights.length ? flights.reduce((a, b) => a + b, 0) / flights.length : 0;
      })(),
      wpm,
      consistency,
      ghostWpm: existing ? existing.wpm : null,
    });

    // Audio completion
    this.audio.complete();

    this.updateIdentityUI();
    this.updateMetrics();
    this.loadNextText();
  }

  // ─── Chunk Mode ───
  startChunkTimer() {
    const state = appState.get();
    if (state.appMode === 'practice') return;
    if (this.profile.settings?.chunkNudgeEnabled === false) return;
    appState.update(s => ({ ...s, chunkTargetPos: 0 }));
    this.chunkFellBehind = false;
    this.els.nudge.classList.remove('visible');

    const recent = this.profile.sessions.slice(-5);
    const avgWpm = recent.length > 0 ? recent.reduce((a, s) => a + s.wpm, 0) / recent.length : 60;
    const cps = (avgWpm * 5) / 60;
    const intervalMs = 100;
    const charsPerTick = cps * (intervalMs / 1000);

    this.chunkTimerId = setInterval(() => {
      const state = appState.get();
      if (state.sessionStartTime === 0) return;
      appState.update(s => ({ ...s, chunkTargetPos: Math.min(state.currentText.length, state.chunkTargetPos + charsPerTick) }));
      this.updateChunkZone();

      const wordsBehind = this.countWordsBetween(state.currentText, state.cursorPos, Math.floor(state.chunkTargetPos));
      if (wordsBehind > 2) {
        this.els.nudge.classList.add('visible');
        this.chunkFellBehind = true;
      } else {
        this.els.nudge.classList.remove('visible');
      }
    }, intervalMs);
  }

  stopChunkTimer() {
    if (this.chunkTimerId) {
      clearInterval(this.chunkTimerId);
      this.chunkTimerId = null;
    }
    this.els.nudge.classList.remove('visible');
  }

  updateChunkZone() {
    const state = appState.get();
    if (!state.chunkMode) return;
    const horizonChars = Math.floor(this.profile.chunkHorizon * 5);
    const zoneEnd = Math.min(state.currentText.length, state.cursorPos + horizonChars);
    this.typingStage.updateChunkZone(state.cursorPos, zoneEnd);
  }

  countWordsBetween(text, posA, posB) {
    if (posA >= posB) return 0;
    const slice = text.slice(posA, posB);
    return slice.split(/\s+/).filter(Boolean).length;
  }

  // ─── Ticks ───
  tick() {
    const state = appState.get();
    const wpm = getRollingWpm(state.keystrokeTimestamps);
    appState.update(s => {
      const hist = [...s.wpmHistory, wpm];
      if (hist.length > 60) hist.shift();
      return { ...s, wpmHistory: hist };
    });
    this.typingStage.updateWpm(wpm);
    this.metricsPanel.updateWpmChart(appState.get().wpmHistory);

    // Rhythm pulse visual beat
    if (this.profile.settings?.rhythmEnabled && state.sessionStartTime > 0) {
      const beatOpacity = this.computeRhythmOpacity();
      this.els.rhythmPulse.style.opacity = beatOpacity;
    } else {
      this.els.rhythmPulse.style.opacity = '';
    }
  }

  computeRhythmOpacity() {
    const recent = this.profile.sessions.slice(-5);
    const avgWpm = recent.length > 0 ? recent.reduce((a, s) => a + s.wpm, 0) / recent.length : 60;
    const bpm = avgWpm * 5; // keystrokes per minute
    const intervalMs = (60 / bpm) * 1000;
    const t = performance.now() % intervalMs;
    return Math.max(0.2, Math.sin((t / intervalMs) * Math.PI));
  }

  updateGhostOverlay() {
    const state = appState.get();
    if (!this.profile.settings?.ghostEnabled || !state.currentText || state.sessionStartTime === 0) {
      this.typingStage.hideGhost();
      return;
    }
    const textHash = this.ghost.hash(state.currentText);
    const rec = this.profile.ghostLibrary[textHash];
    if (!rec) {
      this.typingStage.hideGhost();
      return;
    }
    const elapsed = performance.now() - state.sessionStartTime;
    const pos = this.ghost.overlayPositionAt(rec, elapsed);
    this.typingStage.showGhost(state.currentText, pos);
  }

  // ─── Metrics ───
  updateMetrics() {
    const state = appState.get();
    const typed = state.events.filter(e => !SKIP_KEYS.has(e.key));
    const dwells = typed.map(e => e.dwell);
    const flights = typed.map(e => e.flight).filter(v => v != null && v >= 0 && v < 2000);

    this.metricsPanel.updateStats({
      ksCount: typed.length,
      avgDwell: dwells.length >= 2 ? Math.round(dwells.reduce((a, b) => a + b, 0) / dwells.length) : null,
      avgFlight: flights.length >= 1 ? Math.round(flights.reduce((a, b) => a + b, 0) / flights.length) : null,
      consistency: dwells.length >= 2 ? computeConsistency(dwells) : null,
    });

    this.metricsPanel.renderKeyBars(typed);
    this.metricsPanel.renderWeakDigraphs();
    this.metricsPanel.updateHeatmap();
    this.intelligencePanel.updateIdentity(this.profile, this.digraphMap.getWeakList());
  }

  updateIdentityUI() {
    this.intelligencePanel.updateIdentity(this.profile, this.digraphMap.getWeakList());
  }

  // ─── Mode Toggles ───
  onModeToggle() {
    const state = appState.get();
    const newMode = state.appMode === 'quote' ? 'practice' : 'quote';
    appState.update(s => ({ ...s, appMode: newMode, isTransfer: false, chunkMode: false }));
    this.stopChunkTimer();
    this.typingStage.updateMode(newMode);
    this.intelligencePanel.updateMode(newMode);
    this.quoteIndex = QUOTES.length;
    this.loadNextText();
  }

  onChunkToggle() {
    const state = appState.get();
    const newChunk = !state.chunkMode;
    appState.update(s => ({ ...s, chunkMode: newChunk }));
    this.intelligencePanel.updateChunk(newChunk);
    if (!newChunk) {
      this.stopChunkTimer();
      this.typingStage.renderText(state.currentText, state.currentAttr);
    } else {
      this.aiLog(`Track B active — horizon: ${this.profile.chunkHorizon} words`, 'thinking');
      if (state.sessionStartTime > 0) this.startChunkTimer();
    }
  }

  async onTransferToggle() {
    if (this.profile.transferPool.length === 0) {
      this.aiLog('Generating sealed transfer texts...', 'thinking');
      this.els.loading.classList.add('visible');
      const weakList = this.digraphMap.getWeakList();
      for (let i = 0; i < 3; i++) {
        const text = await this.generateDrillTextAsync(weakList.length > 0 ? weakList : ['th', 'er', 'in']);
        if (text) this.profile.transferPool.push(text);
      }
      if (this.profile.transferPool.length === 0) {
        this.profile.transferPool.push(QUOTES[Math.floor(Math.random() * QUOTES.length)].text);
      }
      Profile.save(this.profile);
      this.els.loading.classList.remove('visible');
    }

    const transferText = this.profile.transferPool.pop();
    Profile.save(this.profile);

    appState.update(s => ({
      ...s,
      isTransfer: true,
      appMode: 'quote',
      chunkMode: false,
      currentText: transferText,
      currentAttr: 'transfer test',
    }));
    this.stopChunkTimer();
    this.typingStage.renderText(transferText, 'transfer test');
    this.els.hiddenInput.focus();
    this.intelligencePanel.updateMode('quote');
    this.intelligencePanel.updateChunk(false);
    this.aiLog('Transfer test started — type naturally', 'thinking');
  }

  onZenToggle() {
    const state = appState.get();
    const newZen = !state.zenMode;
    appState.update(s => ({ ...s, zenMode: newZen }));
    this.zen.toggle(this.els.root, newZen);
    this.intelligencePanel.updateZen(newZen);
  }

  // ─── Weak Digraph Drill ───
  async onWeakDigraphClick(dg) {
    this.aiLog(`Manual drill requested for "${dg}"`, 'thinking');
    const drillText = await this.generateDrillTextAsync([{ digraph: dg }]);
    if (drillText) {
      appState.update(s => ({ ...s, appMode: 'practice', isTransfer: false, currentText: drillText, currentAttr: '' }));
      this.typingStage.renderText(drillText, '');
      this.els.hiddenInput.focus();
      this.aiLog(`Drill loaded targeting "${dg}"`, 'success');
    }
  }

  // ─── AI Generation ───
  async generateDrillTextWithCache(weakList) {
    // For now, bypass cache for the main app to keep logic simple
    return this.generateDrillTextAsync(weakList);
  }

  async generateDrillTextAsync(weakList) {
    const aiText = await this.generateAIText(weakList);
    if (aiText) return aiText;
    this.aiLog('Using local word list fallback', 'thinking');
    return generateDrillText(weakList, 60);
  }

  async generateAIText(weakDigraphs) {
    const apiKey = this.profile.apiKey;
    const hasCacheHit = false; // Simplified for now

    if (!shouldUseAPI(this.profile.apiMode, hasCacheHit, !!apiKey)) {
      return null;
    }

    const provider = detectProvider(apiKey);
    if (provider === 'unknown') {
      this.aiLog('Unrecognized key format — expected sk-ant-... or sk-...', 'error');
      return null;
    }

    const dgList = weakDigraphs.map(w => w.digraph || w).join(', ');
    const providerLabel = provider === 'anthropic' ? 'Claude (Haiku)' : 'GPT-4o-mini';
    this.aiLog(`Calling ${providerLabel} — targeting: ${dgList}`, 'thinking');
    this.els.loading.classList.add('visible');

    const t0 = performance.now();
    try {
      const text = provider === 'anthropic'
        ? await this.callAnthropic(apiKey, dgList)
        : await this.callOpenAI(apiKey, dgList);
      const latency = Math.round(performance.now() - t0);
      if (text && text.length > 10) {
        this.aiLog(`✓ ${providerLabel} returned ${text.split(' ').length} words (${latency}ms)`, 'success');
        return text.trim();
      }
      this.aiLog(`Response too short (${latency}ms), falling back to local`, 'error');
      return null;
    } catch (err) {
      const latency = Math.round(performance.now() - t0);
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        this.aiLog(`CORS blocked (${latency}ms) — browser security prevents direct API calls from file://. Serve via localhost.`, 'error');
      } else {
        this.aiLog(`${providerLabel} error (${latency}ms): ${err.message}`, 'error');
      }
      return null;
    } finally {
      this.els.loading.classList.remove('visible');
    }
  }

  async callAnthropic(apiKey, dgList) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 60,
        messages: [{ role: 'user', content: buildTersePrompt(dgList) }],
      }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data.content?.[0]?.text || null;
  }

  async callOpenAI(apiKey, dgList) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 60,
        messages: [{ role: 'user', content: buildTersePrompt(dgList) }],
      }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || null;
  }

  openCinema() {
    if (!this.lastRecording) {
      this.aiLog('No session recording available yet.', 'error');
      return;
    }
    const state = appState.get();
    this.cinema.load(this.lastRecording, state.currentText);
    this.cinema.show();
  }

  // ─── Settings ───
  saveApiKey(key) {
    if (!key) return;
    this.profile.apiKey = key;
    Profile.save(this.profile);
    this.aiLog('API key saved', 'success');
  }

  setApiMode(mode) {
    this.profile.apiMode = mode;
    Profile.save(this.profile);
    this.aiLog(`API mode set to ${mode}`, 'thinking');
  }

  updateSetting(key, value) {
    this.profile.settings[key] = value;
    Profile.save(this.profile);
    if (key === 'soundEnabled') {
      this.audio.setEnabled(value);
    }
  }

  clearData() {
    if (!confirm('Clear all cadence data? This cannot be undone.')) return;
    Profile.clear();
    this.profile = Profile.load();
    this.digraphMap = new DigraphMap();
    appState.set({
      profile: this.profile,
      digraphMap: this.digraphMap,
      appMode: 'quote',
      chunkMode: false,
      zenMode: false,
      isTransfer: false,
      currentText: '',
      currentAttr: '',
      cursorPos: 0,
      sessionStartTime: 0,
      sessionErrors: 0,
      events: [],
      keystrokeTimestamps: [],
      wpmHistory: [],
      loading: false,
      aiLogs: [],
      coachTips: [],
      ghostRecording: null,
      showGhost: false,
      showRhythm: false,
      perfectStreak: 0,
    });
    this.keyDownTimes = {};
    this.lastKeyUpTime = null;
    this.prevCharKey = null;
    this.textsTyped = 0;
    this.metricsPanel.clear();
    this.loadNextText();
    this.els.hiddenInput.focus();
  }

  aiLog(message, type = 'thinking') {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    appState.update(s => ({
      ...s,
      aiLogs: [...s.aiLogs.slice(-49), { time, message, type }],
    }));
    this.intelligencePanel.updateLogs();
  }
}
