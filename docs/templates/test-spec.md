# Test Specification Template

> Define tests after UI/UX and before writing any code. Every UI state = one test.

---

## Feature: [Name]

**PRD Reference:** [Section X.Y]
**UI/UX Reference:** [Link to ui-spec.md]
**Interface Reference:** [Link to docs/INTERFACES.md]

---

## Test Philosophy

Every test must be:
- **Atomic:** one assertion = one quantifiable claim
- **Derived from UI/UX:** tests verify the designed states
- **Exhaustive:** happy path, loading, error, empty, edge cases

---

## Test Cases

### Happy Path

| ID | Scenario | Steps | Expected Result | Type |
|----|----------|-------|-----------------|------|
| T1 | [e.g., User submits valid email] | 1. Enter "alice@example.com"<br>2. Click "Submit" | 1. Button shows loading state<br>2. Success message appears: "[exact copy]"<br>3. User redirected to /dashboard | E2E |

### Loading / Intermediate States

| ID | Scenario | Steps | Expected Result | Type |
|----|----------|-------|-----------------|------|
| T2 | [e.g., Form submission in progress] | 1. Enter valid data<br>2. Click "Submit" | 1. Button disabled with spinner<br>2. No duplicate submissions possible | Unit |

### Error States

| ID | Scenario | Steps | Expected Result | Type |
|----|----------|-------|-----------------|------|
| T3 | [e.g., User submits invalid email] | 1. Enter "not-an-email"<br>2. Click "Submit" | Inline error appears: "[exact error message from UI spec]" | Unit |
| T4 | [e.g., Network failure on submit] | 1. Enter valid data<br>2. Block network<br>3. Click "Submit" | Error banner: "[exact message]" + retry button visible | Integration |

### Empty / Edge States

| ID | Scenario | Steps | Expected Result | Type |
|----|----------|-------|-----------------|------|
| T5 | [e.g., List has no items] | 1. Navigate to /items with empty DB | Empty state renders: "[exact copy]" + "Create item" CTA | Unit |
| T6 | [e.g., Input at max length boundary] | 1. Enter 254-character email local part | Validation allows submission | Unit |
| T7 | [e.g., Input exceeds max length] | 1. Enter 255-character email local part | Validation rejects with "[exact message]" | Unit |

---

## Edge Case Audit

Before implementation, verify these are tested:

- [ ] Boundary values (min, max, min-1, max+1)
- [ ] Empty/null/undefined inputs
- [ ] Whitespace-only inputs
- [ ] Special characters and encoding
- [ ] Rapid repeated actions (double-click, resubmit)
- [ ] Network/service failures
- [ ] Permission denied scenarios
- [ ] Concurrent modifications

---

## Sign-Off

**No code until this test spec is complete and approved.**

| Role | Name | Date | Approved |
|------|------|------|----------|
| QA / Test Lead | | | |
| Engineering | | | |
| Product | | | |
