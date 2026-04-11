# Product Requirements Document: Cadence — Personalized Typing Coach

**Status:** Implemented (MVP) / Vite Refactor In Progress
**Created:** 2026-04-10
**Last Updated:** 2026-04-10
**Author:** Benjamin Pham
**PRD Version:** 1.0.0

---

## 1. Overview

### 1.1 Problem Statement
Typists at 150+ WPM have exhausted what existing typing tutors (keybr, TypeRacer, monkeytype) can teach. These tools measure letter-level accuracy and session-elapsed WPM, but they don't measure **which specific key transitions** (digraphs) are slow, don't train the cognitive **pre-read buffer** (chunking), and don't generate **targeted prose** that concentrates on the user's worst transitions.

The result: typists plateau. They type fast on familiar words and slow down on unfamiliar sequences — but no tool tells them which sequences or generates practice text to fix them.

### 1.2 Solution Summary
Cadence is a standalone web-based typing coach that instruments every keystroke at the digraph level (dwell time + flight time), builds a persistent personal profile, identifies the user's weakest key transitions, and generates targeted practice text using AI (Claude Haiku / GPT-4o-mini) or a local word-list fallback. It also introduces a novel "chunking expansion" training mode that gradually trains the user to pre-read further ahead while typing.

### 1.3 Success Criteria
- [x] Digraph-level timing capture (dwell + flight) with sub-ms precision (done)
- [x] Persistent profile across sessions using localStorage (done)
- [x] Weak digraph identification with retirement logic (done)
- [x] AI-generated drill text targeting weak digraphs (done)
- [x] Quote mode with 50+ curated quotes (done)
- [x] Chunking expansion mode (Track B) (done)
- [x] Transfer test mode with sealed texts (done)
- [ ] Transfer score divergence detection working end-to-end
- [ ] Vite refactor passes all features from monolith

---

## 2. Requirements

### 2.1 Functional Requirements (MUST HAVE)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| F1 | Capture dwell and flight time for every keystroke using `performance.now()` | P0 | ✅ Done |
| F2 | Build and persist a digraph timing map using Welford's online algorithm | P0 | ✅ Done |
| F3 | Compute rolling 5-second WPM (not session-elapsed) | P0 | ✅ Done |
| F4 | Identify top 8 weakest digraphs (by mean flight time, min 5 samples) | P0 | ✅ Done |
| F5 | Generate drill text from local word list targeting weak digraphs | P0 | ✅ Done |
| F6 | Generate drill text via Anthropic/OpenAI API when key is provided | P1 | ✅ Done |
| F7 | Quote mode: cycle through curated quotes in random order | P0 | ✅ Done |
| F8 | Practice mode: drills every Nth text or on-demand via weak digraph click | P0 | ✅ Done |
| F9 | Chunking expansion mode: read-ahead window that advances at user's avg WPM | P1 | ✅ Done |
| F10 | Transfer test: unseen sealed texts, WPM recorded separately | P1 | ✅ Done |
| F11 | Digraph retirement: remove from weak list after 3 consecutive sessions below avg | P1 | ✅ Done |
| F12 | Per-key timing visualization (dwell + flight bar chart) | P1 | ✅ Done |
| F13 | 26×26 digraph heatmap with tooltip on hover | P1 | ✅ Done |
| F14 | Consistency metric (inverse CV on dwell times, 0–100%) | P0 | ✅ Done |
| F15 | Profile export/import (JSON) | P2 | ✅ Done |
| F16 | Ghost replay of previous best run | P2 | ✅ Done |
| F17 | Session cinema (keystroke-level replay) | P2 | ✅ Done |
| F18 | Zen mode (distraction-free, panels hidden) | P2 | ✅ Done |

### 2.2 Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NF1 | Typing latency | < 5ms input-to-render (no perceptible lag) |
| NF2 | Profile persistence | Survives browser refresh, migration from v1 → v2 |
| NF3 | API cost | < $0.01 per drill (terse 20-30 word prompts, Haiku/4o-mini) |
| NF4 | Offline capable | Full functionality without API key (local fallback) |
| NF5 | Browser support | Chrome, Firefox, Safari (modern, ES2020+) |

### 2.3 Out of Scope

- Full keybr fork (we're building standalone, not integrating into keybr's codebase)
- Server-side profile storage or user accounts
- Mobile/touch typing (desktop keyboard only)
- Multi-language support (English only)
- Competitive/multiplayer features

---

## 3. User Experience

### 3.1 User Flow
```
Open page → Focus input → Type quote → See WPM + metrics update live
    → Complete quote → Flash → Auto-load next
    → Every Nth text → Drill generated from weak digraphs
    → Click weak digraph in metrics → On-demand targeted drill
    → Toggle Practice mode → Drills only
    → Toggle Chunk → Read-ahead window active
    → Toggle Transfer → Sealed test text
```

### 3.2 UI/UX Requirements
- Three-column layout: Intelligence (left) | Typing (center) | Metrics (right)
- Dark mode only (monospace, low-distraction)
- Click-to-focus overlay when input loses focus
- Green flash on text completion
- Shake animation on incorrect keystroke
- Chunking nudge banner when user falls behind

### 3.3 Content
- 50+ curated quotes (short/medium/long) with attributions
- ~200 word list for local drill text generation
- AI-generated drills via Claude Haiku or GPT-4o-mini

### 3.4 States to Design
- [x] Default/initial state — "Analyzing form..." identity, dashes in metrics
- [x] Typing state — live WPM, per-key bars updating
- [x] Success state — green flash, auto-advance to next text
- [x] Error state — shake animation on wrong keystroke, error counter
- [x] Empty state — "Type more to reveal weak transitions" in digraph list

---

## 4. Technical Specification

### 4.1 Architecture
See `AGENTS.md` → "Architecture: two implementations" section. Monolith (`cadence.html`) and modular Vite app (`src/`).

### 4.2 Data Model
See `AGENTS.md` → "Personal profile schema" section. Profile stored in localStorage as `cadence_profile_v2`.

### 4.3 API/Interface Contracts
See `docs/INTERFACES.md` for component-level contracts.

### 4.4 Dependencies
- **External:** Anthropic API (optional), OpenAI API (optional)
- **Build:** Vite, Vitest (dev only)
- **Runtime:** Zero dependencies (vanilla JS, no frameworks)

### 4.5 Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| API key invalid | Log error in AI Processing Log, fall back to local drills |
| API rate limited | Log error, fall back to local drills |
| CORS blocked (file://) | Log specific CORS error with fix instructions |
| localStorage full | Silently fail on save (try/catch), app continues |
| Corrupted profile JSON | Return default profile, user loses data |

---

## 5. Implementation Plan

### 5.1 Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Core cadence engine (digraph map, WPM, consistency) | ✅ Complete |
| 2 | Quote mode + drill generation | ✅ Complete |
| 3 | AI integration + budget controls | ✅ Complete |
| 4 | Chunking, transfer, retirement | ✅ Complete |
| 5 | Vite modular refactor | 🔄 ~80% |
| 6 | Ghost/Cinema/Zen/Particles polish features | ✅ Complete |

---

## 6. Testing Strategy

### 6.1 Test Suites

| Suite | File | Count | Runner |
|-------|------|-------|--------|
| Core logic | `cadence.test.js` | 52 tests | `node --test` |
| Vite modules | `src/test/*.test.js` | TBD | Vitest |

### 6.2 Edge Cases Covered
- Welford's numerical stability over 1000 updates
- Negative and >3000ms flight time rejection
- Empty/corrupted localStorage
- Session cap at 200 entries
- Rolling WPM decay after typing stops
- Chunk horizon clamping [1.0, 4.0]

---

## 7. References

- Design inspiration: keybr.com adaptive engine
- Technical docs: Anthropic API, OpenAI Chat Completions API
- Research: Schmidt & Lee, *Motor Learning and Performance*; Monrose & Rubin (1997) keystroke dynamics

---

## 8. Open Questions

| Question | Status |
|----------|--------|
| Should the Vite refactor fully replace `cadence.html` or coexist? | Pending |
| Add typing sound effects beyond error click? | Pending |

---

## 9. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-09 | Welford's algorithm for digraph stats | Numerically stable, O(1) per update, serializable |
| 2026-04-09 | Rolling 5s WPM window | Session-elapsed WPM deflates on pause |
| 2026-04-09 | `performance.now()` not `Date.now()` | Sub-ms precision needed for dwell/flight |
| 2026-04-09 | Claude Haiku + GPT-4o-mini routing | Cheapest models at each provider, auto-detected by key prefix |
| 2026-04-09 | Terse 20-30 word prompts | Minimize API cost (~$0.001 per drill) |
| 2026-04-10 | Profile v1 → v2 migration | Added settings, ghostLibrary, separated concerns |
| 2026-04-10 | Three-column layout (Intelligence/Typing/Metrics) | AI settings + logs + identity on left, metrics on right, typing center |
