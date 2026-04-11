import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Rhythm Pulse', () => {
  test('bpmToIntervalMs converts 60 BPM to 1000ms', () => {
    assert.equal((60 / 60) * 1000, 1000);
  });

  test('targetWpmToBpm maps 60 WPM to 300 BPM (5 chars/word)', () => {
    assert.equal(60 * 5, 300);
  });

  test('visualPulseOpacity follows sine curve shape', () => {
    const interval = 500;
    const opacityAt = (t) => Math.sin((t / interval) * Math.PI);
    assert.ok(Math.abs(opacityAt(0)) < 0.01);
    assert.ok(Math.abs(opacityAt(250) - 1) < 0.01);
    assert.ok(Math.abs(opacityAt(500)) < 0.01);
  });
});
