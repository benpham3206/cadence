import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Ghost } from '../../src/app/ghost.js';

describe('Ghost Replay', () => {
  test('encode compresses events to delta array', () => {
    const ghost = new Ghost();
    const events = [
      { key: 'h', timestamp: 100 },
      { key: 'e', timestamp: 200 },
      { key: 'l', timestamp: 350 },
      { key: 'l', timestamp: 400 },
      { key: 'o', timestamp: 550 },
    ];
    const rec = ghost.encode('hello', events, 60, 0);
    assert.equal(rec.events.length, 5);
    assert.equal(rec.events[0].deltaMs, 0);
    assert.equal(rec.events[1].deltaMs, 100);
    assert.equal(rec.events[4].deltaMs, 450);
  });

  test('encode handles single keystroke', () => {
    const ghost = new Ghost();
    const rec = ghost.encode('a', [{ key: 'a', timestamp: 1000 }], 10, 0);
    assert.equal(rec.events.length, 1);
    assert.equal(rec.events[0].deltaMs, 0);
  });

  test('isBetterThan prefers higher WPM', () => {
    const ghost = new Ghost();
    const a = { wpm: 80, accuracy: 95 };
    const b = { wpm: 100, accuracy: 90 };
    assert.ok(ghost.isBetterThan(b, a));
  });

  test('isBetterThan uses accuracy as tiebreaker', () => {
    const ghost = new Ghost();
    const a = { wpm: 100, accuracy: 95 };
    const b = { wpm: 100, accuracy: 98 };
    assert.ok(ghost.isBetterThan(b, a));
  });

  test('generateTextHash produces consistent hashes', () => {
    const ghost = new Ghost();
    assert.equal(ghost.hash('hello'), ghost.hash('hello'));
  });

  test('generateTextHash differs for different texts', () => {
    const ghost = new Ghost();
    assert.notEqual(ghost.hash('hello'), ghost.hash('world'));
  });

  test('overlayPositionAt returns correct char index at time T', () => {
    const ghost = new Ghost();
    const rec = {
      events: [
        { charIndex: 0, deltaMs: 0 },
        { charIndex: 1, deltaMs: 100 },
        { charIndex: 2, deltaMs: 300 },
      ],
    };
    assert.equal(ghost.overlayPositionAt(rec, 50), 0);
    assert.equal(ghost.overlayPositionAt(rec, 150), 1);
    assert.equal(ghost.overlayPositionAt(rec, 350), 2);
  });

  test('overlayPositionAt clamps to last char after session end', () => {
    const ghost = new Ghost();
    const rec = {
      events: [
        { charIndex: 0, deltaMs: 0 },
        { charIndex: 1, deltaMs: 100 },
      ],
    };
    assert.equal(ghost.overlayPositionAt(rec, 9999), 1);
  });
});
