# Testing Strategy — Cadence

> How we define, write, and run tests for Cadence.

---

## Philosophy

- **Tests derive from the UI/UX spec** — every user-visible state has a corresponding test
- **Atomic tests** — each test verifies one behavior and is named descriptively
- **Edge-first** — after happy path, immediately ask "what breaks?"
- **No test-gaming** — code must satisfy the Design Doc constraints and spirit, not just pass tests

---

## Test Suites

### 1. Core Logic Tests (`cadence.test.js`)

**Runner:** `node --test cadence.test.js`
**Count:** 52 tests
**What it covers:**
- `buildDigraphKey` — key creation, normalization, null handling
- `DigraphMap` — Welford's algorithm, weak list, overall mean, serialization, input rejection
- `getRollingWpm` — window behavior, decay, edge cases
- `computeConsistency` — CV calculation, identical vs variable dwells
- `estimateChunkHorizon` — insufficient data, clamping, deep vs shallow buffer
- `generateDrillText` — word scoring, digraph density, consecutive repeat prevention
- `Profile` — default, round-trip, session append, session cap, corruption handling
- `detectProvider` — Anthropic/OpenAI/unknown prefix routing
- `checkRetirement` — counter increment, reset, 3-session retirement, persistence
- `AI Text Caching` — cache hash, hit/miss, invalidation
- Integration — full pipeline (keystroke → digraph map → weak list → drill text)

### 2. Vite Module Tests (`src/test/`)

**Runner:** `npx vitest run` (or `npm test`)
**Status:** In progress — mirrors the core logic tests against the modular `src/core/` exports

---

## How to Run

```bash
# Core logic (standalone, no dependencies needed)
node --test cadence.test.js

# Vite module tests
npm test

# Watch mode
npx vitest --watch
```

---

## Test Organization Rules

1. **One `describe` per function/class**
2. **Test IDs for traceability** (e.g., `T-API-1`, `T-RET-3`) when mapping to PRD requirements
3. **Happy path first**, then error, then edge case
4. **No mocking unless necessary** — the pure logic functions don't need mocks
5. **Profile tests use mock localStorage** — simulate `getItem`/`setItem`/`removeItem`

---

## Coverage Map

| Module | Tests | File |
|--------|-------|------|
| `buildDigraphKey` | 6 | `cadence.test.js` |
| `DigraphMap` | 12 | `cadence.test.js` |
| `getRollingWpm` | 7 | `cadence.test.js` |
| `computeConsistency` | 4 | `cadence.test.js` |
| `estimateChunkHorizon` | 5 | `cadence.test.js` |
| `generateDrillText` | 5 | `cadence.test.js` |
| `Profile` | 7 | `cadence.test.js` |
| `detectProvider` | 3 | `cadence.test.js` |
| `checkRetirement` | 5 | `cadence.test.js` |
| AI Caching | 4 | `cadence.test.js` |
| Integration | 4 | `cadence.test.js` |

---

## Edge Case Audit Checklist

Before writing tests for any new feature, run this checklist:

- [ ] What happens with empty input?
- [ ] What happens with null/undefined?
- [ ] What happens at boundary values (0, max, min)?
- [ ] What happens with rapid repeated actions?
- [ ] What happens when localStorage is corrupt/full/unavailable?
- [ ] What happens when the API returns an error/empty/non-English?
- [ ] What happens with the first keystroke in a session (flight = null)?
- [ ] What happens with only 1 data point (stddev = 0)?
- [ ] What happens with identical repeated values (variance = 0)?
