# Work Package Template

Copy this template for each work package when using multi-agent orchestration.

---

## Work Package: [Name]

**Priority:** P0 / P1 / P2
**Estimated Steps:** [N] (be realistic)
**Interface:** [Link to docs/INTERFACES.md]
**Dependencies:** [Other packages or PRs needed]

---

### Scope

[Clear, bounded description of what this work package covers.]

**In Scope:**
- 
- 

**Out of Scope:**
- 
- 

---

### Definition of Done

- [ ] Code implemented per interface spec
- [ ] Tests written (happy path, error path, edge case)
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Health check passes (`./scripts/health-check.sh`)
- [ ] Interface compliance verified
- [ ] No console errors
- [ ] Works in dev environment

---

### Checkpoint Schedule

| Step | Action | Max Time |
|------|--------|----------|
| 5 | Quick check | 1 min response |
| 10 | Progress report | 2 min response |
| 15 | Mid-point review | 2 min response |
| 20 | Final verification | 2 min response |
| 25 | Complete or escalate | Immediate |

---

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| | | | |

---

### Notes for Orchestrator

- Step limit: 25 (hard limit)
- Can spawn workers: Yes / No
- Max workers: [N]
- Ask for help immediately if stuck
- Do NOT exceed step limit without approval
