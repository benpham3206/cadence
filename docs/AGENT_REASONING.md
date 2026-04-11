# Agent Reasoning Protocol

> Externalized thinking framework for AI agents. Run these gates before every response.

---

## Philosophy

Reasoning should not be hidden. These gates force the agent to think out loud, catch errors early, and delegate appropriately. This document is your pre-flight checklist for every turn.

---

## Pre-Response Checklist: The Five Gates

Run through all five gates before generating any response.

---

### Gate 1: Intent Check

> Do I understand what the user wants? If unsure, ask.

**Action:**
- Restate the request in one sentence
- Identify ambiguities
- If anything is unclear, ask clarifying questions first

**Log to `STATE.md`:**
```markdown
## [YYYY-MM-DD HH:MM:SS] — [Task Summary]
**Status:** understanding
**User Intent:** [Restated in one line]
**Open Questions:** [List or "none"]
```

---

### Gate 2: 5W5H — Choose the Right Mode

> Before solving, decide whether the problem *chains* (deep cause) or *branches* (independent issues).

#### Mode A: Sequential 5 Whys → 5 Hows
**Use when:** The problem is deep and systemic. Each answer causes the next question.

**Rule:** Exhaust *why* before touching *how*.
**Best for:** Recurring outages, bugs that keep coming back, process failures, post-mortems.

**Template:**
- Why 1: [surface symptom]
- Why 2: [cause of Why 1]
- Why 3: [cause of Why 2]
- Why 4: [cause of Why 3]
- Why 5: [root cause]
- How 1-5: [fix the root cause, not the symptom]

#### Mode B: Paired Why → How
**Use when:** The problem has multiple independent failure points. Each answer is a separate issue.

**Rule:** Surface each issue and fix it immediately.
**Best for:** Code review feedback, features with multiple problems, onboarding friction, sprint retrospectives.

**Template:**
- Why 1: [issue A] → How 1: [fix A]
- Why 2: [issue B] → How 2: [fix B]
- Why 3: [issue C] → How 3: [fix C]
- ...

#### Decision Rule
> If your whys **chain**, go sequential.
> If your whys **branch**, go paired.

---

### Gate 3: Complexity Check

> Score 0-10. If ≥4, delegate to subagents. If parallelizable (and, vs, compare) ≥2, delegate. Max 3 concurrent subagents.

**Complexity Scoring Rubric:**

| Score | Meaning | Action |
|-------|---------|--------|
| 0-1 | Trivial (single file, obvious fix) | Handle directly |
| 2-3 | Simple (1-2 files, no risk) | Handle directly |
| 4-6 | Moderate (multi-file, some nuance) | **Delegate** to 1 subagent |
| 7-8 | Complex (architecture, multiple modules) | **Delegate** to 2-3 subagents |
| 9-10 | Very complex (cross-cutting, high risk) | **Delegate** to 3 subagents + human review |

**Parallelization Triggers:**
If the request contains parallel work ("and", "vs", "compare", "both", "all three"), delegate even if individual complexity is low.

**Delegation Template:**
```markdown
ASSIGN SUB-TASK: [Description]
REASONING_GATE: Complexity score [N]/10, parallelizable=[yes/no]
SUCCESS_CRITERIA: [Specific, testable outcome]
REPORT_TO: Main agent
```

---

### Gate 4: Detail Awareness (Salvatier)

> "What fiddly subtasks am I glossing over?" "What seems simple but decomposes into nuance?"

**Action:**
- List 2-3 hidden subtasks
- If it "feels easy," stop and decompose
- Surface edge cases, dependencies, or validation steps

**Template:**
```markdown
### Hidden Subtasks
1. [Subtask I might miss]
2. [Subtask I might miss]
3. [Subtask I might miss]

### Edge Cases
- [Edge case 1]
- [Edge case 2]
```

---

### Gate 5: Task State

> Check/create STATE.md entry. Define success criteria first. Then execute.

**Action:**
1. Read `STATE.md`
2. If no active entry exists, create one
3. Write success criteria before any code
4. Only then proceed to execution

**STATE.md Entry Template:**
```markdown
## [Task ID] — [Short Name]
**Created:** [YYYY-MM-DD HH:MM:SS]
**Status:** in_progress / blocked / complete
**Complexity Score:** [N]/10
**Delegated:** yes / no

### Success Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

### Hidden Subtasks
1. 
2. 

### Blockers
- [None | list]

### Notes
-
```

---

## Execution Rules

### Rule 1: Checkpoint Before Significant Changes

Before any significant change, run:

```bash
./scripts/checkpoint.sh create "[description of change]"
```

This snapshots the current state so you can recover if something goes wrong.

### Rule 2: Auto-Checkpoint on Long Tasks

If a task is expected to take >60 seconds of continuous execution, create a checkpoint mid-flight.

### Rule 3: Prefer Fewer Large Writes Over Tight One-Item Loops

- Batch file operations when possible
- Avoid writing one file per tool call when 3-4 can be done in parallel
- Group related edits into single atomic operations

### Rule 4: Telegram Formatting

When formatting output for Telegram or narrow contexts:
- No Markdown tables
- Use 10-20 character columns
- Use arrow notation (`->`) for mappings

**Example:**
```
auth    -> Clerk
db      -> Postgres
cache   -> Redis
```

---

## Closeout Protocol

Before ending any task, complete all three steps:

### Step 1: Log Completion to LOGS.md

```markdown
## [YYYY-MM-DD HH:MM:SS] — [Task Name]
**Status:** complete / partial / blocked
**Duration:** [N minutes]

### Completed
- ✅ [Item 1]
- ✅ [Item 2]

### Blocked
- ❌ [Item + reason]

### Next Actions
- [Next recommended step]
```

### Step 2: Update STATE.md

- Mark the active task entry as `complete` or `blocked`
- Update success criteria checkboxes

### Step 3: Write Significant Decisions to Memory

If the task involved a significant decision:
- Write to `memory/YYYY-MM-DD.md`
- Or append to `MEMORY.md`

**memory/YYYY-MM-DD.md Template:**
```markdown
# Decisions — [YYYY-MM-DD]

## [Decision Title]
**Context:** [Why this came up]
**Decision:** [What we chose]
**Rationale:** [Why]
**Trade-offs:** [What we gave up]
**Consequences:** [What happens next]
```

---

## Quick Reference Card

```
START  -> Run 5 gates
INTENT -> Restate user request
5W5H   -> Root cause 1 line, fix 1 line
COMPLEX -> Score 0-10, delegate if ≥4 or parallel
SALVATIER -> List hidden subtasks, decompose if "easy"
STATE  -> Create STATE.md entry, define success criteria
EXEC   -> Checkpoint first if significant
CLOSE  -> LOGS.md + STATE.md + memory/YYYY-MM-DD.md
```
