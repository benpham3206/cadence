import assert from 'node:assert/strict';
import test from 'node:test';
import { App } from '../../src/app/App.js';
import { Corpus } from '../../src/core/corpus.js';
import { DigraphMap } from '../../src/core/digraph.js';
import { SessionFlow } from '../../src/core/session-flow.js';

const profile = {
  digraphStats: { zq: { count: 5, mean: 900, m2: 0 } },
  settings: { lengthGroups: [0], quotesPerCycle: 4, targetedPerCycle: 2 },
};

test('notifies when a manual drill has no matching text', () => {
  const notices = [];
  const loadedPassages = [];
  const loggedErrors = [];
  const app = Object.create(App.prototype);
  app.pendingDigraph = 'zq';
  app.profile = profile;
  app.corpus = new Corpus({
    groups: [{ name: 'short', min: 0, max: 100 }],
    quotes: [{ id: 1, text: 'Plain words are here.', source: 'fixture', length: 21, group: 0 }],
  });
  app.rotation = {
    next: () => ({
      ok: true,
      value: { id: 2, text: 'Ordinary reading quote.', source: 'fixture' },
    }),
  };
  app.digraphMap = new DigraphMap(profile.digraphStats);
  app.recent = { ids: [], add(id) { this.ids.push(id); } };
  app.recentSlow = [];
  app.flow = new SessionFlow(profile.settings);
  app.startPassage = (...args) => loadedPassages.push(args);
  app.notify = (...args) => notices.push(args);

  const originalError = console.error;
  console.error = (...args) => loggedErrors.push(args);
  try {
    app.nextPassage();
  } finally {
    console.error = originalError;
  }

  assert.equal(app.pendingDigraph, null);
  assert.equal(loadedPassages.at(-1)?.[3], 'quote');
  assert.equal(notices.length, 1);
  assert.equal(notices[0][0], 'No drill text is available for zq. Continuing with a regular quote.');
  assert.equal(loggedErrors.length, 1);
});
