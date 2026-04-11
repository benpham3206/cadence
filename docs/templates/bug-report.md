# Bug Report Template

> Classify, reproduce, and resolve bugs with edge case awareness.

---

## Bug Summary

**Title:** [Short, specific description]
**Reporter:** [Name]
**Date:** [YYYY-MM-DD]
**Severity:** critical / major / minor
**Type:** regular / edge case / regression

---

## Classification

### Regular Bug
- Occurs under normal usage
- Affects the happy path or common flow
- Example: "Login button doesn't work"

### Edge Case Bug
- Occurs under unusual but valid conditions
- Often at boundaries, empty states, or race conditions
- Example: "App crashes when user has 0 items and refreshes twice rapidly"

### Regression
- Feature worked before, now broken
- Link to previous working version or PR

---

## Reproduction

### Environment
- OS:
- Browser/App version:
- Branch/Commit:

### Steps to Reproduce
1. 
2. 
3. 

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Evidence
- Screenshot/video:
- Logs:
- Error message (exact):

---

## Root Cause Analysis (5 Whys)

**Why 1:** Why does [symptom] happen?
→ 

**Why 2:** Why [answer 1]?
→ 

**Why 3:** Why [answer 2]?
→ 

**Why 4:** Why [answer 3]?
→ 

**Why 5:** Why [answer 4]?
→ [Root cause]

---

## Fix Plan

### Immediate Fix
[What will be done now]

### Prevention
[How to prevent this class of bug in the future]

### Tests Added
- [ ] Regression test for this specific bug
- [ ] Edge case test for boundary condition
- [ ] Integration test for failure mode

---

## Verification

- [ ] Bug reproduced before fix
- [ ] Fix applied
- [ ] Bug no longer reproducible
- [ ] New tests pass
- [ ] Related tests still pass (no regression)
- [ ] ERRORS.md updated with lesson

---

## Sign-Off

| Role | Name | Date |
|------|------|------|
| Fix Author | | |
| Reviewer | | |
