import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Ghost } from '../../src/app/ghost.js';

describe('Session Cinema', () => {
  test('encodeSessionToCinema strips DOM references', () => {
    const ghost = new Ghost();
    const events = [
      { key: 'a', timestamp: 100, dwell: 50 },
      { key: 'b', timestamp: 200, dwell: 60 },
    ];
    const rec = ghost.encode('ab', events, 30, 0);
    const keys = Object.keys(rec.events[0]);
    assert.ok(!keys.includes('target'));
    assert.ok(keys.includes('charIndex'));
    assert.ok(keys.includes('deltaMs'));
  });

  test('cinemaDataSize is under 50KB for 1000 keystrokes', () => {
    const ghost = new Ghost();
    const events = [];
    for (let i = 0; i < 1000; i++) {
      events.push({ key: 'a', timestamp: i * 100 });
    }
    const rec = ghost.encode('a'.repeat(1000), events, 60, 0);
    const size = JSON.stringify(rec).length;
    assert.ok(size < 50 * 1024, `Size ${size} >= 50KB`);
  });
});
