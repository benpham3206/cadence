import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

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
      const brRe = /<(br\/?)>/g;
      while ((m = brRe.exec(v)) !== null) {
        const br = mockEl('br');
        this._children.push(br);
      }
    },
    textContent: '',
    dataset: {},
    id: '',
    appendChild(c) { this._children.push(c); },
    addEventListener() {},
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k] || null; },
    querySelector(sel) {
      const m = sel.match(/\[data-i="([^"]+)"\]/);
      if (m) return this._children.find(c => c.dataset && c.dataset.i === m[1]) || null;
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
    createOscillator() { return { type: 'sine', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  },
};

Object.defineProperty(globalThis, 'document', { value: mockDocument, configurable: true });
Object.defineProperty(globalThis, 'window', { value: mockWindow, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: { serviceWorker: { register: () => Promise.resolve() } }, configurable: true });
Object.defineProperty(globalThis, 'performance', { value: { now: () => Date.now() }, configurable: true });

import { TypingStage } from '../src/components/TypingStage.js';
import { IntelligencePanel } from '../src/components/IntelligencePanel.js';

describe('Regression: Mode Toggle Sync', () => {
  test('TypingStage updateMode reflects practice mode and hides sub-pills', () => {
    const stage = new TypingStage(document.createElement('div'), {});
    stage.updateMode('practice', false);
    assert.equal(stage.els.pillQuote.textContent, 'practice');
    assert.ok(stage.els.pillQuote.classList.contains('active-accent'));
    assert.equal(stage.els.pillChunk.style.display, 'none');
    assert.equal(stage.els.pillTransfer.style.display, 'none');
  });

  test('TypingStage updateMode reflects quote mode and shows sub-pills', () => {
    const stage = new TypingStage(document.createElement('div'), {});
    stage.updateMode('quote', true);
    assert.equal(stage.els.pillQuote.textContent, 'quote');
    assert.ok(stage.els.pillQuote.classList.contains('active'));
    assert.notEqual(stage.els.pillChunk.style.display, 'none');
    assert.notEqual(stage.els.pillTransfer.style.display, 'none');
  });

  test('IntelligencePanel updateMode reflects practice mode', () => {
    const profile = { sessions: [], chunkHorizon: 1.5 };
    const panel = new IntelligencePanel(document.createElement('div'), profile, { getWeakList: () => [] }, {});
    panel.updateMode('practice');
    const btn = document.getElementById('btn-mode');
    assert.equal(btn.textContent, 'practice');
    assert.ok(btn.classList.contains('active-accent'));
  });
});

describe('Regression: Chunk Nudge Settings', () => {
  test('Profile defaults include chunkNudgeEnabled', () => {
    // Import dynamically after global mocks are set
    return import('../src/core/profile.js').then(({ Profile }) => {
      const p = Profile._default();
      assert.equal(p.settings.chunkNudgeEnabled, true);
    });
  });

  test('Profile migration adds chunkNudgeEnabled to v1 profiles', () => {
    return import('../src/core/profile.js').then(({ Profile }) => {
      const v1 = { version: 1 };
      const migrated = Profile._migrate(v1);
      assert.equal(migrated.settings.chunkNudgeEnabled, true);
    });
  });
});
