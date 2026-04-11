import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Coach } from '../../src/app/coach.js';

describe('Coach Analysis', () => {
  test('detects fatigue curve (slowing over session)', () => {
    const coach = new Coach();
    const events = [];
    for (let i = 0; i < 20; i++) events.push({ key: 'a', dwell: 80 });
    for (let i = 0; i < 20; i++) events.push({ key: 'a', dwell: 150 });
    const tips = coach.analyze(events, { getWeakList: () => [] }, []);
    assert.ok(tips.some(t => t.toLowerCase().includes('dwell')) || tips.some(t => t.toLowerCase().includes('breath')));
  });

  test('celebrates consistency above 90%', () => {
    const coach = new Coach();
    const events = Array.from({ length: 20 }, () => ({ key: 'a', dwell: 100 }));
    const tips = coach.analyze(events, { getWeakList: () => [] }, []);
    assert.ok(tips.some(t => t.toLowerCase().includes('consistency')));
  });

  test('suggests practice when only quotes and weak digraphs exist', () => {
    const coach = new Coach();
    const events = Array.from({ length: 20 }, () => ({ key: 'a', dwell: 100 }));
    const sessions = [
      { track: 'C' }, { track: 'C' }, { track: 'C' }, { track: 'C' }, { track: 'C' }
    ];
    const tips = coach.analyze(events, { getWeakList: () => [{ digraph: 'qu' }] }, sessions);
    assert.ok(tips.some(t => t.toLowerCase().includes('practice')));
  });

  test('fingerForDigraph returns correct finger mapping', () => {
    const coach = new Coach();
    assert.equal(coach.fingerForDigraph('q', 'w').from, 'left-pinky');
    assert.equal(coach.fingerForDigraph('q', 'w').to, 'left-ring');
  });

  test('fingerForDigraph handles same-finger transitions', () => {
    const coach = new Coach();
    assert.equal(coach.fingerForDigraph('f', 'g').from, 'left-index');
    assert.equal(coach.fingerForDigraph('f', 'g').to, 'left-index');
  });

  test('returns empty tips when no patterns detected', () => {
    const coach = new Coach();
    const events = Array.from({ length: 5 }, () => ({ key: 'a', dwell: 100 }));
    const tips = coach.analyze(events, { getWeakList: () => [] }, []);
    assert.equal(tips.length, 0);
  });

  test('same-finger weak digraph gets specific tip', () => {
    const coach = new Coach();
    const dm = {
      getWeakList: (n) => [{ digraph: 'fg', mean: 300, count: 10 }]
    };
    const tips = coach.analyze(Array.from({ length: 20 }, () => ({ key: 'a', dwell: 100 })), dm, []);
    assert.ok(tips.some(t => t.toLowerCase().includes('same-finger')));
  });
});
