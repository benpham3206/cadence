export function createStore(initialValue) {
  let value = initialValue;
  const listeners = new Set();
  return {
    subscribe(fn) {
      listeners.add(fn);
      fn(value);
      return () => listeners.delete(fn);
    },
    set(newValue) {
      value = newValue;
      listeners.forEach(fn => fn(value));
    },
    update(updater) {
      const next = updater(structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
      value = next;
      listeners.forEach(fn => fn(value));
    },
    get() {
      return value;
    },
  };
}

export const appState = createStore({
  profile: null,
  digraphMap: null,
  appMode: 'quote',
  chunkMode: false,
  zenMode: false,
  isTransfer: false,
  currentText: '',
  currentAttr: '',
  cursorPos: 0,
  sessionStartTime: 0,
  sessionErrors: 0,
  events: [],
  keystrokeTimestamps: [],
  wpmHistory: [],
  loading: false,
  aiLogs: [],
  coachTips: [],
  ghostRecording: null,
  showGhost: false,
  showRhythm: false,
  perfectStreak: 0,
});
