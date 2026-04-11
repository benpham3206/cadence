import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Coach } from '../../src/app/coach.js';

describe('Finger Map', () => {
  const coach = new Coach();

  test('keyToFinger maps QWERTY correctly', () => {
    assert.equal(coach.fingerForKey('a'), 'left-pinky');
    assert.equal(coach.fingerForKey('s'), 'left-ring');
    assert.equal(coach.fingerForKey('d'), 'left-middle');
    assert.equal(coach.fingerForKey('f'), 'left-index');
    assert.equal(coach.fingerForKey('j'), 'right-index');
    assert.equal(coach.fingerForKey('k'), 'right-middle');
    assert.equal(coach.fingerForKey('l'), 'right-ring');
    assert.equal(coach.fingerForKey(';'), 'right-pinky');
  });

  test('keyToFinger maps space to thumbs', () => {
    assert.equal(coach.fingerForKey(' '), 'thumb');
  });

  test('keyToFinger returns null for unknown keys', () => {
    assert.equal(coach.fingerForKey('é'), null);
    assert.equal(coach.fingerForKey(''), null);
  });

  test('sameFingerDigraphs filters by finger', () => {
    const same = [
      { key: 'f' }, { key: 'g' }, // left-index
      { key: 'f' }, { key: 'd' }, // left-index -> left-middle
      { key: 'f' }, { key: 'r' }, // left-index
    ];
    const pairs = [];
    for (let i = 1; i < same.length; i++) {
      const f1 = coach.fingerForKey(same[i - 1].key);
      const f2 = coach.fingerForKey(same[i].key);
      if (f1 && f2 && f1 === f2) pairs.push(`${same[i - 1].key}${same[i].key}`);
    }
    assert.ok(pairs.includes('fg'));
    assert.ok(!pairs.includes('fd'));
  });
});
