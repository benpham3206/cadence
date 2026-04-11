# Design Document Template

Use this after test definition and before writing any code.

---

## Feature: [Name]

**PRD Reference:** [Section X.Y]  
**UI/UX Reference:** [Link to ui-spec.md]  
**Test Spec Reference:** [Link to test-spec.md]  
**Date:** [YYYY-MM-DD]  
**Author:** [Name]

---

## 1. High-Level Objectives

### Functional Objectives
- [Objective 1: e.g., "Users can reset their password via email"]
- [Objective 2]

### Non-Functional Objectives
- [Objective 1: e.g., "Password reset completes in < 5 seconds"]
- [Objective 2]

---

## 2. Detailed Objectives

> Apply "Reality Has Surprising Detail." Decompose until each item is independently achievable.

### Objective 1: [Name]
- **Detailed 1.1:** [Specific sub-objective]
- **Detailed 1.2:** [Specific sub-objective]
- **Detailed 1.3:** [Specific sub-objective]

### Objective 2: [Name]
- **Detailed 2.1:** [Specific sub-objective]
- **Detailed 2.2:** [Specific sub-objective]

---

## 3. Metrics

For each detailed objective, define how it is measured.

| Detailed Objective | Metric | Measurement Tool |
|-------------------|--------|------------------|
| [e.g., 1.1] | [e.g., Email delivery time < 30s] | [e.g., Mailtrap logs] |
| | | |

---

## 4. Constraints (The Line)

A design that violates any constraint is **out**.

| ID | Constraint | Verification Method |
|----|------------|---------------------|
| C1 | [e.g., No plaintext passwords in logs or DB] | [e.g., Log scan + DB schema review] |
| C2 | [e.g., Token expiration ≤ 24 hours] | [e.g., Unit test on JWT config] |
| C3 | | |

---

## 5. Criteria (Better Looks Like This)

Among designs that pass all constraints, prefer those that score better on these criteria.

| ID | Criterion | Direction |
|----|-----------|-----------|
| CR1 | [e.g., Fewer external dependencies] | Lower is better |
| CR2 | [e.g., Clearer error messages] | Higher clarity is better |
| CR3 | | |

---

## 6. Test-to-Objective Mapping

| Test ID | Objective | Purpose | Method (if non-standard) | Confidence |
|---------|-----------|---------|--------------------------|------------|
| T1 | [Objective ref] | [What this test proves] | [How it's done] | High / Medium / Low |
| T2 | | | | |

---

## 7. Test Philosophy (Not Hardcoded)

For non-mechanical tests, describe purpose, method, results, and confidence.

### Test: [Name / ID]

**Purpose:** [What objective does this test demonstrate?]

**Method:** [How is the test performed?]

**Results:** [What does the prototype/design need to show?]

**Confidence Discussion:** [Does passing this test give us confidence in the real system? Why or why not?]

---

## 8. Adversarial Test Review

> How could an implementation pass the tests while still being wrong?

**Potential Loophole 1:** [Description]
- **Mitigation:** [Fix the test, add a constraint, or both]

**Potential Loophole 2:** [Description]
- **Mitigation:**

**Missing Tests:** [List any tests that should be added before coding]

**Missing Constraints:** [List any constraints that prevent gaming]

---

## 9. Design Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| | | |

---

## 10. Recommendations

Order by: **most important → least important** OR **short term → long term** OR **order of operations**.

1. [One sentence.]
2. [One sentence.]
3. [One sentence.]

---

## Sign-Off

**No code until this document is approved.**

| Role | Name | Date | Approved |
|------|------|------|----------|
| Tech Lead | | | |
| Product | | | |
