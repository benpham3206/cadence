import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { buildDigraphKey, DigraphMap } from '../../src/core/digraph.js';
import { computeConsistency } from '../../src/core/consistency.js';
import { generateDrillText } from '../../src/core/drill.js';
import { Profile, CURRENT_VERSION } from '../../src/core/profile.js';
import { Run, PRESS } from '../../src/core/run.js';
import { analyzeRun } from '../../src/core/coach.js';
import { resolveChar, fingerForChar, isSameFingerBigram, FINGER } from '../../src/core/keyboard-layout.js';

describe('buildDigraphKey', () => {
  test('joins two characters', () => {
    assert.equal(buildDigraphKey('t', 'h'), 'th');
  });

  test('normalises case so Th and th are one transition', () => {
    assert.equal(buildDigraphKey('T', 'H'), 'th');
  });

  test('returns null when either side is missing', () => {
    assert.equal(buildDigraphKey(null, 'h'), null);
    assert.equal(buildDigraphKey('t', null), null);
  });
});

describe('DigraphMap', () => {
  test('records a mean from a single sample', () => {
    const map = new DigraphMap();
    map.update('th', 120);
    assert.equal(map.getStats('th').mean, 120);
    assert.equal(map.getStats('th').count, 1);
  });

  test('averages repeated samples', () => {
    const map = new DigraphMap();
    map.update('th', 100);
    map.update('th', 200);
    assert.equal(map.getStats('th').mean, 150);
  });

  test('stays numerically stable over many updates', () => {
    const map = new DigraphMap();
    for (let i = 0; i < 1000; i++) map.update('th', 100 + (i % 3));
    const stats = map.getStats('th');
    assert.ok(Math.abs(stats.mean - 101) < 0.01, `mean drifted to ${stats.mean}`);
    assert.ok(stats.stddev > 0.7 && stats.stddev < 0.9, `stddev ${stats.stddev}`);
  });

  test('rejects negative and implausibly long flight times', () => {
    const map = new DigraphMap();
    map.update('th', -50);
    map.update('th', 5000);
    assert.equal(map.getStats('th'), null);
  });

  test('withholds a transition from the weak list until it is well sampled', () => {
    const map = new DigraphMap();
    for (let i = 0; i < 4; i++) map.update('zx', 900);
    assert.equal(map.getWeakList().length, 0);
    map.update('zx', 900);
    assert.equal(map.getWeakList()[0].digraph, 'zx');
  });

  test('ranks the weak list slowest first', () => {
    const map = new DigraphMap();
    for (let i = 0; i < 5; i++) {
      map.update('fast', 80);
      map.update('sl', 300);
      map.update('mid', 150);
    }
    assert.equal(map.getWeakList()[0].digraph, 'sl');
  });

  test('weights the overall mean by sample count', () => {
    const map = new DigraphMap();
    for (let i = 0; i < 10; i++) map.update('aa', 100);
    for (let i = 0; i < 5; i++) map.update('bb', 400);
    // (10*100 + 5*400) / 15 = 200
    assert.equal(Math.round(map.getOverallMean()), 200);
  });

  test('survives a serialise and reload round trip', () => {
    const map = new DigraphMap();
    for (let i = 0; i < 5; i++) map.update('th', 120 + i);
    const restored = new DigraphMap(map.toJSON());
    assert.deepEqual(restored.getStats('th'), map.getStats('th'));
  });

  test('produces a full 26x26 grid regardless of coverage', () => {
    assert.equal(new DigraphMap().toHeatmapData().length, 676);
  });
});

describe('computeConsistency', () => {
  test('is 100 when every dwell is identical', () => {
    assert.equal(computeConsistency([80, 80, 80, 80]), 100);
  });

  test('is 0 when dwells swing wildly', () => {
    assert.equal(computeConsistency([10, 500, 10, 500, 10]), 0);
  });

  test('sits in between for moderate variation', () => {
    const value = computeConsistency([80, 90, 85, 75, 95]);
    assert.ok(value > 20 && value < 100, `got ${value}`);
  });

  test('needs at least two samples', () => {
    assert.equal(computeConsistency([80]), 0);
    assert.equal(computeConsistency([]), 0);
  });
});

describe('generateDrillText', () => {
  test('returns null without targets', () => {
    assert.equal(generateDrillText([], 10), null);
  });

  test('produces the requested number of words', () => {
    const text = generateDrillText([{ digraph: 'th' }], 12);
    assert.equal(text.split(' ').length, 12);
  });

  test('never repeats the same word back to back', () => {
    const words = generateDrillText([{ digraph: 'er' }], 40).split(' ');
    for (let i = 1; i < words.length; i++) {
      assert.notEqual(words[i], words[i - 1]);
    }
  });

  test('returns null when no word contains the target', () => {
    assert.equal(generateDrillText([{ digraph: 'zq' }], 10), null);
  });
});

describe('keyboard layout', () => {
  test('maps home row to the correct fingers', () => {
    assert.equal(fingerForChar('a'), FINGER.L_PINKY);
    assert.equal(fingerForChar('f'), FINGER.L_INDEX);
    assert.equal(fingerForChar('j'), FINGER.R_INDEX);
    assert.equal(fingerForChar(';'), FINGER.R_PINKY);
  });

  test('assigns m to the right index, not the middle', () => {
    assert.equal(fingerForChar('m'), FINGER.R_INDEX);
  });

  test('assigns the hyphen and equals to the right pinky', () => {
    assert.equal(fingerForChar('-'), FINGER.R_PINKY);
    assert.equal(fingerForChar('='), FINGER.R_PINKY);
  });

  test('resolves a capital to its base key plus shift', () => {
    const resolved = resolveChar('A');
    assert.equal(resolved.key, 'a');
    assert.equal(resolved.shift, true);
  });

  test('holds shift with the hand opposite the character', () => {
    assert.equal(resolveChar('A').shiftFinger, FINGER.R_PINKY);
    assert.equal(resolveChar('L').shiftFinger, FINGER.L_PINKY);
  });

  test('treats space as a thumb key needing no shift', () => {
    assert.equal(resolveChar(' ').finger, FINGER.R_THUMB);
    assert.equal(resolveChar(' ').shiftFinger, null);
  });

  test('returns null for characters not on the layout', () => {
    assert.equal(resolveChar('\u00e9'), null);
    assert.equal(resolveChar('ab'), null);
  });

  test('detects same-finger bigrams', () => {
    assert.equal(isSameFingerBigram('e', 'd'), true);
    assert.equal(isSameFingerBigram('t', 'h'), false);
  });

  test('does not call a repeated character a same-finger bigram', () => {
    assert.equal(isSameFingerBigram('e', 'e'), false);
  });
});

describe('Run', () => {
  test('advances on a correct keystroke', () => {
    const run = new Run('ab');
    assert.equal(run.press('a', 0).status, PRESS.CORRECT);
    assert.equal(run.cursor, 1);
  });

  test('reports completion on the final character', () => {
    const run = new Run('ab');
    run.press('a', 0);
    assert.equal(run.press('b', 100).status, PRESS.COMPLETE);
    assert.equal(run.complete, true);
  });

  test('advances past an error rather than blocking on it', () => {
    const run = new Run('ab');
    assert.equal(run.press('x', 0).status, PRESS.INCORRECT);
    assert.equal(run.cursor, 1);
  });

  test('ends the passage even when the final character is wrong', () => {
    const run = new Run('ab');
    run.press('a', 0);
    run.press('x', 100);
    assert.equal(run.complete, true);
  });

  test('excludes standing errors from net WPM', () => {
    // Ten characters in six seconds, one of them wrong: nine correct is 18 WPM.
    const run = new Run('abcdefghij');
    const typed = 'abcdefghiX';
    for (let i = 0; i < typed.length; i++) run.press(typed[i], i * (6000 / 9));
    assert.equal(run.correctChars, 9);
    assert.equal(Math.round(run.wpm()), 18);
  });

  test('backspace steps back and clears the error at that position', () => {
    const run = new Run('ab');
    run.press('x', 0);
    assert.equal(run.errorIndices.size, 1);
    const out = run.backspace();
    assert.deepEqual(out.cleared, [0]);
    assert.equal(run.cursor, 0);
    assert.equal(run.errorIndices.size, 0);
  });

  test('backspace at the start of a passage does nothing', () => {
    const run = new Run('ab');
    const out = run.backspace();
    assert.equal(out.status, PRESS.IGNORED);
    assert.equal(run.cursor, 0);
  });

  test('backspace keeps the mistake in the accuracy count', () => {
    // Accuracy asks how often the right key was hit first time. Taking a
    // mistake back does not mean it was never made.
    const run = new Run('ab');
    run.press('x', 0);
    run.backspace();
    run.press('a', 20);
    run.press('b', 30);
    assert.equal(Math.round(run.accuracy), 67);
  });

  test('does not record a digraph across a correction', () => {
    const run = new Run('the');
    run.press('t', 0);
    run.press('x', 100);
    run.backspace();
    run.press('h', 200);
    run.press('e', 300);
    assert.deepEqual(
      run.digraphSamples.map((s) => s.digraph),
      ['he']
    );
  });

  test('backspace keeps one stroke per position', () => {
    const run = new Run('the');
    run.press('t', 0);
    run.press('x', 100);
    run.backspace();
    run.press('h', 200);
    assert.deepEqual(
      run.strokes.map((s) => s.index),
      [0, 1]
    );
  });

  test('ctrl+backspace clears the word to the left and its trailing space', () => {
    const run = new Run('the quick fox');
    for (const ch of 'the quick ') run.press(ch, 0);
    assert.equal(run.cursor, 10);
    run.backspaceWord();
    assert.equal(run.cursor, 4);
  });

  test('ctrl+backspace inside a word clears back to the word start', () => {
    const run = new Run('the quick fox');
    for (const ch of 'the qui') run.press(ch, 0);
    run.backspaceWord();
    assert.equal(run.cursor, 4);
  });

  test('starts the clock on the first keystroke, not on construction', () => {
    const run = new Run('abc');
    assert.equal(run.started, false);
    run.press('a', 500);
    assert.equal(run.startedAt, 500);
  });

  test('computes net WPM from correct characters', () => {
    // 10 characters in 6 seconds is 2 words in 0.1 minutes: 20 WPM.
    const run = new Run('abcdefghij');
    const text = 'abcdefghij';
    for (let i = 0; i < text.length; i++) run.press(text[i], i * (6000 / 9));
    assert.equal(Math.round(run.wpm()), 20);
  });

  test('records a digraph sample between consecutive correct keys', () => {
    const run = new Run('th');
    run.press('t', 0);
    run.press('h', 120);
    assert.deepEqual(run.digraphSamples, [{ digraph: 'th', flight: 120 }]);
  });

  test('does not record a digraph across an error', () => {
    // The pause after a miss is recovery time, not transition time, so the
    // transition into the character after the miss is skipped.
    const run = new Run('then');
    run.press('t', 0);
    run.press('x', 100);
    run.press('e', 900);
    run.press('n', 1000);
    assert.deepEqual(
      run.digraphSamples.map((s) => s.digraph),
      ['en']
    );
  });

  test('discards flight times long enough to be a pause', () => {
    const run = new Run('th');
    run.press('t', 0);
    run.press('h', 5000);
    assert.equal(run.digraphSamples.length, 0);
  });

  test('tracks accuracy against total keystrokes', () => {
    const run = new Run('abc');
    run.press('x', 0);
    run.press('b', 10);
    run.press('c', 20);
    assert.equal(Math.round(run.accuracy), 67);
  });

  test('counts a character wrong once even if missed repeatedly', () => {
    const run = new Run('ab');
    run.press('x', 0);
    run.backspace();
    run.press('y', 10);
    assert.equal(run.everWrong.size, 1);
  });

  test('ignores keystrokes after completion', () => {
    const run = new Run('a');
    run.press('a', 0);
    assert.equal(run.press('b', 10).status, PRESS.IGNORED);
  });

  test('rejects dwell times that are not plausible key holds', () => {
    const run = new Run('a');
    run.recordDwell(-5);
    run.recordDwell(5000);
    run.recordDwell(90);
    assert.deepEqual(run.dwells, [90]);
  });
});

describe('coach', () => {
  const manyDwells = Array.from({ length: 40 }, () => 80);

  test('says nothing without enough keystrokes', () => {
    assert.deepEqual(analyzeRun({ dwells: [80, 80], accuracy: 100, consistency: 50, weakDigraphs: [], wpm: 100 }), []);
  });

  test('flags fatigue when dwell climbs through the passage', () => {
    const dwells = [...Array(20).fill(70), ...Array(20).fill(120)];
    const tips = analyzeRun({ dwells, accuracy: 100, consistency: 50, weakDigraphs: [], wpm: 100 });
    assert.ok(tips.some((t) => t.kind === 'fatigue'));
  });

  test('flags accuracy below the working floor', () => {
    const tips = analyzeRun({ dwells: manyDwells, accuracy: 91, consistency: 50, weakDigraphs: [], wpm: 130 });
    assert.ok(tips.some((t) => t.kind === 'accuracy'));
  });

  test('names the finger for a same-finger transition', () => {
    const tips = analyzeRun({
      dwells: manyDwells,
      accuracy: 100,
      consistency: 50,
      weakDigraphs: [{ digraph: 'ed', mean: 200 }],
      wpm: 120,
    });
    const tip = tips.find((t) => t.kind === 'same-finger');
    assert.ok(tip);
    assert.match(tip.message, /left middle/);
  });

  test('celebrates an even rhythm', () => {
    const tips = analyzeRun({ dwells: manyDwells, accuracy: 100, consistency: 95, weakDigraphs: [], wpm: 140 });
    assert.ok(tips.some((t) => t.kind === 'consistency'));
  });

  test('never returns more tips than the limit', () => {
    const dwells = [...Array(20).fill(70), ...Array(20).fill(140)];
    const tips = analyzeRun({
      dwells,
      accuracy: 80,
      consistency: 99,
      weakDigraphs: [{ digraph: 'ed', mean: 300 }, { digraph: 'ol', mean: 290 }],
      wpm: 100,
    });
    assert.ok(tips.length <= 3);
  });
});

describe('Profile', () => {
  let storage;

  beforeEach(() => {
    const data = new Map();
    storage = {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
      _data: data,
    };
  });

  test('returns defaults for a fresh browser', () => {
    const profile = Profile.load(storage);
    assert.equal(profile.version, CURRENT_VERSION);
    assert.deepEqual(profile.digraphStats, {});
  });

  test('round-trips through storage', () => {
    const profile = Profile._default();
    profile.digraphStats = { th: { count: 5, mean: 100, m2: 20 } };
    Profile.save(profile, storage);
    assert.deepEqual(Profile.load(storage).digraphStats, profile.digraphStats);
  });

  test('reports a structured failure when storage rejects the write', () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    const result = Profile.save(Profile._default(), failing);
    assert.equal(result.ok, false);
    assert.equal(result.error.component, 'profile.save');
    assert.equal(result.error.failureType, 'storage');
    assert.match(result.error.rootCause, /Quota/);
  });

  test('falls back to defaults on corrupt JSON rather than throwing', () => {
    storage.setItem('cadence_profile_v3', '{not json');
    assert.equal(Profile.load(storage).version, CURRENT_VERSION);
  });

  test('carries digraph statistics forward from a v2 profile', () => {
    storage.setItem(
      'cadence_profile_v2',
      JSON.stringify({ version: 2, digraphStats: { th: { count: 9, mean: 111, m2: 4 } }, textCount: 42 })
    );
    const profile = Profile.load(storage);
    assert.equal(profile.version, CURRENT_VERSION);
    assert.equal(profile.digraphStats.th.count, 9);
    assert.equal(profile.textCount, 42);
  });

  test('drops the stored API key when migrating', () => {
    storage.setItem(
      'cadence_profile_v2',
      JSON.stringify({ version: 2, apiKey: 'sk-ant-secret', digraphStats: {} })
    );
    assert.equal(Profile.load(storage).apiKey, undefined);
  });

  test('removes the legacy record once migrated', () => {
    storage.setItem('cadence_profile_v2', JSON.stringify({ version: 2, digraphStats: {} }));
    Profile.load(storage);
    assert.equal(storage.getItem('cadence_profile_v2'), null);
  });

  test('migrates a v1 profile too', () => {
    storage.setItem('cadence_profile_v1', JSON.stringify({ version: 1, digraphStats: { er: { count: 3, mean: 90, m2: 1 } } }));
    assert.equal(Profile.load(storage).digraphStats.er.count, 3);
  });

  test('backfills settings added after the profile was written', () => {
    storage.setItem('cadence_profile_v3', JSON.stringify({ version: 3, settings: { theme: 'nord' } }));
    const profile = Profile.load(storage);
    assert.equal(profile.settings.theme, 'nord');
    assert.equal(profile.settings.showHands, true);
  });

  test('caps stored sessions so localStorage cannot grow without bound', () => {
    const profile = Profile._default();
    for (let i = 0; i < 520; i++) {
      Profile.appendSession(profile, { timestamp: i, wpm: 100 }, storage);
    }
    assert.equal(profile.sessions.length, 500);
    assert.equal(profile.sessions[0].timestamp, 20);
  });

  test('clear removes current and legacy records', () => {
    storage.setItem('cadence_profile_v3', '{}');
    storage.setItem('cadence_profile_v2', '{}');
    Profile.clear(storage);
    assert.equal(storage.getItem('cadence_profile_v3'), null);
    assert.equal(storage.getItem('cadence_profile_v2'), null);
  });

  test('import rejects malformed JSON with a structured failure', () => {
    const result = Profile.importProfile('{nope');
    assert.equal(result.ok, false);
    assert.equal(result.error.failureType, 'parse');
  });

  test('import rejects a payload with no version', () => {
    const result = Profile.importProfile('{"digraphStats":{}}');
    assert.equal(result.ok, false);
    assert.match(result.error.rootCause, /no version/);
  });

  test('import accepts and migrates an older export', () => {
    const result = Profile.importProfile(JSON.stringify({ version: 2, digraphStats: { th: { count: 1, mean: 5, m2: 0 } } }));
    assert.equal(result.ok, true);
    assert.equal(result.value.version, CURRENT_VERSION);
  });

  test('export produces text that import accepts', () => {
    const profile = Profile._default();
    profile.textCount = 7;
    const result = Profile.importProfile(Profile.exportProfile(profile));
    assert.equal(result.ok, true);
    assert.equal(result.value.textCount, 7);
  });
});
