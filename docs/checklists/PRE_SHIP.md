# Pre-Ship Checklist

> Final gates before deploying to production. All items must be checked.

---

## Documentation

- [ ] `PRD.md` is complete and approved
- [ ] `docs/INTERFACES.md` is up to date
- [ ] `README.md` is accurate
- [ ] `MEMORY.md` has recent entries for this release
- [ ] ADRs created for any architectural changes

---

## Code Quality

- [ ] All lint checks pass
- [ ] All type checks pass
- [ ] All tests pass (unit, integration, E2E)
- [ ] Test coverage meets team threshold
- [ ] No `console.log` or debug statements left in production code
- [ ] No TODO/FIXME comments without ticket numbers

---

## Security

- [ ] `docs/checklists/SECURITY.md` is fully checked and signed off
- [ ] No secrets in code or config files committed to repo
- [ ] All environment variables documented in `.env.example`
- [ ] Rate limiting active on all endpoints
- [ ] CORS restricted to production domains

---

## Functionality

- [ ] `docs/checklists/FUNCTIONALITY.md` is fully checked and signed off
- [ ] `/health` endpoint returns healthy
- [ ] All critical user flows tested manually
- [ ] Feature flags configured for production
- [ ] Database migrations tested in staging

---

## Performance

- [ ] Load times acceptable on target devices/networks
- [ ] Database queries optimized (no N+1, no missing indexes)
- [ ] Static assets cached/CDN configured

---

## Observability

- [ ] Monitoring dashboards configured
- [ ] Alerts configured for error rate and latency thresholds
- [ ] Logs are structured and searchable
- [ ] On-call runbook updated for new features

---

## Rollback Plan

- [ ] Rollback procedure documented
- [ ] Previous release artifact available
- [ ] Database migrations are backward-compatible OR rollback script exists

---

## Final Verification

Run these commands and confirm output:

```bash
# Health check
./scripts/health-check.sh

# Tests
npm test 2>&1 | grep -E "passed|failed"

# Lint
npm run lint

# Type check
npm run typecheck

# Build
npm run build
```

- [ ] All commands above pass successfully

---

## Sign-Off

**By signing, you confirm that all checklist items have been verified and the release is ready for production.**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Release Engineer | | | |
| Tech Lead | | | |
| Security Reviewer | | | |
| Product Owner | | | |
