#!/usr/bin/env node
/**
 * Builds the Cadence quote corpus from the monkeytype English quote set.
 *
 * The output is committed to the repository so that production builds never
 * depend on network access. Re-run with `npm run build:quotes` to refresh.
 *
 * Source: https://github.com/monkeytypegame/monkeytype (GPL-3.0)
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const OUT_PATH = resolve(REPO_ROOT, 'public/quotes/english.json');

const SOURCE_URL =
  'https://raw.githubusercontent.com/monkeytypegame/monkeytype/master/frontend/static/quotes/english.json';

/**
 * Length boundaries, inclusive, matching monkeytype's own grouping so that
 * users coming from monkeytype get the length buckets they already know.
 */
const LENGTH_GROUPS = [
  { name: 'short', min: 0, max: 100 },
  { name: 'medium', min: 101, max: 300 },
  { name: 'long', min: 301, max: 600 },
  { name: 'thicc', min: 601, max: Infinity },
];

/**
 * Characters that are not on a US keyboard, mapped to typeable equivalents.
 * A typist chasing 130+ WPM should never stall on a character they cannot
 * reach without a modifier chord.
 */
const CHARACTER_SUBSTITUTIONS = new Map([
  ['\u2018', "'"],
  ['\u2019', "'"],
  ['\u201c', '"'],
  ['\u201d', '"'],
  ['\u2013', '-'],
  ['\u2014', '-'],
  ['\u2026', '...'],
  ['\u00a0', ' '],
  ['\u200b', ''],
  ['\n', ' '],
  ['\r', ' '],
  ['\t', ' '],
]);

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeText(raw) {
  let out = '';
  for (const ch of raw) {
    const replacement = CHARACTER_SUBSTITUTIONS.get(ch);
    out += replacement !== undefined ? replacement : ch;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isTypeable(text) {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 || code > 126) return false;
  }
  return true;
}

/**
 * @param {number} length
 * @returns {number} index into LENGTH_GROUPS
 */
function groupIndexFor(length) {
  for (let i = 0; i < LENGTH_GROUPS.length; i++) {
    if (length >= LENGTH_GROUPS[i].min && length <= LENGTH_GROUPS[i].max) return i;
  }
  return LENGTH_GROUPS.length - 1;
}

/**
 * Reads the upstream corpus, preferring a local cache so the build is
 * reproducible offline once the file has been fetched at least once.
 *
 * @returns {Promise<{ quotes: Array<{ text: string, source: string }> }>}
 */
async function fetchSource() {
  const cachePath = resolve(REPO_ROOT, 'node_modules/.cache/monkeytype-english.json');

  try {
    const cached = await readFile(cachePath, 'utf8');
    process.stdout.write('using cached upstream corpus\n');
    return JSON.parse(cached);
  } catch {
    // No cache yet; fall through to a network fetch.
  }

  let response;
  try {
    response = await fetch(SOURCE_URL);
  } catch (err) {
    throw new Error(
      `build-quotes/network: cannot reach ${SOURCE_URL} (${err instanceof Error ? err.message : String(err)})`
    );
  }

  if (!response.ok) {
    throw new Error(`build-quotes/network: upstream returned HTTP ${response.status} for ${SOURCE_URL}`);
  }

  const body = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new Error(
      `build-quotes/parse: upstream payload is not valid JSON (${err instanceof Error ? err.message : String(err)})`
    );
  }

  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, body);
  return parsed;
}

async function main() {
  const upstream = await fetchSource();

  if (!Array.isArray(upstream?.quotes)) {
    throw new Error('build-quotes/validation: upstream payload has no `quotes` array');
  }

  const seen = new Set();
  const quotes = [];
  const rejected = { untypeable: 0, duplicate: 0, tooShort: 0 };

  for (const entry of upstream.quotes) {
    if (typeof entry?.text !== 'string') continue;

    const text = normalizeText(entry.text);

    if (text.length < 20) {
      rejected.tooShort++;
      continue;
    }
    if (!isTypeable(text)) {
      rejected.untypeable++;
      continue;
    }

    const dedupeKey = text.toLowerCase();
    if (seen.has(dedupeKey)) {
      rejected.duplicate++;
      continue;
    }
    seen.add(dedupeKey);

    quotes.push({
      id: quotes.length,
      text,
      source: typeof entry.source === 'string' ? normalizeText(entry.source) : 'Unknown',
      length: text.length,
      group: groupIndexFor(text.length),
    });
  }

  if (quotes.length === 0) {
    throw new Error('build-quotes/validation: every upstream quote was rejected, refusing to write an empty corpus');
  }

  const corpus = {
    language: 'english',
    upstream: 'monkeytypegame/monkeytype (GPL-3.0)',
    generatedAt: new Date().toISOString().slice(0, 10),
    groups: LENGTH_GROUPS.map((g) => ({ name: g.name, min: g.min, max: g.max === Infinity ? null : g.max })),
    quotes,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(corpus));

  const perGroup = LENGTH_GROUPS.map((g, i) => `${g.name}=${quotes.filter((q) => q.group === i).length}`);
  process.stdout.write(
    `wrote ${quotes.length} quotes to public/quotes/english.json\n` +
      `  groups: ${perGroup.join(' ')}\n` +
      `  rejected: untypeable=${rejected.untypeable} duplicate=${rejected.duplicate} tooShort=${rejected.tooShort}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
