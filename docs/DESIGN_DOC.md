# Design Document Phase

> After test definition, before code: design the solution with constraints, criteria, and confidence measures. The design doc itself contains atomically precise requirements.

---

## Core Rule

**PRD → UI/UX → Test Definition → Design Doc → Code**

The Design Document is the bridge between "what we test" and "how we build it." It prevents agents from writing code that merely passes tests by defining:

1. **Objectives** — what the system must achieve
2. **Detailed objectives** — broken down until each is independently achievable
3. **Metrics** — how we measure each detailed objective
4. **Constraints** — the hard line. Cross it, and the design is *out*.
5. **Criteria** — the optimization direction. "Better looks like this."

---

## Why This Prevents "Test-Passing Code"

Tests can be gamed. An agent can write code that satisfies the literal assertions while violating the spirit of the requirement. The Design Document prevents this by:

- **Defining constraints that tests do not cover** (architecture, performance, maintainability)
- **Requiring the agent to explain *why* the design is trustworthy** before coding
- **Forcing a review of test loopholes** (adversarial test analysis)
- **Linking every test to a higher-level objective** so tests are never arbitrary

---

## Document Structure

### 1. High-Level Objectives

Derived directly from the PRD.

- **Functional objectives:** What must the system *do*?
- **Non-functional objectives:** How well must it do it?

### 2. Detailed Objectives

Apply **Reality Has Surprising Detail** (Salvatier). Break every high-level objective into small, independently achievable pieces.

> If an objective feels "easy," stop and decompose further.

### 3. Metrics

For each detailed objective, define **one or more measures**. The metric must be meaningful based on the means available to measure it.

**Good metric:** "Response time for 10k rows < 2 seconds on local hardware."  
**Bad metric:** "Fast enough."

### 4. Constraints (The Line)

Constraints form the pass/fail boundary. A design that fails a constraint is **out**.

- Must be verifiable
- Must be stated as "not worse than X"
- Must reference real measurement capability

**Example:**
- "Memory usage must not exceed 512MB under peak load."
- "No direct database queries from the frontend."
- "All secrets must remain server-side."

### 5. Criteria (Better Looks Like This)

Criteria determine "better" vs "worse" among designs that all pass constraints.

- Stated as directional goals
- Used when trade-offs are required

**Example:**
- "Lower cyclomatic complexity is better."
- "Fewer external dependencies is better."
- "More explicit error messages are better."

### 6. Test-to-Objective Mapping

Every test must map to an objective. No orphan tests.

| Test ID | Objective | Purpose | Method | Expected Confidence |
|---------|-----------|---------|--------|---------------------|
| T1 | User can authenticate securely | Verify password hashing is bcrypt with cost ≥ 10 | Unit test on auth module | High |
| T2 | System handles concurrent users | Verify no race condition on account creation | Load test with 100 parallel requests | Medium (prototype) |

### 7. Test Philosophy (Not Hardcoded)

For tests that are not purely mechanical, describe:

1. **Purpose** — What objective does this test demonstrate?
2. **Method** — How is the test performed? (Only if non-standard)
3. **Results** — What results from the prototype/design tell us it works?
4. **Confidence Discussion** — How well did the design perform? Does this give us confidence in the real system?

### 8. Adversarial Test Review

Before writing code, the agent must answer:

- How could an implementation pass these tests while still being wrong?
- What tests are missing?
- What constraints prevent gaming the tests?

If loopholes are found, fix the tests or add constraints **before** coding.

### 9. Recommendations

Ordered by one of these principles:
- Most important → least important
- Short term → long term
- Order of operations

Keep each recommendation to **one sentence**.

---

## Approval Gate

**No code until the Design Document is complete and the adversarial test review is clean.**

The document must be reviewed for:
- [ ] Every PRD objective is covered by constraints or criteria
- [ ] Every test maps to an objective
- [ ] Constraints are verifiable with available tools
- [ ] Adversarial review found no material loopholes
- [ ] Recommendations are ordered and actionable

---

## Anti-Patterns

❌ **"The tests are the design"** — Tests check behavior. Design explains *why* that behavior is correct and *what else* matters.  
❌ **Vague constraints** — "Should be secure" is not a constraint. "All inputs sanitized with Zod" is.  
❌ **Skipping the adversarial review** — This is where test-gaming gets caught.  
❌ **Criteria without constraints** — Criteria optimize among valid designs. Constraints eliminate invalid ones.
