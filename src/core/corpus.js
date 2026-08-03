import { ok, fail, failFrom } from './result.js';

/**
 * The quote corpus, held in memory once fetched.
 *
 * Quote text is lower-cased lazily and cached, because digraph scanning runs
 * over the whole corpus every time a targeted quote is chosen and repeated
 * `toLowerCase()` over ~1.4M characters is the one hot loop worth avoiding.
 */
export class Corpus {
  /**
   * @param {{ quotes: Array<{id:number,text:string,source:string,length:number,group:number}>,
   *           groups: Array<{name:string,min:number,max:number|null}> }} data
   */
  constructor(data) {
    this.quotes = data.quotes;
    this.groups = data.groups;
    /** @type {Map<number, string>} */
    this._lowerCache = new Map();
  }

  get size() {
    return this.quotes.length;
  }

  /**
   * @param {{id:number,text:string}} quote
   * @returns {string}
   */
  lowerText(quote) {
    let cached = this._lowerCache.get(quote.id);
    if (cached === undefined) {
      cached = quote.text.toLowerCase();
      this._lowerCache.set(quote.id, cached);
    }
    return cached;
  }

  /**
   * @param {string} name  One of the group names, e.g. 'short'.
   * @returns {number} group index, or -1 when unknown.
   */
  groupIndex(name) {
    return this.groups.findIndex((g) => g.name === name);
  }

  /**
   * @param {number[]|null} groupFilter  Allowed group indices, or null for all.
   * @returns {Array<{id:number,text:string,source:string,length:number,group:number}>}
   */
  filterByGroups(groupFilter) {
    if (!groupFilter || groupFilter.length === 0) return this.quotes;
    const allowed = new Set(groupFilter);
    const out = this.quotes.filter((q) => allowed.has(q.group));
    return out.length > 0 ? out : this.quotes;
  }
}

/**
 * Validates a raw corpus payload before it is trusted by the rest of the app.
 *
 * @param {unknown} data
 * @returns {import('./result.js').Success<Corpus> | import('./result.js').Failure}
 */
export function parseCorpus(data) {
  if (data === null || typeof data !== 'object') {
    return fail('corpus.parse', 'validation', 'corpus payload is not an object', { received: typeof data });
  }

  const { quotes, groups } = /** @type {any} */ (data);

  if (!Array.isArray(quotes)) {
    return fail('corpus.parse', 'validation', 'corpus payload has no `quotes` array');
  }
  if (quotes.length === 0) {
    return fail('corpus.parse', 'validation', 'corpus contains zero quotes');
  }
  if (!Array.isArray(groups)) {
    return fail('corpus.parse', 'validation', 'corpus payload has no `groups` array');
  }

  const first = quotes[0];
  if (typeof first?.text !== 'string' || typeof first?.id !== 'number') {
    return fail('corpus.parse', 'validation', 'quote entries are missing required `id` and `text` fields', {
      firstEntry: first,
    });
  }

  return ok(new Corpus({ quotes, groups }));
}

/**
 * Fetches and parses the corpus.
 *
 * @param {string} url
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<import('./result.js').Success<Corpus> | import('./result.js').Failure>}
 */
export async function loadCorpus(url, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    return fail('corpus.load', 'unsupported', 'no fetch implementation available in this environment');
  }

  let response;
  try {
    response = await fetchImpl(url);
  } catch (err) {
    return failFrom('corpus.load', 'network', err, { url });
  }

  if (!response.ok) {
    return fail('corpus.load', 'network', `corpus request returned HTTP ${response.status}`, {
      url,
      status: response.status,
    });
  }

  let payload;
  try {
    payload = await response.json();
  } catch (err) {
    return failFrom('corpus.load', 'parse', err, { url });
  }

  return parseCorpus(payload);
}
