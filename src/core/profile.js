import { ok, fail, failFrom } from './result.js';

/**
 * Persistent typist profile.
 *
 * Everything lives in localStorage: there are no accounts and no server. The
 * digraph statistics are the valuable part — they take real practice hours to
 * accumulate — so migration between versions never discards them.
 */

const PROFILE_KEY = 'cadence_profile_v3';
const LEGACY_KEYS = ['cadence_profile_v2', 'cadence_profile_v1'];

export const CURRENT_VERSION = 3;

/** Sessions retained for trend charts. Older entries are dropped oldest-first. */
const MAX_SESSIONS = 500;

export const DEFAULT_SETTINGS = {
  theme: 'cadence',
  showHands: true,
  soundOnError: false,
  /** Corpus length groups in rotation: short, medium, long, thicc. */
  lengthGroups: [0, 1, 2],
  quotesPerCycle: 4,
  targetedPerCycle: 2,
  /** Require the passage be typed exactly; no skipping ahead past an error. */
  strictMode: true,
};

/**
 * @returns {any}
 */
function defaultProfile() {
  return {
    version: CURRENT_VERSION,
    digraphStats: {},
    sessions: [],
    textCount: 0,
    retirementCounters: {},
    recentQuoteIds: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/**
 * Fills in anything missing from a profile that is already the current version.
 *
 * @param {any} parsed
 * @returns {any}
 */
function backfill(parsed) {
  const base = defaultProfile();
  return {
    ...base,
    ...parsed,
    settings: { ...base.settings, ...(parsed.settings ?? {}) },
    digraphStats: parsed.digraphStats ?? {},
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    retirementCounters: parsed.retirementCounters ?? {},
    recentQuoteIds: Array.isArray(parsed.recentQuoteIds) ? parsed.recentQuoteIds : [],
    version: CURRENT_VERSION,
  };
}

/**
 * Carries forward the measurement history from v1 and v2 profiles.
 *
 * The API key, cached AI drill text and transfer pools those versions stored
 * are deliberately dropped: Cadence no longer calls a model, and a stale key
 * sitting in localStorage is a liability rather than an asset.
 *
 * @param {any} legacy
 * @returns {any}
 */
function migrate(legacy) {
  const next = defaultProfile();
  next.digraphStats = legacy.digraphStats ?? {};
  next.textCount = legacy.textCount ?? 0;
  next.retirementCounters = legacy.retirementCounters ?? {};
  next.sessions = Array.isArray(legacy.sessions) ? legacy.sessions.slice(-MAX_SESSIONS) : [];
  if (legacy.settings && typeof legacy.settings === 'object') {
    if (typeof legacy.settings.soundEnabled === 'boolean') {
      next.settings.soundOnError = legacy.settings.soundEnabled;
    }
  }
  return next;
}

export const Profile = {
  _default: defaultProfile,

  /**
   * Always returns a usable profile. A corrupt payload yields defaults rather
   * than an exception, because a typing app that will not start is worse than
   * one that starts empty.
   *
   * @param {Storage|null} [storage]
   * @returns {any}
   */
  load(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    try {
      const raw = storage?.getItem(PROFILE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.version === CURRENT_VERSION) return backfill(parsed);
        // A newer or unrecognised version: keep the stats, reset the shape.
        return migrate(parsed ?? {});
      }

      for (const key of LEGACY_KEYS) {
        const legacyRaw = storage?.getItem(key);
        if (!legacyRaw) continue;
        const migrated = migrate(JSON.parse(legacyRaw));
        this.save(migrated, storage);
        storage?.removeItem(key);
        return migrated;
      }

      return defaultProfile();
    } catch {
      return defaultProfile();
    }
  },

  /**
   * @param {any} profile
   * @param {Storage|null} [storage]
   * @returns {import('./result.js').Success<true> | import('./result.js').Failure}
   */
  save(profile, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    if (!storage) {
      return fail('profile.save', 'storage', 'no storage backend available in this environment');
    }
    try {
      storage.setItem(PROFILE_KEY, JSON.stringify(profile));
      return ok(true);
    } catch (err) {
      // Quota exhaustion is the realistic cause; the caller may want to prune.
      return failFrom('profile.save', 'storage', err, { key: PROFILE_KEY });
    }
  },

  /**
   * @param {Storage|null} [storage]
   */
  clear(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    storage?.removeItem(PROFILE_KEY);
    for (const key of LEGACY_KEYS) storage?.removeItem(key);
  },

  /**
   * @param {any} profile
   * @param {any} summary
   * @param {Storage|null} [storage]
   */
  appendSession(profile, summary, storage) {
    profile.sessions.push(summary);
    if (profile.sessions.length > MAX_SESSIONS) {
      profile.sessions = profile.sessions.slice(-MAX_SESSIONS);
    }
    return this.save(profile, storage);
  },

  /**
   * @param {any} profile
   * @returns {string}
   */
  exportProfile(profile) {
    return JSON.stringify(profile, null, 2);
  },

  /**
   * @param {string} jsonString
   * @returns {import('./result.js').Success<any> | import('./result.js').Failure}
   */
  importProfile(jsonString) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (err) {
      return failFrom('profile.import', 'parse', err);
    }

    if (parsed === null || typeof parsed !== 'object') {
      return fail('profile.import', 'validation', 'profile payload is not an object', {
        received: typeof parsed,
      });
    }
    if (typeof parsed.version !== 'number') {
      return fail('profile.import', 'validation', 'profile payload has no version field');
    }
    if (parsed.digraphStats !== undefined && typeof parsed.digraphStats !== 'object') {
      return fail('profile.import', 'validation', 'digraphStats must be an object');
    }

    return ok(parsed.version === CURRENT_VERSION ? backfill(parsed) : migrate(parsed));
  },
};
