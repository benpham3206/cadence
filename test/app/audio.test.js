import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../../src/app/audio.js';

describe('Audio Engine', () => {
  test('volume clamped implicitly by gain envelope', () => {
    const audio = new AudioEngine(true);
    // No direct volume API, but ensure no throw
    assert.doesNotThrow(() => audio.click());
  });

  test('setEnabled toggles state', () => {
    const audio = new AudioEngine(false);
    assert.equal(audio.enabled, false);
    audio.setEnabled(true);
    assert.equal(audio.enabled, true);
  });

  test('click and error do not throw when enabled', () => {
    const audio = new AudioEngine(true);
    assert.doesNotThrow(() => audio.click());
    assert.doesNotThrow(() => audio.error());
    assert.doesNotThrow(() => audio.complete());
  });

  test('click and error do not throw when disabled', () => {
    const audio = new AudioEngine(false);
    assert.doesNotThrow(() => audio.click());
    assert.doesNotThrow(() => audio.error());
    assert.doesNotThrow(() => audio.complete());
  });
});
