# Agent States

> Distinct operational states with specific behaviors, transitions, and safety rules.

---

## State Definitions

| State | Purpose | Behavior |
|-------|---------|----------|
| **resting** | Idle time | Background tasks, memory pruning |
| **coding** | Writing code | Validate syntax, test before commit |
| **scripting** | Shell automation | Dry-run first, checkpoint before |
| **testing** | Validation | Comprehensive tests, report results |
| **reasoning** | Analysis | 5W5H, externalize thinking |
| **executing** | Running commands | Monitor output, capture errors |
| **recovering** | Post-crash | Restore state, resume interrupted |

---

## State Behaviors (Detailed)

### resting
- Perform light background tasks
- Prune outdated memory entries
- Review `ERRORS.md` for stale patterns
- Do NOT modify production code

### coding
- Create checkpoint before entering this state
- Validate syntax before saving
- Run unit tests before declaring success
- Log all changes to `CONTEXT_LOG.md`
- Update `STATE.md` progress after each logical unit

### scripting
- Create checkpoint before entering this state
- Dry-run destructive commands first (`--dry-run`, `echo` preview)
- Validate script syntax (`shellcheck`, `bash -n`)
- Capture full output to `LOGS.md`
- Never run interactive commands

### testing
- Run tests atomically: one assertion = one quantifiable outcome
- Report pass/fail counts with exact numbers
- On failure: capture expected vs actual, stack trace, environment state
- Update `docs/TESTING.md` coverage map if tests are added/removed
- Do NOT skip flaky tests — fix or document

### reasoning
- Externalize all thinking (`docs/AGENT_REASONING.md`)
- Apply 5W5H to every problem
- Use mental models from `docs/MENTAL_MODELS.md`
- Do NOT write code while in reasoning state
- Output structured analysis only

### executing
- Monitor all output in real time
- Capture stdout, stderr, and exit codes
- Abort on unexpected errors (do not proceed blindly)
- Update `STATE.md` with execution status
- Log completion or failure to `LOGS.md`

### recovering
- Check `.recovery_needed` flag
- Load latest session backup from `.kimi/session_backup/`
- Read `STATE.md` to identify interrupted tasks
- Run `./scripts/recovery.sh` to validate state
- Resume or report recovery status to user
- Do NOT start new work until recovery is complete

---

## State Transitions

### Mandatory Transitions

| From | To | Requirement |
|------|-----|-------------|
| *any* | **coding** | Create checkpoint first |
| *any* | **scripting** | Create checkpoint first |
| **reasoning** | **coding** | Success criteria defined in `STATE.md` |
| **testing** | **coding** | All tests pass OR failures documented |
| **executing** | **coding** | Output captured and exit code validated |
| *any* | **recovering** | `.recovery_needed` flag detected |

### Auto-Checkpoint Triggers

- Entering **coding** → checkpoint
- Entering **scripting** → checkpoint
- Long tasks (>60s of continuous execution) → auto-checkpoint
- Before gateway restart → save session state

### Recovery Trigger

- After restart → check `.recovery_needed` flag
- If set → transition to **recovering** immediately

---

## State Logging

Every state transition must be logged to `CONTEXT_LOG.md`:

```markdown
## Turn N: State Transition
**From:** [old state]
**To:** [new state]
**Trigger:** [Why the transition occurred]
**Checkpoint:** [checkpoint name or "none"]
```

---

## Quick Reference

```
Checkpoint before coding/scripting
Auto-checkpoint every 60s on long tasks
Save session state before gateway restart
Check .recovery_needed on startup
Transition to recovering if flag is set
Never write code while in reasoning state
Always test before leaving testing state
```
