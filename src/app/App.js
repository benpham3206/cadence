import { Profile } from '../core/profile.js';
import { DigraphMap } from '../core/digraph.js';
import { computeConsistency } from '../core/consistency.js';
import { Run, PRESS } from '../core/run.js';
import { Corpus, loadCorpus } from '../core/corpus.js';
import { QuoteRotation, RecentQuotes, selectTargetedQuote } from '../core/selector.js';
import { SessionFlow, PHASE_TARGETED } from '../core/session-flow.js';
import { findSlowSections, digraphsFromSections, mergeTargets } from '../core/slow-sections.js';
import { analyzeRun } from '../core/coach.js';
import { generateDrillText } from '../core/drill.js';
import { formatFailure } from '../core/result.js';

import { TypingStage } from '../ui/TypingStage.js';
import { HandGuide } from '../ui/HandGuide.js';
import { StatsView } from '../ui/StatsView.js';
import { ResultCard } from '../ui/ResultCard.js';
import { STARTER_QUOTES } from '../data/starter-quotes.js';
import { applyTheme, THEMES } from '../ui/theme.js';

const CORPUS_URL = '/quotes/english.json';

/** Live WPM refresh interval. Fast enough to feel live, slow enough to be free. */
const TICK_MS = 250;

/** Keys that must not be swallowed by the typing surface. */
const PASSTHROUGH_KEYS = new Set(['Tab', 'F5', 'F12']);

export class App {
  /** @param {HTMLElement} mount */
  constructor(mount) {
    this.mount = mount;
    this.profile = Profile.load();
    this.digraphMap = new DigraphMap(this.profile.digraphStats);
    this.recent = new RecentQuotes();
    for (const id of this.profile.recentQuoteIds ?? []) this.recent.add(id);

    this.flow = new SessionFlow({
      quotesPerCycle: this.profile.settings.quotesPerCycle,
      targetedPerCycle: this.profile.settings.targetedPerCycle,
    });

    /** @type {import('../core/corpus.js').Corpus|null} */
    this.corpus = null;
    /** @type {QuoteRotation|null} */
    this.rotation = null;
    /** @type {Run|null} */
    this.run = null;
    /** @type {Array<{digraph:string, weight:number}>} */
    this.recentSlow = [];
    /** @type {string|null} */
    this.pendingDigraph = null;

    this.keyDownAt = new Map();
    this.view = 'type';
    this.zen = false;
  }

  async mount_() {
    this.mount.innerHTML = `
      <div class="shell" id="shell">
        <header class="topbar" id="topbar"></header>

        <section class="view" id="view-type">
          <div class="stage" id="stage"></div>
          <div class="foot">
            <div id="guide-host"></div>
            <p class="foot__hint">
              <kbd>esc</kbd> zen mode · <kbd>ctrl</kbd>+<kbd>enter</kbd> skip passage
            </p>
          </div>
        </section>

        <section class="view view--stats" id="view-stats" hidden></section>
      </div>
      <div id="result-host"></div>
      <div class="notice" id="notice" role="status" aria-live="polite"></div>
    `;

    this.els = {
      shell: /** @type {HTMLElement} */ (document.getElementById('shell')),
      topbar: /** @type {HTMLElement} */ (document.getElementById('topbar')),
      viewType: /** @type {HTMLElement} */ (document.getElementById('view-type')),
      viewStats: /** @type {HTMLElement} */ (document.getElementById('view-stats')),
      notice: /** @type {HTMLElement} */ (document.getElementById('notice')),
    };

    applyTheme(this.profile.settings.theme);

    this.stage = new TypingStage(document.getElementById('stage'));
    this.guide = new HandGuide(document.getElementById('guide-host'));
    this.result = new ResultCard(document.getElementById('result-host'));
    this.stats = new StatsView(this.els.viewStats, {
      onDrillDigraph: (dg) => this.drillDigraph(dg),
      onExport: () => this.exportProfile(),
      onImport: () => this.importProfile(),
      onClear: () => this.clearProfile(),
    });

    this._renderTopBar();
    this.guide.setVisible(this.profile.settings.showHands);

    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));

    this.tickTimer = setInterval(() => this.tick(), TICK_MS);

    await this.loadCorpusOrFallback();
    this.nextPassage();
    this.stage.focus();
  }

  // ── Corpus ────────────────────────────────────────────────

  async loadCorpusOrFallback() {
    const result = await loadCorpus(CORPUS_URL);

    if (result.ok) {
      this.corpus = result.value;
    } else {
      // The bundled starter set keeps the app usable when the corpus request
      // fails, rather than presenting an empty screen.
      console.error(formatFailure(result), result.error);
      this.notify('Quote library unavailable — using the built-in starter set.', result.error.rootCause);
      this.corpus = buildStarterCorpus();
    }

    this.rotation = new QuoteRotation(this.corpus, {
      groupFilter: this.profile.settings.lengthGroups,
    });
  }

  // ── Passage selection ─────────────────────────────────────

  nextPassage() {
    if (!this.corpus || !this.rotation) return;

    if (this.pendingDigraph) {
      const digraph = this.pendingDigraph;
      this.pendingDigraph = null;
      if (this.loadTargeted([{ digraph, mean: this.digraphMap.getStats(digraph)?.mean ?? 0 }], 'drilling ' + digraph)) {
        return;
      }
    }

    const targets = this.buildTargets();
    const decision = this.flow.nextPhase({ availableTargets: targets.length });

    if (decision.phase === PHASE_TARGETED && this.loadTargeted(targets, decision.reason)) return;

    const next = this.rotation.next();
    if (!next.ok) {
      console.error(formatFailure(next), next.error);
      this.notify('Could not pick a quote.', next.error.rootCause);
      return;
    }

    this.startPassage(next.value.text, next.value.source, next.value.id, 'quote', decision.reason, []);
  }

  /**
   * @param {Array<{digraph:string, mean:number}>} targets
   * @param {string} reason
   * @returns {boolean} whether a targeted passage was loaded
   */
  loadTargeted(targets, reason) {
    if (!this.corpus || targets.length === 0) return false;

    const picked = selectTargetedQuote(this.corpus, targets, {
      overallMean: this.digraphMap.getOverallMean(),
      recentIds: this.recent.ids,
      // Drills honour the chosen passage length. Narrowing the pool costs some
      // targeting density, which the selector's fallback absorbs, but silently
      // serving a long passage to someone who asked for short ones is worse.
      groupFilter: this.profile.settings.lengthGroups,
    });

    if (picked.ok) {
      this.startPassage(
        picked.value.quote.text,
        picked.value.quote.source,
        picked.value.quote.id,
        'targeted',
        reason,
        picked.value.hitCounts.slice(0, 4)
      );
      return true;
    }

    // No prose in the corpus is dense enough. A synthetic word drill is a worse
    // reading experience but a better targeted rep than skipping the phase.
    const synthetic = generateDrillText(targets, 40);
    if (synthetic) {
      console.warn(formatFailure(picked), picked.error);
      this.startPassage(synthetic, 'generated drill', null, 'targeted', 'synthetic drill', []);
      return true;
    }

    console.error(formatFailure(picked), picked.error);
    return false;
  }

  /**
   * @param {string} text
   * @param {string} source
   * @param {number|null} quoteId
   * @param {'quote'|'targeted'} phase
   * @param {string} reason
   * @param {Array<{digraph:string,count:number}>} targets
   */
  startPassage(text, source, quoteId, phase, reason, targets) {
    this.currentPhase = phase;
    this.currentQuoteId = quoteId;
    if (quoteId !== null) this.recent.add(quoteId);

    this.run = new Run(text);
    this.stage.render(text, source);
    this.stage.setPhase({
      label: reason,
      quotesPerCycle: this.flow.quotesPerCycle,
      targetedPerCycle: this.flow.targetedPerCycle,
      positionInCycle: this.flow.positionInCycle,
      targets,
    });
    this.guide.setNextChar(text[0] ?? null);
  }

  /**
   * Combines the persistent profile with what went wrong most recently.
   *
   * @returns {Array<{digraph:string, mean:number}>}
   */
  buildTargets() {
    return mergeTargets(this.digraphMap.getWeakList(8), this.recentSlow, {
      overallMean: this.digraphMap.getOverallMean(),
    });
  }

  // ── Input ─────────────────────────────────────────────────

  /** @param {KeyboardEvent} e */
  onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.toggleZen();
      return;
    }

    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      this.nextPassage();
      return;
    }

    if (this.result.visible) {
      // The dismissing keystroke belongs to the result card, not the passage.
      e.preventDefault();
      this.result.dismiss();
      return;
    }

    if (this.view !== 'type' || !this.run) return;
    if (PASSTHROUGH_KEYS.has(e.key)) return;

    // The veil is up, so the typist cannot see the passage they would be typing
    // into. The first key buys focus and is otherwise swallowed.
    if (!this.stage.hasFocus) {
      e.preventDefault();
      this.stage.focus();
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      this.handleBackspace(e.ctrlKey || e.altKey || e.metaKey);
      return;
    }

    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key.length !== 1) return;

    e.preventDefault();
    this.keyDownAt.set(e.key, performance.now());
    this.handleChar(e.key, performance.now());
  }

  /** @param {boolean} wholeWord */
  handleBackspace(wholeWord) {
    const run = this.run;
    if (!run) return;

    const outcome = wholeWord ? run.backspaceWord() : run.backspace();
    for (const index of outcome.cleared) this.stage.clearChar(index);

    this.stage.setCursor(run.cursor);
    this.guide.setNextChar(run.expectedChar);
  }

  /** @param {KeyboardEvent} e */
  onKeyUp(e) {
    const downAt = this.keyDownAt.get(e.key);
    if (downAt === undefined) return;
    this.keyDownAt.delete(e.key);
    this.run?.recordDwell(performance.now() - downAt);
  }

  /**
   * @param {string} char
   * @param {number} at
   */
  handleChar(char, at) {
    const run = this.run;
    if (!run) return;

    const index = run.cursor;
    const outcome = run.press(char, at);

    switch (outcome.status) {
      case PRESS.CORRECT:
      case PRESS.COMPLETE:
        this.stage.markChar(index, 'correct');
        this.guide.flashKey(char, true);
        break;

      case PRESS.INCORRECT:
        this.stage.markChar(index, 'incorrect');
        this.guide.flashKey(char, false);
        break;

      default:
        return;
    }

    this.stage.setCursor(run.cursor);
    this.guide.setNextChar(run.expectedChar);

    // A wrong key on the final character still ends the passage, so completion
    // is decided by the cursor rather than by the outcome of this keystroke.
    if (run.complete) this.completePassage();
  }

  // ── Completion ────────────────────────────────────────────

  completePassage() {
    const run = this.run;
    if (!run) return;

    for (const sample of run.digraphSamples) {
      this.digraphMap.update(sample.digraph, sample.flight);
    }

    const sections = findSlowSections(run.strokes);
    this.recentSlow = digraphsFromSections(sections);

    const wpm = run.wpm();
    const accuracy = run.accuracy;
    const consistency = computeConsistency(run.dwells);
    const seconds = run.elapsedMs() / 1000;

    const priorWpms = (this.profile.sessions ?? [])
      .slice(-10)
      .map((s) => s.wpm)
      .filter((w) => typeof w === 'number' && w > 0);
    const average = priorWpms.length
      ? priorWpms.reduce((a, b) => a + b, 0) / priorWpms.length
      : null;

    this.profile.digraphStats = this.digraphMap.toJSON();
    this.profile.textCount = (this.profile.textCount ?? 0) + 1;
    this.profile.recentQuoteIds = this.recent.ids.slice(-40);

    const saved = Profile.appendSession(this.profile, {
      timestamp: Date.now(),
      phase: this.currentPhase,
      wpm,
      accuracy,
      consistency,
      chars: run.text.length,
      errors: run.everWrong.size,
    });

    if (!saved.ok) {
      console.error(formatFailure(saved), saved.error);
      this.notify('Progress could not be saved to this browser.', saved.error.rootCause);
    }

    const tips = analyzeRun({
      dwells: run.dwells,
      accuracy,
      consistency,
      wpm,
      weakDigraphs: this.digraphMap.getWeakList(3),
    });

    this.flow.advance();

    this.result.show(
      {
        wpm,
        accuracy,
        consistency,
        errors: run.everWrong.size,
        seconds,
        deltaVsAverage: average === null ? null : wpm - average,
        tips,
      },
      () => this.nextPassage()
    );

    this.run = null;
  }

  tick() {
    const run = this.run;
    if (this.view === 'type') this.stage.syncFocusVeil();
    if (!run || !run.started || this.view !== 'type') return;
    this.stage.setLive({
      wpm: run.wpm(performance.now()),
      accuracy: run.accuracy,
      progress: run.progress,
    });
  }

  // ── Chrome ────────────────────────────────────────────────

  _renderTopBar() {
    const settings = this.profile.settings;
    this.els.topbar.innerHTML = `
      <div class="topbar__brand">
        <span class="topbar__mark">cadence</span>
        <span class="topbar__tagline">type · diagnose · repair</span>
      </div>
      <nav class="topbar__nav">
        <button class="navlink navlink--active" data-view="type">type</button>
        <button class="navlink" data-view="stats">stats</button>
      </nav>
      <div class="topbar__tools">
        <button class="tool-toggle ${settings.showHands ? 'tool-toggle--on' : ''}" id="toggle-hands"
                title="Show finger positions">hands</button>
        <select class="select" id="select-length" title="Passage length">
          <option value="0,1,2">any length</option>
          <option value="0">short</option>
          <option value="1">medium</option>
          <option value="2,3">long</option>
        </select>
        <select class="select" id="select-theme" title="Theme">
          ${THEMES.map((t) => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
    `;

    /** @type {HTMLSelectElement} */
    const themeSelect = this.els.topbar.querySelector('#select-theme');
    themeSelect.value = settings.theme;
    themeSelect.addEventListener('change', () => {
      this.updateSetting('theme', themeSelect.value);
      applyTheme(themeSelect.value);
    });

    /** @type {HTMLSelectElement} */
    const lengthSelect = this.els.topbar.querySelector('#select-length');
    lengthSelect.value = settings.lengthGroups.join(',');
    lengthSelect.addEventListener('change', () => {
      const groups = lengthSelect.value.split(',').map(Number);
      this.updateSetting('lengthGroups', groups);
      this.rotation?.setGroupFilter(groups);
      this.nextPassage();
      this.stage.focus();
    });

    const handsToggle = /** @type {HTMLElement} */ (this.els.topbar.querySelector('#toggle-hands'));
    handsToggle.addEventListener('click', () => {
      const next = !this.profile.settings.showHands;
      this.updateSetting('showHands', next);
      this.guide.setVisible(next);
      handsToggle.classList.toggle('tool-toggle--on', next);
      this.stage.focus();
    });

    this.els.topbar.querySelectorAll('[data-view]').forEach((el) => {
      el.addEventListener('click', () => this.setView(/** @type {string} */ (el.getAttribute('data-view'))));
    });
  }

  /** @param {string} view */
  setView(view) {
    this.view = view;
    this.els.viewType.hidden = view !== 'type';
    this.els.viewStats.hidden = view !== 'stats';

    this.els.topbar.querySelectorAll('[data-view]').forEach((el) => {
      el.classList.toggle('navlink--active', el.getAttribute('data-view') === view);
    });

    if (view === 'stats') {
      this.stats.render({ profile: this.profile, digraphMap: this.digraphMap });
    } else {
      this.stage.focus();
      this.stage.refreshCaret();
    }
  }

  toggleZen() {
    this.zen = !this.zen;
    this.els.shell.classList.toggle('shell--zen', this.zen);
    this.guide.setVisible(!this.zen && this.profile.settings.showHands);
  }

  // ── Settings and data ─────────────────────────────────────

  /**
   * @param {string} key
   * @param {unknown} value
   */
  updateSetting(key, value) {
    this.profile.settings[key] = value;
    const saved = Profile.save(this.profile);
    if (!saved.ok) {
      console.error(formatFailure(saved), saved.error);
      this.notify('Setting could not be saved.', saved.error.rootCause);
    }
  }

  /** @param {string} digraph */
  drillDigraph(digraph) {
    this.pendingDigraph = digraph;
    this.setView('type');
    this.nextPassage();
    this.stage.focus();
  }

  exportProfile() {
    const blob = new Blob([Profile.exportProfile(this.profile)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cadence-profile-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  importProfile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;

      const parsed = Profile.importProfile(await file.text());
      if (!parsed.ok) {
        console.error(formatFailure(parsed), parsed.error);
        this.notify('That file is not a Cadence profile.', parsed.error.rootCause);
        return;
      }

      this.profile = parsed.value;
      Profile.save(this.profile);
      this.digraphMap = new DigraphMap(this.profile.digraphStats);
      applyTheme(this.profile.settings.theme);
      this.stats.render({ profile: this.profile, digraphMap: this.digraphMap });
      this.notify('Profile imported.', '', 'info');
    });
    input.click();
  }

  clearProfile() {
    if (!confirm('Delete all Cadence data in this browser? This cannot be undone.')) return;
    Profile.clear();
    this.profile = Profile.load();
    this.digraphMap = new DigraphMap();
    this.recent = new RecentQuotes();
    this.recentSlow = [];
    this.flow.reset();
    applyTheme(this.profile.settings.theme);
    this.stats.render({ profile: this.profile, digraphMap: this.digraphMap });
    this.notify('All data cleared.', '', 'info');
  }

  /**
   * @param {string} message
   * @param {string} [cause]
   * @param {'error'|'info'} [kind]
   */
  notify(message, cause = '', kind = 'error') {
    this.els.notice.className = `notice notice--visible${kind === 'info' ? ' notice--info' : ''}`;
    this.els.notice.innerHTML = cause
      ? `${escapeHtml(message)}<span class="notice__cause">${escapeHtml(cause)}</span>`
      : escapeHtml(message);

    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      this.els.notice.classList.remove('notice--visible');
    }, 6000);
  }
}

/**
 * Minimal corpus assembled from the bundled starter quotes, used only when the
 * full library cannot be fetched.
 */
function buildStarterCorpus() {
  return new Corpus({
    groups: [
      { name: 'short', min: 0, max: 100 },
      { name: 'medium', min: 101, max: 300 },
    ],
    quotes: STARTER_QUOTES.map((q, i) => ({
      id: i,
      text: q.text,
      source: q.attr,
      length: q.text.length,
      group: q.text.length <= 100 ? 0 : 1,
    })),
  });
}

/** @param {string} v */
function escapeHtml(v) {
  return v.replace(/[&<>"']/g, (ch) =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  );
}
