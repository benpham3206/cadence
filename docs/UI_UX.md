# UI/UX Design — Cadence Typing Coach

> Defines the user interface, interaction patterns, and all visual states.

---

## Layout

Three-column dark-mode layout, monospace typography:

```
┌──────────────┬────────────────────────────────┬──────────────┐
│  Intelligence │         Typing Stage           │   Metrics    │
│  (320px)      │         (flexible)             │   (300px)    │
│               │                                │              │
│  Identity     │  ┌─ Cadence [quote] ─────────┐ │  Stat cards  │
│  portrait     │  │                            │ │  WPM chart   │
│               │  │  WPM display               │ │  Key bars    │
│  Coach tips   │  │                            │ │  Weak list   │
│               │  │  ░░░░░ typed text ░░░░░    │ │  Heatmap     │
│  ─────────    │  │                            │ │  Finger map  │
│  Mode toggle  │  │  — attribution             │ │              │
│  Zen toggle   │  └────────────────────────────┘ │              │
│  API settings │                                │              │
│  AI log       │  [focus overlay]               │              │
│  Clear/Export │  [loading indicator]           │              │
└──────────────┴────────────────────────────────┴──────────────┘
```

---

## Design Tokens

```css
--bg:           #0c0c0c          /* background */
--surface:      #131315          /* card/panel background */
--surface2:     #1a1a1e          /* elevated surface */
--border:       rgba(255,255,255,0.055)
--text:         #d8d8d8          /* primary text */
--text2:        #6b7280          /* secondary text */
--text3:        #383c44          /* muted text */
--green:        #1D9E75          /* correct, success */
--red:          #E85353          /* error */
--amber:        #D4973B          /* warning, nudge */
--purple:       #AFA9EC          /* flight time, accent */
--font:         'SF Mono', 'Fira Code', monospace
```

---

## Components

### Typing Stage (center)

| Element | Description |
|---------|-------------|
| Title | "Cadence" — bold, 16px, letter-spacing 2px |
| Mode pills | `[quote]` `[chunk]` `[transfer]` — pill-shaped toggles |
| WPM display | 38px light weight, tabular-nums, fades when inactive |
| Text display | 20px, line-height 1.85, characters as individual `<span>` elements |
| Attribution | 12px italic, muted, below text |
| Focus overlay | Blurred backdrop with "click to focus" — appears when input unfocused |
| Loading indicator | "generating drill" with pulsing dot — appears during AI calls |

### Character States

| State | Class | Visual |
|-------|-------|--------|
| Pending | `char-pending` | `--text3` (muted gray) |
| Current | `char-current` | `--text` (white) + green underline |
| Correct | `char-correct` | `--green-dim` (faded green) |
| Error | `char-shake` | `--red` + shake animation (0.15s) |
| Chunk zone | `char-chunk-zone` | `--text2` + purple background tint |

### Intelligence Panel (left)

| Section | Content |
|---------|---------|
| Identity | Italic text describing the typist's profile (WPM, read buffer, friction points) |
| Coach tips | Context-aware suggestions after each completed text |
| Mode toggle | `[quote]` / `[practice]` pill button |
| Zen toggle | `[zen]` pill button |
| API key | Password input with Enter-to-save, masked display, remove button |
| API mode | `Auto` / `Manual` dropdown |
| Settings | Checkboxes: Sound on error, Ghost replay, Rhythm pulse, Catch-up nudge |
| AI log | Scrollable log with color-coded entries (purple=thinking, green=success, red=error) |
| Actions | `[Clear all data]` `[Export]` `[Cinema]` buttons |

### Metrics Panel (right)

| Section | Content |
|---------|---------|
| Stat cards | 2×2 grid: Avg Dwell, Avg Flight, Consistency, Keystrokes |
| WPM chart | SVG sparkline, last 60 data points, green line with gradient fill |
| Per-key timing | Last 20 keystrokes as stacked dwell (green) + flight (purple) bars |
| Weak digraphs | Top 8 slowest digraphs with horizontal bar + ms value, click to drill |
| Digraph heatmap | 26×26 grid, color-coded by mean flight time, tooltip on hover |
| Finger map | SVG keyboard layout, highlights active key |

---

## Interaction Patterns

### Text Completion Flow
1. User types last character correctly
2. Green flash overlay pulses (0.4s)
3. Session stats recorded to profile
4. Ghost recording saved (if ghost enabled)
5. Coach tips generated and displayed
6. Next text auto-loaded (quote or drill based on mode/counter)

### Error Feedback
1. Wrong character typed
2. Character span gets `char-shake` class (0.15s shake animation)
3. Error click sound plays (if sound enabled)
4. Error counter increments
5. After 200ms, character reverts to `char-current` (cursor stays)

### Mode Switching
- **Quote ↔ Practice**: Toggles between curated quotes and AI/local drill text
- **Chunk**: Only visible in Quote mode. Activates read-ahead window at user's chunk horizon
- **Transfer**: Only visible in Quote mode. Loads a sealed unseen text for honest testing
- **Zen**: Hides both side panels, shows only the typing area

### API Key Management
1. User pastes key into password field, presses Enter
2. Key validated by prefix (`sk-ant-*` → Anthropic, `sk-*` → OpenAI)
3. Status badge updates: green "✓ Anthropic key active" with masked value
4. Remove button (✕) appears to clear the key
5. Key stored in profile (localStorage)

---

## States

### Default (no data)
- Identity: "Analyzing form..."
- Stats: all show "—"
- Weak digraphs: "Type more to reveal weak transitions"
- Heatmap: all cells gray
- WPM chart: empty
- API status: "No key set — using local drills"

### Active typing
- WPM display shows rolling number
- Per-key bars update with each keystroke
- Heatmap cells colorize as digraph data accumulates
- Finger map highlights pressed key

### Session complete
- Green flash
- Stats update with session averages
- Identity text refreshes
- Coach tips appear
- Ghost recording saved

### Error state (API)
- AI log shows red entry with specific error message
- Loading indicator hidden
- Falls back to local drill generation silently
- User never sees a broken/empty drill
