# Agentic / Human Collaboration Workflow

> How humans and AI agents work together to build production software.

---

## Philosophy

This project treats the AI agent as a **collaborator**, not a tool. That means:

- The agent has autonomy within defined boundaries
- The agent must communicate transparently (INTENT → OUTCOME)
- The human reviews and approves at key gates
- Both parties share responsibility for quality

---

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION PIPELINE WORKFLOW                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐                                                       │
│   │  0. REASON  │  → Run 5 gates (docs/AGENT_REASONING.md)              │
│   │             │  → Create STATE.md entry                               │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  1. AUDIT   │  → Run health-check.sh                                 │
│   │             │  → Read STATE.md, MEMORY.md, ERRORS.md                 │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  2. PRD     │  → Human + Agent draft PRD.md                          │
│   │             │  → Human approves before any design                    │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  3. UI/UX   │  → Design flows, states, copy (docs/UI_UX.md)          │
│   │             │  → Human approves before test definition               │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  4. TESTS   │  → Define tests from UI/UX specs                       │
│   │             │  → Edge case audit                                     │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  5. DESIGN  │  → Write design doc (docs/DESIGN_DOC.md)              │
│   │             │  → Constraints, criteria, adversarial review           │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  6. PLAN    │  → Define interfaces (docs/INTERFACES.md)              │
│   │             │  → Create work packages                                │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│   │  7. INTENT  │────▶│  8. EXECUTE │────▶│  9. OUTCOME │               │
│   │   (Log)     │     │   (Work)    │     │   (Log)     │               │
│   └─────────────┘     └─────────────┘     └──────┬──────┘               │
│          ▲────────────────────────────────────────┘                     │
│          │ (Repeat 7-9 for every turn)                                   │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  10. REVIEW │  → Code review before verification                     │
│   │             │  → Human or peer agent approval required                │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  11. VERIFY │  → Run tests, checklists, constraint audit             │
│   │             │  → Anti-test-gaming review                             │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  12. SHIP   │  → Pre-ship audit passes → Deploy                      │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  13. CLOSEOUT│ → Update LOGS.md, STATE.md, MEMORY.md                │
│   └─────────────┘                                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Audit

Before any work, the agent must:

1. Run the 5 reasoning gates from `docs/AGENT_REASONING.md`
2. Create/update `STATE.md` with success criteria
3. Run `./scripts/health-check.sh`
4. Read `STATE.md`
5. Read `MEMORY.md`
6. Read `ERRORS.md`
7. Read `CONTEXT_LOG.md` (find current turn via `.kimi/context_log.tail`)
8. Check `docs/INTERFACES.md` for relevant contracts

**Why:** Context windows are limited. These documents are our external memory.

---

## Phase 2: PRD

### Human Responsibility
- Define the problem and success criteria
- Approve the PRD before code begins

### Agent Responsibility
- Ask clarifying questions until requirements are crystal clear
- Draft `PRD.md` using the template
- Ensure every success criterion is measurable
- Ensure out-of-scope is explicitly defined

### Gate
**No UI/UX design until PRD is approved.**
**No test definition until UI/UX is approved.**
**No design document until tests are defined.**
**No code until design document is approved.**

---

## Phase 3: UI/UX Design

See `docs/UI_UX.md` for the full design phase.

### What to Produce
1. **User flows** — entry to exit for every path
2. **Screen/component specs** — use `docs/templates/ui-spec.md`
3. **Exact copy/text** — no placeholders
4. **State definitions** — default, loading, success, error, empty
5. **Feedback loops** — how the system responds to every user action

### Gate
**UI/UX must be approved before writing test specs.**

---

## Phase 4: Test Definition

See `docs/templates/test-spec.md`.

### Rule
**Every designed state must have a corresponding test.**

### Process
1. Read approved UI/UX specs
2. Write test cases for:
   - Happy path
   - Loading/intermediate states
   - Error states (with exact messages from UI spec)
   - Empty states
   - Edge cases (boundary values, nulls, rapid actions)
3. Run the **Edge Case Audit** checklist
4. Get human approval on test spec (for critical features)

### Gate
**No code until test spec is complete.**

---

## Phase 5: Design Document

See `docs/DESIGN_DOC.md` for the full design document philosophy.

### What to Produce
1. **High-level objectives** — functional and non-functional
2. **Detailed objectives** — decomposed using Salvatier's principle
3. **Metrics** — one or more measures per detailed objective
4. **Constraints** — the hard line (not-worse-than)
5. **Criteria** — the optimization direction (better-looks-like-this)
6. **Test-to-objective mapping** — every test must serve an objective
7. **Adversarial test review** — agent tries to break the tests
8. **Recommendations** — ordered, one sentence each

### Anti-Test-Gaming Review
Before the design doc is approved, the agent must run the adversarial review:
- How could code pass the tests but still be wrong?
- What tests are missing?
- What constraints prevent gaming?

See `docs/ANTI_TEST_GAMING.md` for the full safeguard checklist.

### Gate
**No code until the Design Document is approved and the adversarial review is clean.**

---

## Phase 6: Plan

### Interface Definition
For any new component or API, define the interface in `docs/INTERFACES.md` first.

```typescript
interface [ComponentName]Props {
  [prop]: [type];  // [description]
}

// Behavior:
// - [requirement 1]
// - [requirement 2]

// Validation:
// - [rule 1]
// - [rule 2]
```

### Work Packages
For large features, break work into packages using `docs/templates/work-package.md`.

---

## Phase 7-9: Intent → Execute → Outcome

This is the **two-phase commit** that makes agent work recoverable and auditable.

### Before Acting: INTENT

Append to `CONTEXT_LOG.md`:

```markdown
## Turn N: Intent (HH:MM:SS)
**Target:** PRD Section [X.Y] "[Title]"
**Context:** [Brief summary]

### Planned Actions
- [ ] [Action 1]
- [ ] [Action 2]

### Workspace Snapshot
```json
{
  "files": {
    "src/file.js": "sha256:abc..."
  },
  "risk_flags": []
}
```
```

### Execution
Perform the work. Save files after each logical unit.

### After Acting: OUTCOME

Append to `CONTEXT_LOG.md`:

```markdown
## Turn N: Outcome (HH:MM:SS)
**Status:** ✅ Success / ⚠️ Partial Success / ❌ Blocked
**Execution Time:** [N seconds]

### Completed
- ✅ [Action 1]: [Result]

### Blocked / Failed
- ❌ [Action 2]: [Error + root cause]

### Workspace Delta
| File | Before | After | Lines +/- |
|------|--------|-------|-----------|
| src/file.js | sha256:abc... | sha256:def... | +45/-12 |

### PRD Progress Update
| Section | Previous | Current |
|---------|----------|---------|
| 4.1 | planned | in_progress |
```

---

## Phase 10: Code Review

**No verification until code has been reviewed.**

### Why Code Review Matters
- Catches mistakes the author is blind to
- Validates that the code matches the Design Document intent
- Ensures another human (or agent) understands the changes
- Prevents "works on my machine" assumptions

### Code Review Checklist

Use `docs/templates/code-review.md`.

The reviewer must verify:
- [ ] Code matches the PRD and Design Document
- [ ] Tests cover happy path, error path, and edge cases
- [ ] No hardcoded secrets or sensitive data
- [ ] No obvious security holes (SQL injection, XSS, etc.)
- [ ] No debug code left behind (`console.log`, `debugger`, etc.)
- [ ] Functions are small and have a single responsibility
- [ ] Comments explain *why*, not just *what*
- [ ] Interface contracts are respected
- [ ] The reviewer can explain what the code does

### Who Can Review
- **Human teammate** (preferred for critical/security features)
- **Peer AI agent** (acceptable for routine changes)
- **Self-review by the same agent** is **not acceptable** — there must be a second set of eyes

### Gate
**No tests or verification runs until code review is approved.**

---

## Phase 11: Verify

Before declaring anything "done":

- [ ] All tests pass
- [ ] `docs/checklists/SECURITY.md` items verified
- [ ] `docs/checklists/FUNCTIONALITY.md` items verified
- [ ] `./scripts/health-check.sh` passes
- [ ] **Constraint audit from Design Doc passed** (`docs/ANTI_TEST_GAMING.md`)
- [ ] **Adversarial review clean** (no material test loopholes)
- [ ] No console errors
- [ ] PRD success criteria are met

**Rule:** Red build = stop the line. Fix before continuing.

---

## Phase 12: Ship

Run the pre-ship audit:

```bash
./scripts/pre-ship-audit.sh
```

Only deploy if all gates pass.

---

## Phase 13: Closeout

Before declaring the task done:

1. **Log completion to `LOGS.md`**
2. **Update `STATE.md`** — mark task complete or blocked
3. **Update `MEMORY.md`** with decisions and lessons
4. **Write significant decisions to `memory/YYYY-MM-DD.md`**
5. **If bugs were found, add an entry to `ERRORS.md`**

---

## Multi-Agent Orchestration

For complex tasks, the human or lead agent may spawn orchestrators.

### Orchestrator Rules
1. Define work package before spawning
2. Set step limit (default: 25)
3. Require checkpoints every 10 steps
4. Intervene if silent >3 minutes or blocked >5 steps

### Communication Protocol

**Assigner → Orchestrator:**
```
ASSIGN: [Task description]
INTERFACE: [Link to docs/INTERFACES.md]
STEP_LIMIT: [N]
CHECKPOINT_EVERY: [N]
```

**Orchestrator → Assigner:**
```
CHECKPOINT [N]/[MAX]
Status: [progress% | blocked | complete | requesting-support]
What I did: [Specific accomplishments]
What's left: [Specific remaining work]
Blockers: [None | specific issue]
Need help with: [None | specific sub-task]
```

See `docs/templates/work-package.md` and `docs/templates/intervention.md` for templates.

---

## Human / Agent Responsibility Matrix

| Activity | Human | Agent |
|----------|-------|-------|
| Define business requirements | ✅ Lead | ✅ Clarify |
| Draft PRD | ✅ Review | ✅ Draft |
| Approve PRD | ✅ Required | ❌ |
| Define interfaces | ✅ Lead | ✅ Draft |
| Write code | ⚠️ Review | ✅ Lead |
| Write tests | ⚠️ Review | ✅ Lead |
| Run checklists | ✅ Verify | ✅ Draft |
| Approve shipping | ✅ Required | ❌ |
| Update MEMORY.md | ✅ Add context | ✅ Required |
| Update ERRORS.md | ✅ Add context | ✅ Required |

---

## Emergency Overrides

An agent may skip the full workflow ONLY if:

1. It's a one-line bug fix with an obvious solution
2. The human explicitly says: "skip the process, just fix it"
3. It's documentation-only changes
4. There's a critical production incident

Even then, document the change in `CONTEXT_LOG.md` and `MEMORY.md`.
