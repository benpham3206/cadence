import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Lightweight DOM simulation for integration tests
const mockEl = (tag = 'div') => {
  const el = {
    tagName: tag,
    _className: '',
    get className() { return this._className; },
    set className(v) {
      this._className = v;
      this.classList._set.clear();
      v.split(/\s+/).forEach(c => c && this.classList._set.add(c));
    },
    style: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, force) {
        if (force === true) this._set.add(c);
        else if (force === false) this._set.delete(c);
        else this._set.has(c) ? this._set.delete(c) : this._set.add(c);
      },
      contains(c) { return this._set.has(c); },
    },
    _children: [],
    get children() { return this._children; },
    _innerHTML: '',
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) {
      this._innerHTML = v;
      this._children = [];
      // naive parser for <span class="..." data-i="n">text</span>
      const re = /<span\s+class="([^"]+)"\s+data-i="([^"]+)">([^<]*)<\/span>/g;
      let m;
      while ((m = re.exec(v)) !== null) {
        const child = mockEl('span');
        child.className = m[1];
        child.dataset.i = m[2];
        child.textContent = m[3];
        child._innerHTML = m[3];
        this._children.push(child);
      }
    },
    textContent: '',
    dataset: {},
    appendChild(c) { this._children.push(c); },
    addEventListener() {},
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k] || null; },
    querySelector(sel) {
      const m = sel.match(/\[data-i="([^"]+)"\]/);
      if (m) return this._children.find(c => c.dataset.i === m[1]) || null;
      const idm = sel.match(/#([A-Za-z0-9_-]+)/);
      if (idm) return this._children.find(c => c.id === idm[1]) || null;
      return this._children[0] || null;
    },
    querySelectorAll(sel) {
      if (sel === '.finger-key') return this._children.filter(c => c.classList && c.classList.contains('finger-key'));
      return [];
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
    focus() { mockDocument.activeElement = this; },
    blur() { if (mockDocument.activeElement === this) mockDocument.activeElement = null; },
    requestFullscreen() { return Promise.resolve(); },
  };
  return el;
};

const mockDocument = {
  activeElement: null,
  _els: {},
  getElementById(id) {
    if (!this._els[id]) this._els[id] = mockEl();
    return this._els[id];
  },
  querySelector() { return null; },
  addEventListener() {},
  createElement(tag) { return mockEl(tag); },
};

const mockWindow = {
  addEventListener() {},
  matchMedia() { return { matches: false }; },
  AudioContext: class MockAudioContext {
    get currentTime() { return 0; }
    resume() { return Promise.resolve(); }
    createOscillator() {
      return {
        type: 'sine',
        frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() {},
        stop() {},
      };
    }
    createGain() {
      return {
        gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      };
    }
  },
};

Object.defineProperty(globalThis, 'document', { value: mockDocument, configurable: true });
Object.defineProperty(globalThis, 'window', { value: mockWindow, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: { serviceWorker: { register: () => Promise.resolve() } }, configurable: true });
Object.defineProperty(globalThis, 'performance', { value: { now: () => Date.now() }, configurable: true });

import { TypingStage } from '../src/components/TypingStage.js';
import { MetricsPanel } from '../src/components/MetricsPanel.js';
import { IntelligencePanel } from '../src/components/IntelligencePanel.js';
import { Zen } from '../src/app/zen.js';
import { DigraphMap } from '../src/core/digraph.js';

describe('Integration: Components', () => {
  test('TypingStage renders text as spans', () => {
    const container = document.createElement('div');
    const stage = new TypingStage(container, {});
    stage.renderText('hello', 'Test');
    assert.equal(stage.els.text.children.length, 5);
  });

  test('correct keystroke advances cursor', () => {
    const container = document.createElement('div');
    const stage = new TypingStage(container, {});
    stage.renderText('hi', 'Test');
    stage.markCorrect(0);
    stage.setCurrent(1);
    assert.ok(stage.els.text.children[0].classList.contains('char-correct'));
    assert.ok(stage.els.text.children[1].classList.contains('char-current'));
  });

  test('incorrect keystroke triggers error state', () => {
    const container = document.createElement('div');
    const stage = new TypingStage(container, {});
    stage.renderText('x', 'Test');
    stage.markError(0);
    assert.ok(stage.els.text.children[0].classList.contains('char-shake'));
  });

  test('MetricsPanel clears resets all displays', () => {
    const container = document.createElement('div');
    const dm = new DigraphMap();
    const panel = new MetricsPanel(container, dm, () => {});
    panel.updateStats({ ksCount: 10, avgDwell: 100, avgFlight: 50, consistency: 80 });
    panel.clear();
    assert.ok(panel.els.dwell.innerHTML.includes('—'));
    assert.equal(panel.els.ks.textContent, '0');
  });

  test('IntelligencePanel updates identity text', () => {
    const container = document.createElement('div');
    const profile = { sessions: [{ wpm: 100 }], chunkHorizon: 1.5 };
    const panel = new IntelligencePanel(container, profile, { getWeakList: () => [] }, {});
    panel.updateIdentity(profile, []);
    assert.ok(panel.els.identity.textContent.includes('100 WPM'));
  });

  test('Zen toggle adds and removes class', () => {
    const zen = new Zen();
    const el = document.createElement('div');
    zen.toggle(el, true);
    assert.ok(el.classList.contains('zen-mode'));
    zen.toggle(el, false);
    assert.ok(!el.classList.contains('zen-mode'));
  });
});
