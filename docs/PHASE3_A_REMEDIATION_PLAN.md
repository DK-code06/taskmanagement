# Phase 3-A: Production Remediation & Hardening Plan

This document outlines the step-by-step technical remediation plan to address the P1 and P2 findings identified during the Phase 3-A Full System Production Readiness Audit.

---

## 1. Remediation Scope Strategy

The audit confirmed that the system has **zero P0 (Production Blocker)** issues and is feature-complete across all major milestones. 

Remediation work in Phase 3-B will focus strictly on **production hardening and configuration safety** (P1 items) and **low-risk structural optimizations** (P2 items). No new business features or speculative architectural overhauls will be introduced.

---

## 2. Phase 3-B Remediation Action Items

### Milestone 1: Production Environment & Secret Hardening (P1 Priority)

#### Item 1.1: Strict Production Environment Validator
- **Target File**: `task-backendd/config/validateEnv.js` (to be created in Phase 3-B)
- **Objective**: Ensure the application aborts startup immediately if mandatory production secrets or configuration variables are missing or insecure.
- **Validation Rules**:
  - `JWT_SECRET`: Must be present, non-empty, and at least 32 characters in production.
  - `GITHUB_TOKEN_ENCRYPTION_KEY`: Must be exactly 32 bytes (64 hex characters or 32 string characters).
  - `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET`: Required if GitHub integration is enabled.
  - `GITHUB_WEBHOOK_SECRET`: Required if GitHub integration is enabled.
  - `CLIENT_ORIGIN`: Must be a valid HTTP/HTTPS URL.
- **Verification**: Write unit test in `task-backendd/tests/validateEnv.test.js`.

#### Item 1.2: Strict Helmet Security Headers & Content Security Policy
- **Target File**: `task-backendd/server.js`
- **Objective**: Configure explicit Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), and frame restrictions.
- **Configuration**:
  - `contentSecurityPolicy`: Directives for `default-src 'self'`, `script-src 'self'`, `connect-src 'self' wss: https:`, `img-src 'self' data: https:`.
  - `hsts`: `maxAge: 31536000, includeSubDomains: true, preload: true`.
- **Verification**: Run `npm test` and verify HTTP security response headers using Supertest.

#### Item 1.3: Eliminate Fallback Secret Strings in Authentication Routines
- **Target File**: `task-backendd/routes/github.js`
- **Objective**: Remove hardcoded fallback strings (`'github_oauth_secret'`) in `generateOAuthState` and `verifyOAuthState`.
- **Remediation**: Use `process.env.GITHUB_CLIENT_SECRET || process.env.JWT_SECRET` and throw an explicit configuration error if neither is set.
- **Verification**: Execute `task-backendd/tests/githubAuth.test.js`.

---

### Milestone 2: Reliability & Database Guard Hardening (P2 Priority)

#### Item 2.1: Atomic Worker Status Lock for Reminder Scheduler
- **Target File**: `task-backendd/services/reminderSchedulerService.js`
- **Objective**: Prevent multi-worker race conditions in clustered deployments when fetching pending reminder jobs.
- **Remediation**: Use `findOneAndUpdate` to transition job status from `PENDING` to `PROCESSING` atomically before executing notifications.
- **Verification**: Execute `task-backendd/tests/reminderScheduler.test.js`.

#### Item 2.2: Array Size Guard Rails for Embedded Subdocuments
- **Target File**: `task-backendd/models/User.js` & `task-backendd/models/Task.js`
- **Objective**: Prevent document bloat on user friend arrays and task comments.
- **Remediation**: Add pre-save validation or maximum push length enforcement (e.g. max 500 friends, max 200 comments per task).
- **Verification**: Execute backend unit test suite.

#### Item 2.3: Anti-CSRF Custom Header Validation for Token Refresh
- **Target File**: `task-backendd/routes/authRoutes.js`
- **Objective**: Require custom header (`X-Requested-With` or `X-Refresh-Token`) on `/api/auth/refresh` requests.
- **Remediation**: Validate header presence before issuing new access/refresh tokens.
- **Verification**: Execute `task-backendd/tests/auth.test.js`.

---

## 3. Deferred Items (Post-Launch Phase 3-C / Optimization)

The following items are low-severity enhancements (P3) that will remain deferred until post-launch scale metrics warrant implementation:

- **Redis Caching Layer**: In-memory caching for analytics and leaderboards.
- **Distributed AI Rate Limiting**: Migrating AI rate limit maps to Redis.
- **Socket.IO Redis Adapter**: Horizontal scaling adapter for multi-instance WebSocket clusters.
- **Legacy Category Model Retirement**: Complete deprecation of legacy Category schemas once older API clients are fully retired.

---

## 4. Remediation Verification Strategy

Each Phase 3-B remediation task must pass all release gates prior to final tagging:

1. **Automated Unit & Integration Testing**: 100% pass rate across all 29 backend test suites (211+ tests) and 14 frontend test suites (66+ tests).
2. **Security & Header Verification**: Automated header assertions using `supertest` to confirm CSP, HSTS, and CORS settings.
3. **Production Build Gate**: Zero-error Vite production build (`npm run build`).
4. **Git Tree Hygiene**: Clean git working tree with single annotated release tag (`phase3-b-stable`).
