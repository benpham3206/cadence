# Error Log

> Append-only chronicle of bugs, mistakes, and near-misses. Read this before starting related work.

---

## Error Entries (Chronological — Newest First)

### 2026-04-10 — Click-to-focus regression in 3-panel layout
- **Component:** `src/components/TypingStage.js`, `src/app/App.js`
- **Error:** Clicking in the typing area no longer refocuses the hidden textarea
- **Context:** Occurred during the three-column layout refactor (move from monolith to component-based)
- **Root Cause:** TBD — suspected event delegation issue or `e.target.closest()` check preventing propagation to the hidden input focus handler
- **Resolution:** Not yet fixed
- **Lesson:** When moving DOM event listeners between refactors, test focus management explicitly
- **Severity:** medium (user has to manually click the focus overlay instead of clicking anywhere)

---

### 2026-04-10 — Progression freeze after quote completion
- **Component:** `src/app/App.js` → `onTextComplete()` → `loadNextText()`
- **Error:** After completing a quote, the next text doesn't load. The UI freezes on the completed text.
- **Context:** Edge case in the Vite refactor, does not occur in `cadence.html` monolith
- **Root Cause:** TBD — suspected state mutation timing issue in `appState.update()` during `onTextComplete()` → `loadNextText()` chain
- **Resolution:** Not yet fixed
- **Lesson:** State updates that trigger re-renders during completion callbacks are a common source of frozen UIs
- **Severity:** high (completely blocks typing practice)

---

### 2026-04-10 — AI language hallucination in drills
- **Component:** `src/app/App.js` → `callAnthropic()`, `src/core/prompt.js`
- **Error:** Claude sometimes generates practice text in languages other than English (e.g., French, Spanish) despite the prompt specifying English
- **Context:** Occurs with certain digraph lists that are common in multiple languages (e.g., "qu", "th")
- **Root Cause:** The terse prompt (`buildTersePrompt()`) was too brief to reliably constrain language. Updated to: `"Write a 20-30 word sentence in pure, standard English prose. Do not use any other languages. Output text ONLY."`
- **Resolution:** Partially mitigated by prompt update, but not fully verified
- **Lesson:** Short prompts need explicit negative constraints ("Do NOT X") to prevent hallucination, especially for language-sensitive outputs
- **Severity:** medium (drills still work, just in wrong language occasionally)

---

## Patterns to Remember

| Pattern | When to Use | Example |
|---------|-------------|---------|
| Test focus management after refactoring | Any DOM restructuring | click-to-focus regression |
| Check state mutation timing in callbacks | Completion → next-action chains | progression freeze |
| Add explicit negative constraints to AI prompts | Any language/format-sensitive generation | "Do NOT use other languages" |

---

## Pre-Flight Checklists

#### Before Starting Work
- [ ] Read latest `MEMORY.md` entries
- [ ] Read latest `ERRORS.md` entries (this file)
- [ ] Run `./scripts/health-check.sh`
- [ ] Check `CONTEXT_LOG.md` tail pointer

#### Before Shipping
- [ ] All tests pass (`node --test cadence.test.js`)
- [ ] `docs/checklists/SECURITY.md` complete
- [ ] `docs/checklists/FUNCTIONALITY.md` complete
- [ ] `docs/checklists/PRE_SHIP.md` complete
