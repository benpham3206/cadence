# Interface Contracts — Cadence

> Defines the interface between every component and module. Read this before modifying component boundaries.

---

## Core Modules (`src/core/`)

### `digraph.js`

```javascript
// Constants
export const LETTERS = 'abcdefghijklmnopqrstuvwxyz';  // 26 lowercase letters

// Pure function: build a digraph key from two character inputs
export function buildDigraphKey(prev, cur)
  // Input:  prev: string|null, cur: string|null
  // Output: string|null  (e.g., 'th', 'e ', ' t', null if either input is null)
  // Rules:  Normalizes to lowercase

// Class: Welford's online algorithm for digraph timing stats
export class DigraphMap {
  constructor(data = {})
    // Input: serialized map from profile.digraphStats  { "th": { count, mean, m2 } }

  update(digraphKey, flightMs)
    // Input:  digraphKey: string, flightMs: number
    // Rules:  Rejects null, negative, or >3000ms values silently
    // Side effects: Updates internal Welford accumulators

  getStats(digraphKey)
    // Output: { count: number, mean: number, stddev: number } | null

  getWeakList(n = 8)
    // Output: Array<{ digraph: string, mean: number, count: number, stddev: number }>
    // Rules:  Only includes digraphs with count >= 5 (MIN_SAMPLES)
    //         Sorted by mean descending (slowest first)

  getOverallMean()
    // Output: number (weighted mean across all digraphs with count >= MIN_SAMPLES)

  toHeatmapData()
    // Output: Array<{ from, to, key, count, mean }> (676 entries, 26x26)

  toJSON()
    // Output: serializable object for localStorage
}
```

### `wpm.js`

```javascript
export function getRollingWpm(timestamps, now?)
  // Input:  timestamps: number[] (performance.now() values)
  //         now: number (optional, defaults to performance.now())
  // Output: number (WPM, 0 if insufficient data)
  // Rules:  Uses 5-second sliding window (WINDOW_MS = 5000)
  //         Returns 0 for < 2 timestamps in window
```

### `consistency.js`

```javascript
export function computeConsistency(dwells)
  // Input:  dwells: number[] (dwell times in ms)
  // Output: number (0-100, higher = more consistent)
  // Rules:  Returns 0 for < 2 dwells
  //         Uses inverse coefficient of variation: (1 - CV) * 100
```

### `chunk.js`

```javascript
export function estimateChunkHorizon(events)
  // Input:  events: Array<{ key: string, flight: number|null }>
  // Output: number (1.0–4.0, estimated words in pre-read buffer)
  // Rules:  Returns 1.5 with insufficient data
  //         Clamped to [1.0, 4.0]
```

### `drill.js`

```javascript
export function generateDrillText(weakDigraphs, wordCount = 60)
  // Input:  weakDigraphs: Array<{ digraph: string }> | string[]
  // Output: string | null
  // Rules:  Returns null for empty/null input
  //         No consecutive word repeats
  //         Weighted random selection favoring words containing target digraphs
```

### `profile.js`

```javascript
export const Profile = {
  _default()       // Returns: default v2 profile object
  load(storage?)   // Returns: profile object (auto-migrates v1 → v2)
  save(profile, storage?)  // Side effect: writes to localStorage
  clear(storage?)          // Side effect: removes both v1 and v2 keys
  appendSession(profile, summary, storage?)  // Side effect: pushes + caps at 200
  exportProfile(profile)   // Returns: JSON string
  importProfile(jsonStr)   // Returns: profile | null
}
```

### `portrait.js`

```javascript
export function generateLocalPortrait(profile, weakList)
  // Input:  profile: object, weakList: Array<{ digraph }>
  // Output: string (human-readable identity summary)
```

### `prompt.js`

```javascript
export function buildTersePrompt(dgListText)
  // Input:  dgListText: string (comma-separated digraphs)
  // Output: string (20-30 word prompt for AI generation)
```

### `budget.js`

```javascript
export function shouldUseAPI(apiMode, hasCache, hasKey)
  // Output: boolean
  // Rules:  false if no key, false if cache hit, false if manual mode
```

### `provider.js`

```javascript
export function detectProvider(key)
  // Input:  key: string
  // Output: 'anthropic' | 'openai' | 'unknown' | null
```

### `ui-logic.js`

```javascript
export function canShowChunkTransfer(currentMode)
  // Output: boolean (true if mode === 'quote')
```

---

## Components (`src/components/`)

### `TypingStage`

```javascript
export class TypingStage {
  constructor(container, { onFocus, onBlur })

  renderText(text, attr)          // Renders the text with char spans
  markCorrect(index)              // Mark character at index as correct
  markError(index)                // Mark character at index as error (shake)
  setCurrent(index)               // Move cursor indicator to index
  updateChunkZone(cursorPos, zoneEnd)  // Highlight read-ahead zone
  updateWpm(wpm)                  // Update WPM display
  updateMode(mode, showSub)       // Update mode pill text and sub-pill visibility
  updateChunk(active)             // Toggle chunk pill active state
  showGhost(text, ghostPos)       // Show ghost overlay at position
  hideGhost()                     // Hide ghost overlay
}
```

### `MetricsPanel`

```javascript
export class MetricsPanel {
  constructor(container, digraphMap, onWeakDigraphClick)

  updateStats({ ksCount, avgDwell, avgFlight, consistency })
  renderKeyBars(typed)            // Last 20 keystrokes as dwell+flight bars
  renderWeakDigraphs()            // Weak digraph list with click-to-drill
  updateWpmChart(history)         // SVG sparkline of WPM history
  updateHeatmap()                 // Recolor 26x26 digraph heatmap
  updateFingerMap(activeKey)      // Highlight active key on keyboard SVG
  clear()                         // Reset all displays to default
}
```

### `IntelligencePanel`

```javascript
export class IntelligencePanel {
  constructor(container, profile, digraphMap, callbacks)
  // callbacks: {
  //   onModeToggle, onChunkToggle, onTransferToggle, onZenToggle,
  //   onWeakDigraphClick, onClearData, onSaveApiKey, onApiModeChange,
  //   onSettingChange, onCinema
  // }

  updateIdentity(profile, weakList)
  updateMode(mode)
  updateChunk(active)
  updateZen(active)
  updateLogs(logs)
  updateCoachTips(tips)
}
```

### `SessionCinema`

```javascript
export class SessionCinema {
  constructor(mountEl)

  load(recording, text)           // Parse ghost recording for playback
  show()                          // Open cinema overlay
}
```

---

## App Layer (`src/app/`)

### `state.js`

```javascript
export function createStore(initialValue)
  // Returns: { subscribe(fn), set(val), update(fn), get() }
  // Rules:  update() receives a structuredClone of current state

export const appState = createStore({
  profile, digraphMap, appMode, chunkMode, zenMode, isTransfer,
  currentText, currentAttr, cursorPos, sessionStartTime, sessionErrors,
  events, keystrokeTimestamps, wpmHistory, loading, aiLogs, coachTips,
  ghostRecording, showGhost, showRhythm, perfectStreak
})
```

### `App.js`

```javascript
export class App {
  constructor(mountEl)
  mount()                         // Render DOM, wire events, start tick loop
  handleKeyDown(e)                // Capture keydown timestamps
  handleKeyUp(e)                  // Compute dwell/flight, update digraph map
  handleCharInput(typedChar)      // Check correctness, advance cursor
  onTextComplete()                // Record session, load next text
  loadNextText()                  // Quote or drill depending on mode
  onModeToggle()                  // Quote ↔ Practice
  onChunkToggle()                 // Toggle chunking expansion
  onTransferToggle()              // Start transfer test
  onWeakDigraphClick(dg)          // Generate targeted drill
  aiLog(message, type)            // Append to AI processing log
}
```
