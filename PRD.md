# Cadence — product requirements

**Status:** shipped
**Owner:** Benjamin Pham
**Last updated:** 2026-08-02

---

## 1. Problem

Typists above roughly 120 WPM stop improving on general-purpose typing sites. Those tools measure whole-test speed and per-letter accuracy, which are the right metrics for a beginner and nearly useless for someone whose keystrokes are already automatic.

At that level the remaining cost is concentrated in a small number of **key transitions** — same-finger bigrams, pinky stretches, awkward hand-internal rolls. A typist can feel that some sequences are worse than others but has no way to identify which, and no way to get practice material that concentrates on them.

The result is a plateau that more practice does not fix, because the practice is not aimed at anything.

## 2. Solution

Measure every two-character transition separately. Rank them against the typist's own baseline. Select real quotes that are unusually dense in the slowest ones, and cycle those into an otherwise normal reading session.

## 3. Users

A typist at 120–160 WPM who already touch-types, is comfortable in a monospace dark interface, and is trying to get faster on prose rather than on word lists. Desktop keyboard only.

## 4. Requirements

### Must have

| ID | Requirement | Status |
|----|-------------|--------|
| F1 | Capture dwell and flight per keystroke with sub-millisecond precision | Done |
| F2 | Accumulate per-transition statistics that survive across sessions | Done |
| F3 | Exclude keystrokes following an error from transition timing | Done |
| F4 | Rank weak transitions relative to the typist's own baseline | Done |
| F5 | Detect slow sections within a completed passage | Done |
| F6 | Select quotes by weighted density of the typist's weak transitions | Done |
| F7 | Automatic quote → targeted → quote cycle, gated on sufficient data | Done |
| F8 | Quote library of several thousand passages with length filtering | Done |
| F9 | Show the correct finger for the next character, including shift | Done |
| F10 | Post-passage result with WPM, accuracy, consistency and diagnostic tips | Done |
| F11 | Stats view: trend, weak transitions, per-finger timing, heatmap | Done |
| F12 | On-demand drilling of a specific transition | Done |
| F13 | Profile export, import and deletion | Done |

### Non-functional

| ID | Requirement | Target | Actual |
|----|-------------|--------|--------|
| NF1 | Keystroke to visible feedback | No perceptible lag | Single class toggle plus a compositor transform |
| NF2 | Targeted selection over the full corpus | Under one frame | ~10 ms for 6,486 quotes |
| NF3 | Bundle size | Small enough to parse before the first keystroke | ~19 KB gzipped |
| NF4 | Works with no network after first load | Yes | Corpus is a cached static asset |
| NF5 | No credentials or personal data leave the browser | Absolute | No backend exists |

### Explicitly out of scope

- Accounts, servers, leaderboards, multiplayer
- Mobile and touch typing
- Languages other than English
- Calling a language model to generate practice text. Corpus mining produces better material — real prose instead of generated filler — at zero cost and zero latency, and removes the need to handle a user's API key.

## 5. Flow

```
open → quote → quote → quote → quote → targeted → targeted → quote → …
                                   ↑
                      engages once ≥4 transitions are well sampled
```

Between passages a result card appears with the run's numbers and up to three tips, dismissed by any keystroke or automatically after 1.7 seconds. Targeted passages are capped at 300 characters so the return to reading is quick.

## 6. Key decisions

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-04-09 | Welford's algorithm for transition statistics | Numerically stable, O(1) per update, serialises compactly |
| 2026-04-09 | `performance.now()` over `Date.now()` | Sub-millisecond precision is required for flight times |
| 2026-08-02 | Removed browser-side LLM drill generation | An API key in `localStorage` is a liability, and corpus mining yields better text for free |
| 2026-08-02 | Density scored as weighted hits ÷ √length | Plain density lets a very short quote win on one lucky match |
| 2026-08-02 | Density floor degrades instead of failing | A rare transition inside a 300-character limit can make the ideal threshold unreachable; a good-enough drill beats no drill |
| 2026-08-02 | Targeted drills capped at 300 characters | Long passages accumulate matches by bulk while diluting the transition being drilled |
| 2026-08-02 | Vanilla JS retained over a framework rewrite | The keystroke path is the whole product; a render layer inside it is cost without benefit |
| 2026-08-02 | Analytics moved off the typing screen | Peripheral dashboards split attention, which is what caps a fast typist |
| 2026-08-02 | GPL-3.0 | Required by the monkeytype quote data the project includes |

## 7. Known gaps

- No offline service worker. The corpus caches via HTTP headers, which covers the common case but is not a true offline mode.
- Layouts other than US QWERTY are not supported; the finger guide assumes it.
- Consistency uses dwell variation only. Flight variation is arguably the better rhythm signal and is not yet folded in.
- Length filtering is a manual control rather than adapting to demonstrated stamina.
