# Document Index

> Catalog of all markdown documents in the Cadence project.

---

## Root Documents

| File | Purpose | Updated |
|------|---------|---------|
| `AGENTS.md` | Agent operating manual + technical design spec | 2026-04-10 |
| `PRD.md` | Product Requirements Document | 2026-04-10 |
| `STATE.md` | Current task state and history | 2026-04-10 |
| `CONTEXT_LOG.md` | Append-only execution journal (source of truth) | 2026-04-10 |
| `MEMORY.md` | Decisions, lessons, patterns | 2026-04-10 |
| `ERRORS.md` | Bug log and patterns to remember | 2026-04-10 |
| `LOGS.md` | Chronological completion log | 2026-04-10 |
| `INDEX.md` | This file — document catalog | 2026-04-10 |
| `README.md` | Human onboarding (TBD) | — |

## Process Documentation (`docs/`)

| File | Purpose |
|------|---------|
| `docs/PROCESS.md` | 15-phase workflow for human + agent collaboration |
| `docs/AGENT_REASONING.md` | 5-gate pre-response reasoning protocol |
| `docs/AGENT_STATES.md` | Agent state machine and transitions |
| `docs/MENTAL_MODELS.md` | Mental models quick reference |
| `docs/ANTI_TEST_GAMING.md` | Safeguards against test-gaming code |
| `docs/DESIGN_DOC.md` | Design document philosophy and constraints |
| `docs/TESTING.md` | Testing strategy (adapted for Cadence) |
| `docs/INTERFACES.md` | Component interface contracts |
| `docs/UI_UX.md` | UI/UX design and state documentation |

## Checklists (`docs/checklists/`)

| File | Purpose |
|------|---------|
| `docs/checklists/SECURITY.md` | 30 security rules + AI security review |
| `docs/checklists/FUNCTIONALITY.md` | Production readiness checklist (Cadence-adapted) |
| `docs/checklists/PRE_SHIP.md` | Final go-live checklist |

## Templates (`docs/templates/`)

| File | Purpose |
|------|---------|
| `docs/templates/work-package.md` | Work package definition |
| `docs/templates/intervention.md` | Agent intervention template |
| `docs/templates/post-mortem.md` | Post-mortem template |
| `docs/templates/ui-spec.md` | UI specification template |
| `docs/templates/test-spec.md` | Test definition template |
| `docs/templates/design-doc.md` | Design document template |
| `docs/templates/bug-report.md` | Bug report template |
| `docs/templates/code-review.md` | Code review checklist |

## Architecture Decision Records (`docs/adr/`)

| File | Purpose |
|------|---------|
| `docs/adr/000-template.md` | ADR template |

## Automation Scripts (`scripts/`)

| File | Purpose |
|------|---------|
| `scripts/init-project.sh` | One-time project initialization |
| `scripts/health-check.sh` | Pre-work audit script |
| `scripts/pre-ship-audit.sh` | Final shipping validation |
| `scripts/checkpoint.sh` | Create recoverable checkpoints |
| `scripts/recovery.sh` | Post-crash state restoration |

## Agent Context (`.kimi/`)

| File | Purpose |
|------|---------|
| `.kimi/context_log.tail` | Context log tail pointer |
| `.kimi/checkpoints/` | Checkpoint storage |
