const PROFILE_KEY = 'cadence_profile_v2';
const LEGACY_KEY = 'cadence_profile_v1';

export const Profile = {
  _default() {
    return {
      version: 2,
      digraphStats: {},
      chunkHorizon: 1.5,
      sessions: [],
      textCount: 0,
      apiKey: '',
      apiMode: 'auto',
      retirementCounters: {},
      aiCache: { hash: '', texts: [] },
      transferPool: [],
      transferHistory: [],
      settings: {
        soundEnabled: false,
        particleEnabled: true,
        ghostEnabled: false,
        rhythmEnabled: false,
        zenDefault: false,
        chunkNudgeEnabled: true,
      },
      ghostLibrary: {},
    };
  },

  load(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    try {
      let raw = storage?.getItem(PROFILE_KEY);
      if (!raw) {
        raw = storage?.getItem(LEGACY_KEY);
        if (raw) {
          const migrated = this._migrate(JSON.parse(raw));
          this.save(migrated, storage);
          storage?.removeItem(LEGACY_KEY);
          return migrated;
        }
      }
      if (!raw) return this._default();
      const parsed = JSON.parse(raw);
      if (parsed.version !== 2) return this._default();
      return this._backfill(parsed);
    } catch {
      return this._default();
    }
  },

  save(profile, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    try {
      storage?.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {}
  },

  clear(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    storage?.removeItem(PROFILE_KEY);
    storage?.removeItem(LEGACY_KEY);
  },

  appendSession(profile, summary, storage) {
    profile.sessions.push(summary);
    if (profile.sessions.length > 200) profile.sessions = profile.sessions.slice(-200);
    this.save(profile, storage);
  },

  _migrate(v1) {
    const v2 = this._default();
    v2.digraphStats = v1.digraphStats || {};
    v2.chunkHorizon = v1.chunkHorizon ?? 1.5;
    v2.sessions = v1.sessions || [];
    v2.textCount = v1.textCount || 0;
    v2.apiKey = v1.apiKey || '';
    v2.apiMode = v1.apiMode || 'auto';
    v2.retirementCounters = v1.retirementCounters || {};
    v2.aiCache = v1.aiCache || { hash: '', texts: [] };
    v2.transferPool = v1.transferPool || [];
    v2.transferHistory = v1.transferHistory || [];
    return v2;
  },

  _backfill(parsed) {
    if (!parsed.settings) parsed.settings = this._default().settings;
    if (parsed.settings.chunkNudgeEnabled === undefined) parsed.settings.chunkNudgeEnabled = true;
    if (!parsed.ghostLibrary) parsed.ghostLibrary = {};
    if (!parsed.aiCache) parsed.aiCache = { hash: '', texts: [] };
    if (!parsed.transferPool) parsed.transferPool = [];
    if (!parsed.transferHistory) parsed.transferHistory = [];
    if (!parsed.retirementCounters) parsed.retirementCounters = {};
    if (!parsed.apiMode) parsed.apiMode = 'auto';
    return parsed;
  },

  exportProfile(profile) {
    return JSON.stringify(profile, null, 2);
  },

  importProfile(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.version === 1) return this._migrate(parsed);
      if (parsed.version === 2) return this._backfill(parsed);
      return null;
    } catch {
      return null;
    }
  },
};
