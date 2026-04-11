# UI Specification Template

Use this to document screens, components, and user flows before writing tests or code.

---

## Screen/Component: [Name]

**PRD Reference:** [Section X.Y]
**Platform:** web / mobile / both
**Viewport:** desktop / tablet / mobile / all

---

### User Flow

```
[Previous Screen] → [This Screen] → [Next Screen A]
                          ↓
                    [Next Screen B]
```

**Entry Points:**
- 
- 

**Exit Points:**
- 
- 

---

### Layout

**Desktop:**
```
┌─────────────────────────────────────┐
│ Header                              │
├──────────────┬──────────────────────┤
│ Sidebar      │ Main content         │
│              │                      │
└──────────────┴──────────────────────┘
```

**Mobile:**
```
┌─────────────────┐
│ Header          │
├─────────────────┤
│ Main content    │
│                 │
├─────────────────┤
│ Bottom nav      │
└─────────────────┘
```

---

### Elements

| Element | Type | Label/Copy | Behavior |
|---------|------|------------|----------|
| Primary button | `<button>` | "[Exact text]" | On click: [action] |
| Email input | `<input type="email">" | Placeholder: "[Exact text]" | Validation: [rule] |
| Error banner | `<div role="alert">` | "[Exact error message]" | Appears when: [condition] |

---

### States

#### Default State
- 

#### Loading State
- Spinner location:
- Copy (if any):
- Button behavior:

#### Success State
- Visual change:
- Copy:
- Next action:

#### Error State
- Exact error message:
- Error location:
- Recovery action:

#### Empty State
- Exact copy:
- Illustration (if any):
- CTA:

---

### Accessibility

- [ ] Keyboard navigable
- [ ] Focus indicators defined
- [ ] ARIA labels provided
- [ ] Color contrast meets WCAG 2.1 AA
- [ ] Screen reader behavior described

---

### Feedback Loop

| User Action | System Response |
|-------------|-----------------|
| | |

---

## Sign-Off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Product | | | |
| Design | | | |
| Engineering | | | |
