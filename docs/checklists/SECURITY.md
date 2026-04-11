# Security Checklist

> Based on the Vibe Coding Security Handbook. Every item must be verified before shipping.

---

## Authentication & Identity

- [ ] **1. Never Build Auth Yourself**
  - Use Clerk, Supabase Auth, or Auth0
  - No DIY JWT handling, password hashing, or session management

- [ ] **2. Session Expiration & Refresh**
  - JWT max 7 days
  - Refresh token rotation enabled

---

## Secrets Management

- [ ] **3. Never Paste API Keys Into AI Chats**
  - If pasted, rotate immediately

- [ ] **4. .gitignore Created First**
  - `.env`, `.env.local`, `.env.production` ignored
  - `node_modules/`, `*.key`, `*.pem`, `secrets/` ignored

- [ ] **5. Rotate Secrets Every 90 Days**
  - High-rotation secrets (30 days): payment webhooks, admin API keys, DB credentials

---

## Dependency Security

- [ ] **6. Verify Packages Exist Before Installing**
  - Checked with `npm view [package] versions` or equivalent

- [ ] **7. Use Latest Stable Versions**
  - Verified no known CVEs

- [ ] **8. Run `npm audit fix`**
  - All high/critical vulnerabilities resolved

---

## Input Validation & Injection

- [ ] **9. Sanitize Every Input**
  - All user input validated (Zod, Joi, class-validator, etc.)

- [ ] **10. Use Parameterized Queries Always**
  - No string-concatenated SQL

---

## Database Security

- [ ] **11. Enable Row-Level Security Day One**
  - RLS enabled on all user-facing tables
  - Policies reviewed and tested

---

## Production Hygiene

- [ ] **12. Remove console.log Before Shipping**
  - Use structured logger (Winston, Pino, etc.)
  - ESLint `no-console` rule active

- [ ] **13. CORS: Production Domain Only**
  - Explicit allowlist, no wildcards in production

- [ ] **14. Validate Redirect URLs**
  - Open redirect vulnerability prevented
  - Allow-list validation on all redirects

---

## API Security

- [ ] **15. Auth + Rate Limits on Every Endpoint**
  - All API routes protected

- [ ] **16. Rate Limit from Day One**
  - General API: 100 req/hour per IP (or stricter)
  - Auth routes: 5 attempts per hour

- [ ] **17. Password Reset: Strict Limits**
  - 3 attempts per email per hour

---

## Cost Control & Abuse

- [ ] **18. Cap AI API Costs**
  - Dashboard limits set
  - Code-level caps implemented

- [ ] **19. DDoS Protection**
  - Cloudflare, Vercel Edge, or equivalent enabled
  - Request timeouts configured

---

## Storage Security

- [ ] **20. Lock Down Storage Buckets**
  - Users can only access their own files

- [ ] **21. Limit Uploads & Validate File Types**
  - Max size enforced
  - File type validated by magic bytes (not extension)

---

## Payments & Webhooks

- [ ] **22. Verify Webhook Signatures**
  - Stripe / payment provider signatures verified

- [ ] **23. Server-Side Permission Checks**
  - Never trust the UI for permissions

---

## AI Security Review

- [ ] **24. AI Security Engineer Review**
  - Prompted an AI to review code for: SQL injection, XSS, IDOR, auth gaps, secrets exposure, input validation gaps

- [ ] **25. AI Penetration Test**
  - Prompted an AI to attempt SQL injection, XSS, IDOR, auth bypass, and sensitive data exposure

---

## Logging & Compliance

- [ ] **26. Log Critical Actions**
  - User delete, role change, payment process, data export, admin login

- [ ] **27. Build Real Account Deletion**
  - GDPR/CCPA compliant
  - Soft delete + scheduled hard delete
  - Data export available on request

- [ ] **28. Automate Backups + Test Restoration**
  - Daily backups automated
  - Monthly restore test to staging

---

## Environment Separation

- [ ] **29. Keep Test/Production Separate**
  - Separate databases, API keys, domains
  - No env-based branching for critical paths

- [ ] **30. Never Let Test Webhooks Touch Real Systems**
  - Webhook handlers reject test events in production

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Security Reviewer | | | |
| Lead Engineer | | | |
| Product Owner | | | |
