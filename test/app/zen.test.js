import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Zen } from '../../src/app/zen.js';

describe('Zen Mode', () => {
  test('toggle adds/removes zen-mode class', () => {
    const zen = new Zen();
    const el = { classList: { contains: () => false, toggle: (cls, active) => { el.active = active; } } };
    zen.toggle(el, true);
    assert.equal(el.active, true);
    zen.toggle(el, false);
    assert.equal(el.active, false);
  });
});
