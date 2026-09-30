# Architectural Decision Record (ADR)

**Date**: September 29, 2026  
**Status**: Proposal for Review  
**Rule**: All unresolved decisions remain **PENDING** until explicit user approval is granted. No dependent implementation will proceed before approval.

---

## Decision 1: Frontend Hosting Platform

### Current state
The frontend is a React 19 + Vite single-page application (SPA) with hardcoded local API references.

### Options
- **Option A**: Static SPA hosting on Vercel / Netlify / Cloudflare Pages.
- **Option B**: Single Express server serving static Vite build (`dist/`) alongside API endpoints.

### Advantages
- **Option A**: Global CDN distribution, instant rollbacks, automated preview deployments, zero server cost for static assets.
- **Option B**: Single deployment target, simplified CORS management, single process.

### Disadvantages
- **Option A**: Requires configured CORS headers on backend and dual environment variable setup for custom domain/Web Push.
- **Option B**: Couples static asset delivery to Express process resource usage; sacrifices global CDN edge caching.

### Recommendation
**Option A (Vercel / Netlify / Cloudflare Pages)** for production static asset delivery, combined with strict CORS headers on backend.

### Impact
Enables clean separation of frontend SPA build pipeline while keeping target architecture as a Modular Monolith.

### Migration requirements
Configure Vite build output, define SPA fallback rewrite rules (`index.html`), and inject `VITE_API_URL`.

**User approval**: PENDING

---

## Decision 2: Backend Hosting Platform

### Current state
Node.js Express application with inline Socket.IO HTTP server running on port 5000.

### Options
- **Option A**: Render / Railway / Fly.io containerized deployment with persistent WebSocket support.
- **Option B**: Serverless Functions (AWS Lambda / Vercel Serverless).

### Advantages
- **Option A**: Full native support for long-lived Socket.IO WebSocket connections, background job timers, in-memory socket state, single configuration.
- **Option B**: Auto-scaling to zero.

### Disadvantages
- **Option A**: Modest monthly hosting cost for persistent node process.
- **Option B**: Incompatible with persistent Socket.IO connections without external third-party WS gateways (e.g., Pusher / Ably).

### Recommendation
**Option A (Render / Railway / Fly.io)** persistent Node process.

### Impact
Preserves existing Socket.IO real-time architecture without introducing third-party real-time vendor lock-in.

### Migration requirements
Add Dockerfile / Node production start script, setup health check endpoints (`/api/health`, `/api/ready`), and configure environment variables.

**User approval**: PENDING

---

## Decision 3: Database Hosting Infrastructure

### Current state
Mongoose connecting to local MongoDB (`mongodb://127.0.0.1:27017/taskdb-users`) with `mongodb-memory-server` fallback.

### Options
- **Option A**: MongoDB Atlas Managed Replica Set (M0 / Serverless / Shared Cluster).
- **Option B**: Self-hosted MongoDB instance on VPS.

### Advantages
- **Option A**: Fully managed automated backups, high availability, replica set oplog, TLS encryption, zero database administration overhead.
- **Option B**: Slightly lower direct compute cost.

### Disadvantages
- **Option A**: Requires network access IP whitelist configuration.
- **Option B**: High operational risk for backup failures, single point of failure, manual security patching.

### Recommendation
**Option A (MongoDB Atlas Managed Cluster)**.

### Impact
Ensures production data durability, automated daily backups, and reliable multi-document transactions.

### Migration requirements
Supply production `MONGO_URI` in environment configuration and disable `db.js` local in-memory fallback for production environments.

**User approval**: PENDING

---

## Decision 4: Queue & Scheduler Infrastructure

### Current state
No background queue or job scheduler exists. Node process uses no persistent queue.

### Options
- **Option A**: **Agenda + MongoDB** (MongoDB-backed job queue).
- **Option B**: **BullMQ + Redis** (Redis-backed job queue).

### Advantages
- **Option A**: Reuses existing MongoDB infrastructure without adding Redis service; simple deployment footprint, low cost, persistent across restarts.
- **Option B**: High throughput, sub-millisecond job processing speed.

### Disadvantages
- **Option A**: Higher MongoDB storage I/O under high job concurrency (>10k jobs/sec).
- **Option B**: Requires adding and managing a separate Redis service ($ and operational complexity).

### Recommendation
**Option A (Agenda + MongoDB)** for MVP scale. If concurrency exceeds 5,000 jobs/min in future phases, migrate to BullMQ + Redis.

### Impact
Enables reliable task due-date reminders, overdue push notifications, and scheduled streak calculations without adding new infrastructure services.

### Migration requirements
Install `agenda`, initialize connection with existing MongoDB connection, define background job processors.

**User approval**: PENDING

---

## Decision 5: Authentication & Session Strategy

### Current state
JWT stored in client `localStorage`, passed in `Authorization: Bearer <token>` header, 1-day expiration, no refresh token or session tracking.

### Options
- **Option A**: Secure `httpOnly` SameSite cookies for access token + server-side session versioning.
- **Option B**: Bearer JWT in memory + refresh token stored in `httpOnly` cookie with server-side session version invalidation.

### Advantages
- **Option A**: Immune to XSS token theft; automatic browser cookie transmission.
- **Option B**: Works seamlessly across cross-domain API setups while preventing XSS token persistence.

### Disadvantages
- **Option A**: Requires CSRF protection tokens for state-changing requests if cross-domain.
- **Option B**: Requires client refresh token rotation logic.

### Recommendation
**Option B (Short-lived JWT + httpOnly Refresh Cookie + Server-Side Session Versioning)**.

### Impact
Protects tokens against XSS, supports instant global logout across all devices, and keeps user sessions active securely.

### Migration requirements
Add `refreshToken` schema to `User` / `Session`, update auth controller, implement `/api/auth/refresh` and `/api/auth/logout-all`.

**User approval**: PENDING

---

## Decision 6: Codebase Language (JavaScript vs TypeScript)

### Current state
100% JavaScript (Node.js ES6 / CommonJS backend, React JSX frontend).

### Options
- **Option A**: Remain in JavaScript (ES6+ / Node CommonJS + React JSX) with strict JSDoc annotations and ESLint validation.
- **Option B**: Complete rewrite to TypeScript.

### Advantages
- **Option A**: Zero risk of introducing build errors or regressions during architectural refactoring; rapid incremental execution.
- **Option B**: Compile-time static type checking.

### Disadvantages
- **Option A**: Lack of strict compile-time interface enforcement.
- **Option B**: Massive, high-risk code rewrite violating Section 1.1 of the Master Prompt ("Do not blindly rewrite").

### Recommendation
**Option A (Remain JavaScript with strict JSDoc & validation schemas)** for MVP. Incremental TypeScript adoption deferred to Phase 2.

### Impact
Ensures existing working code is preserved while focusing engineering efforts on security, authorization, and data model integrity.

### Migration requirements
Maintain clean JS syntax, implement runtime schema validation (Zod / Joi).

**User approval**: PENDING

---

## Decision 7: Email Provider Integration

### Current state
No email service integration exists.

### Options
- **Option A**: Resend / SendGrid / Postmark transactional API.
- **Option B**: Nodemailer with standard SMTP server.

### Advantages
- **Option A**: High deliverability, SDK integration, template management, analytics, free tier available.
- **Option B**: Direct SMTP configuration.

### Disadvantages
- **Option A**: Requires API key configuration and domain DNS verification (DKIM/SPF).
- **Option B**: Lower deliverability, rate limiting issues.

### Recommendation
**Option A (Resend or SendGrid)** for transactional email delivery.

### Impact
Enables secure password reset tokens, email verification, and transactional notifications.

### Migration requirements
Until an email provider API key is provided by user:
- Implement password change for authenticated users.
- Defer production password reset delivery until email provider is configured.

**User approval**: PENDING

---

## Decision 8: Project Ownership & Hierarchy Model

### Current state
Flat `Category` model with ambiguous `ownerType` ('User' or 'Team') and `ownerId`.

### Options
- **Option A**: Direct User Ownership only.
- **Option B**: Direct Team Ownership only.
- **Option C**: **Hybrid Ownership Model** (Project belongs to a User OR a Team, with explicit role inheritance).

### Advantages
- **Option C**: Full flexibility—users can create personal private projects or collaborative team projects.

### Disadvantages
- **Option C**: Requires clear permission resolution rules on project operations.

### Recommendation
**Option C (Hybrid Ownership Model)**:
- Target Hierarchy: `Project` → `Milestone` → `Task` → `Subtask`.
- A `Project` is owned by either a `User` (personal) or a `Team` (collaborative).
- Team members inherit project access based on their Team Role (`Owner`, `Admin`, `Member`).

### Impact
Establishes clean collaborative boundaries without data duplication.

### Migration requirements
Migrate existing `Category` records to `Project` documents while adding matching `Tag` strings to maintain categorization.

**User approval**: PENDING

---

## Decision 9: Team & Project Permission Model

### Current state
Inconsistent checks. Any team member can invite users (adding them immediately) and perform administrative task/category actions.

### Options
- **Option A**: Role-Based Access Control (RBAC) with server-side enforcement (`OWNER`, `ADMIN`, `MEMBER`).
- **Option B**: Flat membership (all members have full access).

### Advantages
- **Option A**: Granular security, administrative control, prevents unauthorized member additions or deletions.
- **Option B**: Simple implementation.

### Disadvantages
- **Option A**: Requires explicit authorization middleware on every endpoint.

### Recommendation
**Option A (Strict Server-Side RBAC)**:
- **OWNER**: Manage team settings, delete team, transfer ownership, assign roles, manage all projects.
- **ADMIN**: Invite members (via pending invitation), create/delete team projects, manage project milestones & tasks.
- **MEMBER**: View team projects, create/edit assigned tasks, comment, send team messages.

### Impact
Eliminates IDOR vulnerabilities across teams, categories, projects, and tasks.

### Migration requirements
Implement `authorizeTeamRole` and `authorizeProjectAccess` middleware.

**User approval**: PENDING

---

## Decision 10: Gamification Reward Policy

### Current state
Ambiguous logic. `routes/tasks.js` awards points to `req.user.id` upon setting status to 'Done', regardless of task creator or assignee. Reopening and re-completing awards duplicate points.

### Options
- **Option A**: Points awarded to Task Creator.
- **Option B**: Points awarded to Task Assignee (Completer).
- **Option C**: **Assignee (Completer) with Idempotency Constraint** (Points awarded to the assigned user upon task completion, maximum 1 reward per task ID).

### Advantages
- **Option C**: Incentive aligned with real work completed; strict idempotency prevents point farming/exploits.

### Disadvantages
- **Option C**: Requires tracking `rewardGranted: boolean` and recording an immutable `RewardEvent`.

### Recommendation
**Option C (Assignee Completer with Strict Idempotency)**:
- Base Completion: +10 points to `assignedTo` user (or creator if unassigned).
- On-Time Completion Bonus: +5 points if completed on or before `dueDate`.
- Streak Bonus: +2 × streak days.
- Reopening a task does NOT deduct points, but re-completing a previously rewarded task grants 0 additional points (`rewardGranted = true`).

### Impact
Protects gamification integrity and eliminates duplicate point exploits.

### Migration requirements
Add `rewardGranted` flag to `Task` schema, create `RewardEvent` model with unique index `(taskId, reason)`.

**User approval**: PENDING

---

## Decision 11: Session Invalidation & Logout-All-Devices Strategy

### Current state
Client simply deletes `localStorage.token`. Server has no awareness of issued tokens or logout state.

### Options
- **Option A**: Maintain server-side `sessionVersion` counter on `User` schema.
- **Option B**: Redis JWT Blacklist.

### Advantages
- **Option A**: Extremely lightweight, no Redis dependency required, instant invalidation across all tokens when `sessionVersion` increments.
- **Option B**: Allows granular single-token revocation.

### Disadvantages
- **Option A**: Revokes all active devices simultaneously when incremented (which matches the required "logout all devices" feature perfectly).

### Recommendation
**Option A (`sessionVersion` on User document)**:
- JWT payload contains `{ id, username, sessionVersion }`.
- Auth middleware checks `user.sessionVersion === decoded.sessionVersion`.
- "Logout All Devices" increments `user.sessionVersion`, immediately invalidating all active JWTs.

### Impact
Fulfills security requirement 25 ("Logout all devices") with zero external infrastructure overhead.

### Migration requirements
Add `sessionVersion: { type: Number, default: 1 }` to `User` schema and check in `auth.js` middleware.

**User approval**: PENDING

---

## Decision 12: Message Search Scope

### Current state
No message search capability exists.

### Options
- **Option A**: Defer Message Search to **Phase 2**.
- **Option B**: Include Message Search in MVP.

### Advantages
- **Option A**: Keeps MVP focused on core chat reliability, cursor pagination, real-time Socket.IO authorization, and notification delivery.
- **Option B**: Allows searching past chat messages.

### Disadvantages
- **Option B**: Requires regex/text index optimization during core chat refactoring.

### Recommendation
**Option A (Defer Message Search to Phase 2)** as specified in Section 6.15 of the Master Prompt.

### Impact
Reduces MVP scope creep while ensuring chat data model supports text index querying in Phase 2.

### Migration requirements
None for MVP.

**User approval**: PENDING
