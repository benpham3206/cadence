# Project Memory

> Append-only log of decisions, mistakes, and lessons learned. Read this before starting any work.

---

## How to Use This File

- **Agents:** Read this file at the start of every session.
- **Humans:** Add entries when you learn something worth remembering.
- **Format:** Chronological, newest at the top.

---

## Entries

### [2026-04-10] Production Pipeline Applied
The production pipeline template governance structure has been applied to Cadence. All future work should follow the 15-phase workflow in `docs/PROCESS.md`.

### [2026-04-10] Monolith-First, Then Modular
The project started as a single `cadence.html` file (2058 lines). This was intentional — get the product working first, then refactor. The Vite refactor in `src/` extracts pure logic into `src/core/`, UI into `src/components/`, and app orchestration into `src/app/App.js`. The monolith remains the stable working version.

**Lesson:** Ship the monolith to prove the concept, then modularize. Don't prematurely abstract.

### [2026-04-10] Profile v1 → v2 Migration
Added `settings`, `ghostLibrary`, and restructured the profile. A `_migrate(v1)` function in `Profile.load()` auto-converts v1 profiles in localStorage to v2. Key design: migration is transparent to the user.

**Lesson:** Version your localStorage schema from day one. Add `_migrate()` before you need it.

### [2026-04-09] Welford's Online Algorithm for Digraph Stats
Chose Welford's algorithm for tracking per-digraph mean and variance. It's:
- Numerically stable (no catastrophic cancellation)
- O(1) per update (no array storage needed)
- Serializable (just `{ count, mean, m2 }`)

Alternative considered: store all flight times in an array and compute stats on demand. Rejected because arrays grow unbounded across sessions.

**Lesson:** For streaming stats that persist across sessions, use Welford's.

### [2026-04-09] Rolling 5-Second WPM Window
Session-elapsed WPM (total chars / total time) deflates as the session gets longer, and never recovers after a pause. Rolling 5-second window shows the user's *current* speed, decays naturally to 0 when they stop typing, and snaps back when they resume.

**Lesson:** For real-time speed metrics, always use a rolling window, not cumulative.

### [2026-04-09] `performance.now()` Not `Date.now()`
`Date.now()` has ~1ms resolution on most browsers. `performance.now()` gives sub-millisecond precision, which matters when measuring dwell times of 50-120ms — a 1ms error is 1-2% noise.

**Lesson:** For keystroke timing, always use `performance.now()`.

### [2026-04-09] API Budget Controls ("Guillotines")
API calls are expensive and must be minimized. The system has four layers of cost protection:
1. **Cache-first**: Hash the weak digraph list. If unchanged, reuse cached AI texts.
2. **Manual mode**: User can set `apiMode: 'manual'` to disable all API calls.
3. **Terse prompts**: Generate 20-30 words, not paragraphs. Keeps token cost ~$0.001 per drill.
4. **Model routing**: Auto-detect `sk-ant-*` → Claude Haiku (cheapest Anthropic), `sk-*` → GPT-4o-mini (cheapest OpenAI).

**Lesson:** Build API cost controls as constraints, not afterthoughts.

### [2026-04-09] Local Drill Text Fallback
The local `generateDrillText()` function scores ~200 curated words by how many target digraphs they contain, then assembles them via weighted random selection. It's surprisingly effective — no API needed for basic drilling.

**Lesson:** A good local fallback makes the AI integration optional, not mandatory.

### [2026-04-09] Digraph Retirement Logic
A digraph is "retired" from the weak list when its mean flight time drops below the user's overall average for 3 consecutive sessions. This prevents the system from drilling transitions the user has already fixed. Counter resets if the digraph regresses.

**Lesson:** Retirement needs consecutive confirmation, not a single good session.

---

### Patterns to Remember

| Pattern | When to Use | Example |
|---------|-------------|---------|
| Welford's online algorithm | Streaming mean/variance across sessions | DigraphMap stats |
| Rolling time window | Real-time speed metrics | 5s WPM window |
| Profile versioning + migration | localStorage schema changes | v1 → v2 with `_migrate()` |
| Cache hash for API calls | Avoid redundant API calls | `aiCache.hash` vs current weak list |
| Local fallback for AI features | Offline functionality | `generateDrillText()` wordlist |
