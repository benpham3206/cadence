# Anti-Test-Gaming Safeguards

> Mechanisms to ensure agents write accurate code, not just code that passes tests.

---

## The Problem

AI agents are pattern-matching machines. Given a test suite, an agent will naturally write the simplest, most probable code that makes the tests turn green. This is not malice — it is optimization.

**The danger:** The code passes all tests while being:
- Brittle (overfit to the test data)
- Wrong (exploits a loophole in the test logic)
- Incomplete (handles tested cases but fails in production)
- Structurally unsound (violates architecture, security, or maintainability)

---

## Safeguard 1: Design Document Constraints

**Tests verify behavior. Constraints verify architecture.**

Before writing code, the Design Document defines constraints that tests cannot easily enforce:

- "No database queries from the frontend"
- "All secrets remain server-side"
- "No hardcoded values in business logic"
- "Cyclomatic complexity ≤ 10 per function"
- "No direct DOM manipulation in unit-tested logic"

**Action:** After coding, run a constraint audit. If the code violates a constraint, it is **out** regardless of test status.

---

## Safeguard 2: Adversarial Test Review

**Before writing code, the agent must try to break the tests.**

Mandatory questions:
1. How could an implementation pass these tests while still being wrong?
2. What edge cases are the tests missing?
3. Are any tests implementation-dependent (testing "how" instead of "what")?
4. Could a hardcoded lookup table or mocked behavior pass the tests?

**Action:** If loopholes are found, fix the tests or add constraints **before** any code is written.

---

## Safeguard 3: Black-Box Test Requirement

**Tests must specify *what* happens, not *how* it happens.**

### Bad (Implementation-Dependent)
```typescript
it("should use bcrypt for hashing", () => {
  const spy = jest.spyOn(bcrypt, "hash");
  hashPassword("secret");
  expect(spy).toHaveBeenCalled();
});
```

### Good (Behavioral)
```typescript
it("should produce a verifiable hash from a password", async () => {
  const hash = await hashPassword("secret");
  const isValid = await verifyPassword("secret", hash);
  expect(isValid).toBe(true);
});
```

**Action:** Review every test for implementation independence. If a test breaks during a valid refactor, it is a bad test.

---

## Safeguard 4: Property-Based and Fuzz Testing

**Example-based tests can be gamed. Properties cannot.**

Where possible, define properties:
- "For any valid input, the output is always defined"
- "For any password, the hash is never equal to the plaintext"
- "For any list, sorting is idempotent"

**Action:** Add at least one property-based or fuzz test for critical logic.

---

## Safeguard 5: Constraint Audit After Coding

Run this checklist after implementation, **independent of the test suite**:

- [ ] No hardcoded test data in production code
- [ ] No implementation details leaked into public APIs
- [ ] Security constraints from Design Doc are satisfied
- [ ] Performance constraints from Design Doc are satisfied
- [ ] Architecture constraints (layer boundaries, dependency rules) are satisfied
- [ ] Code would still work if test data were changed

**Action:** If any item fails, rewrite the code before declaring success.

---

## Safeguard 6: Human Review for "Plausible but Wrong"

Agents write plausible code. Humans catch implausible-but-probable failures.

**Require human review when:**
- The feature touches security, money, or user data
- The agent used `if/else` chains that map suspiciously closely to test cases
- The implementation contains unexplained constants or lookup tables
- The code is significantly simpler than the problem suggests it should be

**Action:** Flag the code for human review with a specific concern.

---

## Safeguard 7: Test Mutation Check

**If a test is deleted, would the code still be obviously correct?**

If the answer is "no," the code is too tightly coupled to the tests.

**Action:** Mentally remove one test at a time. Does the remaining logic still make sense? If not, the design is brittle.

---

## Quick Reference

```
Before coding:
  1. Define constraints (things tests can't catch)
  2. Run adversarial test review
  3. Ensure tests are black-box / behavioral

After coding:
  4. Run constraint audit (independent of tests)
  5. Check for hardcoded test data
  6. Verify no implementation leakage
  7. Flag for human review if security-critical or suspiciously simple
  8. Run test mutation check
```

---

**Remember:** Green tests are necessary, not sufficient. The goal is correct code, not passing code.
