# Functionality Checklist — Cadence

> Production readiness gates. All items must be checked before shipping.

---

## Core Functionality

- [x] Typing input captures all keystrokes without perceptible lag
- [x] Dwell and flight times computed correctly from keydown/keyup events
- [x] Rolling WPM updates every 1 second via tick loop
- [x] WPM decays to 0 naturally after 5 seconds of inactivity
- [x] Digraph map accumulates stats correctly (Welford's algorithm)
- [x] Weak digraph list updates after each session
- [x] Profile persists across browser refreshes (localStorage)
- [x] Profile v1 → v2 migration works transparently
- [x] Session history capped at 200 entries
- [x] Quote mode cycles through all quotes without repeats until exhausted
- [x] Practice mode generates drill text from local word list
- [x] AI drill generation works with valid Anthropic key
- [x] AI drill generation works with valid OpenAI key
- [x] AI fallback to local drills when no key / error / cache hit
- [x] Chunk mode shows read-ahead window advancing at user's WPM
- [x] Transfer test loads sealed unseen text
- [x] Digraph retirement after 3 consecutive sessions below average
- [x] Consistency metric displays correctly (0-100%)
- [x] Per-key timing bars render for last 20 keystrokes
- [x] Digraph heatmap colorizes based on accumulated data
- [x] Weak digraph click triggers targeted drill

## User Experience

- [x] Focus overlay appears when input loses focus
- [x] Focus overlay dismisses on click
- [ ] Click anywhere in typing area refocuses input (REGRESSION — see ERRORS.md)
- [x] Green flash on text completion
- [x] Shake animation on incorrect keystroke
- [x] Loading indicator during AI text generation
- [x] Chunk nudge banner when user falls behind
- [x] Mode toggle reflects current state visually
- [x] API key masked in display after saving
- [x] AI processing log scrolls to latest entry

## Data Integrity

- [x] Corrupted localStorage returns default profile (no crash)
- [x] Negative flight times rejected by DigraphMap
- [x] Flight times > 3000ms rejected by DigraphMap
- [x] `null` flight (first keystroke) handled gracefully
- [x] Empty weak list returns null from generateDrillText (no crash)
- [x] Profile export produces valid JSON
- [x] Profile import validates version before accepting

## Error Handling

- [x] Invalid API key format shows error in AI log
- [x] API rate limit / HTTP error falls back to local drills
- [x] CORS error from file:// shows specific error message with fix instructions
- [x] localStorage.setItem failure caught silently (try/catch)
- [x] JSON.parse failure on profile returns default (try/catch)

## Performance

- [ ] No memory leaks after 100+ text completions
- [x] Keystroke event handling is synchronous (no async in hot path)
- [x] Heatmap update is deferred (not on every keystroke)
- [x] WPM chart limited to 60 data points

## Build & Deploy

- [x] `node --test cadence.test.js` passes (52 tests)
- [ ] `npm run dev` serves the Vite version cleanly
- [ ] `npm run build` produces a working dist/
- [x] No hardcoded API keys in source
- [x] No `console.log` debug statements in production code
