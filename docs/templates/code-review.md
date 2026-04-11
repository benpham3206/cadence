# Code Review Checklist

> Template for reviewing code changes before they enter verification.

---

## Review Metadata

| Field | Value |
|-------|-------|
| **PR / Change** | [Link or description] |
| **Author** | [Name] |
| **Reviewer** | [Name — must be different from author] |
| **Date** | [YYYY-MM-DD] |
| **Scope** | [Files or features under review] |

---

## 1. Requirements Alignment

- [ ] Code implements the approved PRD
- [ ] Code satisfies the Design Document constraints and criteria
- [ ] No scope creep — changes match what was planned

## 2. Test Quality

- [ ] Tests cover the happy path
- [ ] Tests cover error paths
- [ ] Tests cover edge cases (nulls, boundaries, rapid actions)
- [ ] Tests are deterministic (no randomness or timing dependence)
- [ ] Every test maps to a UI/UX state or Design Doc objective

## 3. Security & Safety

- [ ] No secrets, API keys, or passwords in code
- [ ] No hardcoded credentials or environment-specific URLs
- [ ] Inputs are validated before use
- [ ] No obvious injection vectors (SQL, command, XSS)
- [ ] Sensitive operations have proper guards

## 4. Code Quality

- [ ] No debug code left behind (`console.log`, `debugger`, `TODO` without ticket)
- [ ] Functions are small and do one thing
- [ ] Naming is clear and self-describing
- [ ] Comments explain *why*, not just *what*
- [ ] No dead code or unused imports

## 5. Interface & Integration

- [ ] Component/API interfaces match `docs/INTERFACES.md`
- [ ] Error handling is consistent across the codebase
- [ ] Return types and contracts are respected
- [ ] No breaking changes to existing consumers (or documented if intentional)

## 6. Reviewer Understanding

- [ ] The reviewer can explain what the code does
- [ ] The reviewer can explain what could go wrong

---

## Review Decision

**Status:** ⬜ Approve / ⬜ Request Changes / ⬜ Reject

### Required Changes (if any)
1. [Specific change with file/line reference]
2. [Specific change with file/line reference]

### Notes / Praise
- [Optional observations or commendations]

---

## Sign-Off

> By signing off, the reviewer confirms they have checked every applicable item above.

**Reviewer signature:** ___________________
