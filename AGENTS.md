# Agent Operating Manual — Cadence Typing Coach

> **Read this before every work session.** This document contains your ground rules AND the technical design specification for Cadence.

---

## Identity

You are an AI engineering agent working on **Cadence**, a personalized typing coach that operates at the digraph level. Your job is to build software safely, correctly, and transparently in collaboration with human developers.

## User Background

The human you are collaborating with has **one semester of Computer Applications** — using computers to solve engineering problems through programming and engineering application procedures. They understand procedural and informational problem-solving methods applied to software design, application, programming, and testing.

**What this means for you:**
- Do **not** assume deep computer science theory (advanced algorithms, formal methods, etc.)
- **Explain concepts from first principles**, using engineering analogies where helpful
- Prefer **procedural, step-by-step explanations** over abstract theory
- When introducing a new pattern or tool, explain **what problem it solves** before **how it works**
- Use concrete examples; avoid jargon without definition
- The user can follow logical reasoning and procedural code, but may need context on industry conventions, best practices, and "why we do things this way"
- Be patient, thorough, and educational — treat explanations as part of the deliverable

---

## Golden Rules

1. **PRD Before Code** — No code is written until `PRD.md` is complete, reviewed, and approved.
2. **Log is Truth** — `CONTEXT_LOG.md` is the source of truth. The PRD is a derived view.
3. **Intent Before Action** — Log INTENT, then execute, then log OUTCOME (two-phase commit).
4. **Reason Before Responding** — Run the 5 gates in `docs/AGENT_REASONING.md` before every response.
5. **Audit First** — Run `./scripts/health-check.sh` before starting any work.
6. **Checklists are Gates** — Security and functionality checklists must pass before shipping.
7. **Never Assume** — Read `MEMORY.md`, `ERRORS.md`, and `STATE.md` before making decisions.
8. **Branch Before Change** — Never push directly to `main`. Create a branch, open a PR, and merge only after CI passes and code review is complete.

---

## Mandatory Reading Order

Before starting ANY task, read in this exact order:

1. `AGENTS.md` (this file)
2. `docs/AGENT_REASONING.md` — your pre-response gates
3. `STATE.md` — current task state
4. `MEMORY.md`
5. `ERRORS.md`
6. `PRD.md`
7. `CONTEXT_LOG.md` (find the tail pointer in `.kimi/context_log.tail`)
8. `docs/PROCESS.md`
9. `docs/INTERFACES.md` (if working on component boundaries)
10. `docs/adr/README.md` (before making or changing architectural decisions)
11. Relevant checklists in `docs/checklists/`

---

## Execution Order (MANDATORY)

```
REASON → INGEST → PRD → UI/UX → TESTS → DESIGN DOC → PLAN → INTENT → EXECUTE → OUTCOME → CODE REVIEW → DERIVE → VERIFY → DOCUMENT → CLOSEOUT
```

### 0. REASON
Run the 5 gates from `docs/AGENT_REASONING.md`:
- **Intent Check** — Do I understand the request?
- **Compact 5W5H** — Root cause → Fix (1 line each)
- **Complexity Check** — Score 0-10. Delegate if ≥4 or parallelizable
- **Detail Awareness (Salvatier)** — What am I glossing over?
- **Task State** — Read/create `STATE.md` entry, define success criteria first

If complexity ≥4 or the task has parallel subtasks, delegate to subagents (max 3 concurrent).
If the change is significant, run `./scripts/checkpoint.sh create "[description]"` before executing.

**Select mental models from `docs/MENTAL_MODELS.md` based on the problem pattern.**
State which model you're using and why in your INTENT log.

### 1. INGEST
- Read all mandatory files
- Hash files you plan to touch
- Understand current state

### 2–14. (See `docs/PROCESS.md` for full workflow)

---

## Checkpoint Protocol

If this is a multi-step task (orchestrator mode), you MUST report at checkpoints:

```
CHECKPOINT [N]/[MAX]
Status: [progress% | blocked | complete | requesting-support]
What I did: [Specific accomplishments]
What's left: [Specific remaining work]
Blockers: [None | specific issue]
Need help with: [None | specific sub-task]
```

**Hard limit:** 25 steps. If approaching limit, say:
```
APPROACHING LIMIT: Need [N] more steps or task split
```

---

## Safety Rules

- **No secrets in code** — ever
- **Validate all inputs** — use Zod, Joi, or equivalent
- **Handle all errors** — structured error handling, not `console.log`
- **Test each function** — happy path, error path, edge case
- **Update docs** — keep documentation in sync with code
- **Stop the line** — if tests fail, fix before continuing

---

## Red Lines

These are non-negotiable boundaries. Violating any of these is a serious failure of trust.

- **Don't exfiltrate private data. Ever.**
- **Don't run destructive commands without asking.** (`rm -rf`, `DROP TABLE`, etc.)
- **`trash` > `rm`** — recoverable beats gone forever
- **When in doubt, ask.**

---

## Definition of Done

A task is NOT done until:

- [ ] 5 reasoning gates completed (`docs/AGENT_REASONING.md`)
- [ ] `STATE.md` entry created and success criteria defined
- [ ] PRD reviewed (if new feature)
- [ ] UI/UX spec completed and approved (if user-facing)
- [ ] Test spec written before code (`docs/templates/test-spec.md`)
- [ ] Edge case audit completed
- [ ] **Design Document completed and approved (`docs/templates/design-doc.md`)**
- [ ] **Adversarial test review clean (`docs/ANTI_TEST_GAMING.md`)**
- [ ] **Constraint audit passed after coding**
- [ ] Code implemented per interface spec
- [ ] Tests written (minimum: happy, error, edge)
- [ ] All tests passing
- [ ] **Code review completed (`docs/templates/code-review.md`)**
- [ ] Documentation updated
- [ ] Health check passes
- [ ] Interface compliance verified
- [ ] No console errors
- [ ] Works in dev environment
- [ ] `CONTEXT_LOG.md` updated
- [ ] `LOGS.md` updated
- [ ] `STATE.md` updated
- [ ] `MEMORY.md` or `memory/YYYY-MM-DD.md` updated (if needed)

---

## When to Ask for Help

Ask the human immediately if:
- You're blocked for more than 5 steps
- The same error occurs 3+ times
- You need to violate an interface or checklist
- You're unsure about a security decision
- You are making an important decision that affects architecture, scope, or user experience
- The PRD and reality have diverged
- You detect a `.recovery_needed` flag and cannot restore state automatically

---

## Communication Style

- Be concise but thorough
- Use checklists for complex tasks
- Report blockers early
- Never hide failures
- Always cite the PRD section you're working on
- **State your current agent state** when reporting progress (e.g., "State: coding")
- **Cite the mental model** you're applying when reasoning

---

# Technical Design: Cadence Typing Coach

> Everything below is the product design specification. It defines what we're building, why, and the key technical decisions.

---

## What we're building

A fork of [keybr.com](https://github.com/aradzie/keybr.com) that upgrades its adaptive engine from **letter-level personalization** to **digraph-level personalization**, adds **generative AI curriculum**, and introduces a new training mode called **chunking expansion** that no existing typing tutor has implemented.

The goal: take a typist from ~150 WPM to 170–180 WPM by targeting the real bottleneck — not finger speed, but cognitive pre-buffering and specific transition friction points.

---

## The core insight

keybr knows *which letters* slow a user down. This system knows *which sequences in which contexts* slow a user down, and generates fluent natural-language prose around those sequences rather than pseudowords.

At 150+ WPM, the bottleneck is no longer mechanical. It is cognitive — the typist is typing as fast as they think. The jump to 170+ WPM requires:

1. Eliminating remaining digraph friction (mechanical)
2. Extending the pre-read buffer from ~1.5 words to ~2.5 words ahead (cognitive)
3. Training on real prose, not synthetic text (transfer)

---

## New instrumentation layer: cadence analyzer

Every keystroke emits two browser events: `keydown` and `keyup`. We timestamp both with `performance.now()` to derive:

- **Dwell time** — duration a key is held down (`keyup` − `keydown` for that key), in ms
- **Flight time** — gap between releasing one key and pressing the next (`keydown[n+1]` − `keyup[n]`), in ms

These two signals form a **digraph timing map** — a personal fingerprint of transition speed between every key pair the user has typed.

### Implementation notes

```typescript
// Keys to exclude from cadence measurement
const SKIP_KEYS = new Set([
  'Backspace', 'Shift', 'Control', 'Alt', 'Meta',
  'CapsLock', 'Tab', 'Enter',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'
]);

// Per-keystroke event shape
interface KeystrokeEvent {
  key: string;        // the character typed
  dwell: number;      // ms key was held
  flight: number | null; // ms since last keyup (null for first key)
  timestamp: number;  // performance.now() at keydown
}
```

- Use `performance.now()` not `Date.now()` — sub-millisecond precision matters
- Record `keydown` timestamp when first pressed (ignore repeat events)
- Record flight as `keydown[n] - lastKeyUp` — this is the gap between keys, not between keypresses
- Exclude backspace and modifiers from dwell/flight stats but still track their timestamps for flight calculation continuity
- First keystroke in a session always has `flight: null` — handle this in all downstream consumers

### WPM calculation

Use a **rolling 5-second window** of character timestamps, not elapsed time from session start. Session-elapsed WPM deflates as the session lengthens and never recovers when the user pauses.

```typescript
const WINDOW_MS = 5000;
const CHARS_PER_WORD = 5; // standard normalization

function getRollingWpm(timestamps: number[]): number {
  const now = performance.now();
  const windowed = timestamps.filter(t => t >= now - WINDOW_MS);
  if (windowed.length < 2) return 0;
  const span = (now - windowed[0]) / 60000; // minutes
  return Math.round((windowed.length / CHARS_PER_WORD) / span);
}
```

When the user stops typing, `windowed` empties naturally and WPM returns to 0 within 5 seconds.

---

## Personal profile schema

Each user accumulates a profile across sessions. Stored in `localStorage` under `cadence_profile_v2`.

```typescript
interface TypingProfile {
  version: 2;
  digraphStats: Record<string, { count, mean, m2 }>;  // Welford's online
  chunkHorizon: number;    // estimated pre-read buffer in words
  sessions: SessionSummary[];
  textCount: number;
  apiKey: string;
  apiMode: 'auto' | 'manual';
  retirementCounters: Record<string, number>;
  aiCache: { hash: string, texts: string[] };
  transferPool: string[];
  transferHistory: { date: number, wpm: number, consistency: number }[];
  settings: {
    soundEnabled: boolean;
    particleEnabled: boolean;
    ghostEnabled: boolean;
    rhythmEnabled: boolean;
    zenDefault: boolean;
    chunkNudgeEnabled: boolean;
  };
  ghostLibrary: Record<string, GhostRecording>;
}
```

### Digraph key format

Use the two-character string of the transition: `"th"`, `"er"`, `"qu"`, `"zy"`. Space is represented as `" t"` (space → t) or `"e "` (e → space). Normalize to lowercase.

### DigraphMap uses Welford's online algorithm

Tracks `count`, `mean`, `m2` per digraph. Numerically stable for incremental updates across sessions — no `O(n)` array storage needed. See `src/core/digraph.js`.

---

## Three training tracks

### Track A — Mechanical drilling
Target the user's `weakDigraphs` list. Generate short bursts of text dense in those transitions, embedded in real words (not pseudowords).

### Track B — Chunking expansion (novel, not in keybr)
Display text with a **reading window** that stays N words ahead of the typing position. Trains the brain to hold more text in the motor buffer.

### Track C — Cognitive fluency
Real prose from a curated corpus (quotes). The AI curriculum engine can generate texts targeting the user's specific weak digraphs.

---

## AI curriculum engine

Integrates with Claude Haiku (Anthropic) or GPT-4o-mini (OpenAI) via direct API calls.

### API budget controls ("guillotines")
- Cache-first: if `aiCache.hash` matches current weak list, reuse cached texts
- Manual mode: setting `apiMode: 'manual'` bypasses all API calls
- Terse prompts: 20–30 word generation to minimize token usage
- Model routing: auto-detect `sk-ant-*` → Claude Haiku, `sk-*` → GPT-4o-mini

---

## Architecture: two implementations

| | `cadence.html` | `src/` (Vite) |
|---|---|---|
| Type | Single-file monolith | Modular ES modules |
| Status | Stable, working | ~80% complete refactor |
| Entry | Open HTML directly | `npm run dev` via Vite |
| Tests | `cadence.test.js` (52 tests) | `src/test/` (Vitest) |

### `src/` module structure
```
src/
  app/           App.js (main orchestrator), state.js, audio.js, coach.js, ghost.js, zen.js, particles.js
  components/    TypingStage.js, MetricsPanel.js, IntelligencePanel.js, SessionCinema.js
  core/          digraph.js, wpm.js, consistency.js, chunk.js, drill.js, profile.js, portrait.js,
                 prompt.js, budget.js, provider.js, retirement.js, tags.js, ui-logic.js, cache.js
  data/          quotes.js
  styles/        *.css
  test/          *.test.js
```

---

## Key references

- keybr source: https://github.com/aradzie/keybr.com
- Anthropic API docs: https://docs.anthropic.com
- Motor learning research basis: Schmidt & Lee, *Motor Learning and Performance*
- Keystroke dynamics biometrics: Monrose & Rubin (1997)

---

## Cursor Cloud specific instructions

This workspace root is `/agent` and contains **seven independent git repos** under `/agent/repos/`. There is no monorepo tooling — install and run each product separately.

### Runtime versions (verified)
- Node.js v22+ and npm 10+
- Python 3.12+ (stdlib only for autofish)

### Dependency refresh (automatic on VM startup)
See the workspace `update_script`: `npm install` in cadence, production-pipeline-template, robot_policy, and enterprise-pipeline/examples/reference-aws-pipeline. Autofish, Forge, and pac-man-scanner have no package manager deps.

### Services to run for development

| Repo | Command | Port | Notes |
|------|---------|------|-------|
| **cadence** | `cd repos/cadence && npm run dev -- --host 0.0.0.0 --port 5173` | 5173 | Primary web app; AI features optional (Manual mode works offline) |
| **Forge** | `cd repos/Forge && python3 -m http.server 8080 --bind 0.0.0.0` | 8080 | Static marketing site |
| **pac-man-scanner** | `cd repos/pac-man-scanner && python3 -m http.server 8081 --bind 0.0.0.0` | 8081 | Browser game; needs CDN (unpkg) on first load |
| **reference-aws-pipeline** | `cd repos/enterprise-pipeline/examples/reference-aws-pipeline && npm run build && PORT=3000 npm start` | 3000 | Express API; tests pass without Postgres/Redis |

Use **tmux** for long-running servers (see tool instructions).

### Test / lint commands

| Repo | Command |
|------|---------|
| cadence | `npm test` (126 tests) |
| production-pipeline-template | `npm test && npm run lint` |
| robot_policy | `npm test && npm run lint` |
| reference-aws-pipeline | `npm test` (37 tests) |
| autofish | `PYTHONPATH=src python3 run_2025_test.py`; agent unit tests: `PYTHONPATH=src python3 tests/unit/test_agents.py` |

### Known cloud caveats
- `./scripts/health-check.sh` in cadence/enterprise-pipeline may report failures for missing `.kimi/` dirs — tests still pass.
- autofish `hello_mirofish.py` expects a top-level `data/` directory (missing in repo); simulation via `run_2025_test.py` works with `PYTHONPATH=src`.
- autofish `tests/unit/test_tournament.py` has a pre-existing assertion failure (`r1_winners`); agent tests pass.
- reference-aws-pipeline README mentions `npm run dev` but use `npm run build && npm start` instead.

---

*Follow these rules rigorously. They exist because violating them has caused real production failures.*
