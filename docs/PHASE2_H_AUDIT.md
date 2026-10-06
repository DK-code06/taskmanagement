# Phase 2-H Architecture & Security Audit: GitHub Integration

## 1. Executive Summary & Baseline Verification

### Verified Production Checkpoint
- **Authoritative Baseline Tag**: `phase2-g-stable`
- **Authoritative Baseline Commit**: `78faef2377d76a3acf1c04b2b0ec393047e713f7`
- **Git Working Tree**: Clean
- **Test Baseline**:
  - Backend: 25 / 25 test suites passed (155 / 155 tests)
  - Frontend: 11 / 11 test suites passed (56 / 56 tests)
  - Production Build: PASSED (0 build warnings/errors)

---

## 2. GitHub OAuth & Authentication Architecture Audit

### OAuth Flow Architecture
- **Protocol**: Standard OAuth 2.0 Authorization Code Grant (`https://github.com/login/oauth/authorize`).
- **CSRF State Guard**: State parameter must be a cryptographically signed HMAC-SHA256 token containing `userId`, timestamp, and a random 32-byte nonce (`crypto.randomBytes(32)`).
- **Callback Validation**: Callback endpoint `/api/github/callback` validates state token signature and 10-minute expiration window before exchanging authorization code for access token via `POST https://github.com/login/oauth/access_token`.
- **Account Linking & Deduplication**: Maps authenticated `userId` to `githubUserId` and `githubUsername`. Enforces a unique partial index on `{ githubUserId: 1 }` so a single GitHub account cannot be linked to multiple Task Management accounts simultaneously.
- **Token Verification**: Token validity verified on connection via `GET https://api.github.com/user`.

---

## 3. GitHub Token Security & Encryption Strategy

> [!CRITICAL]
> **Encryption at Rest Policy**
> Plaintext GitHub access tokens MUST NEVER be stored in MongoDB, written to log files, output in API responses, or exposed to the frontend.

### AES-256-GCM Encryption Architecture
- **Algorithm**: AES-256-GCM (Galois/Counter Mode) via Node.js native `crypto` module.
- **Storage Format**: `iv:authTag:encryptedData` (hex/base64 string).
- **Key Management**: Encryption key supplied via `process.env.GITHUB_TOKEN_ENCRYPTION_KEY` (32-byte / 256-bit secret).
- **Decryption Scope**: Decryption occurs exclusively in server-side `services/githubService.js` immediately before making authenticated GitHub API calls.
- **Disconnection & Revocation**: `POST /api/github/disconnect` revokes the token at GitHub (`DELETE https://api.github.com/applications/:client_id/grant`) and hard deletes the `GitHubConnection` record.

---

## 4. Repository Authorization & Server-Side IDOR Security

- **Server-Side Authorization Framing**: Every GitHub operation verifies:
  1. User's project membership/role via `canAccessProject(userId, projectId)`. Requires `ADMIN` / `OWNER` role to link or unlink repositories.
  2. User's GitHub repository access via server-side GitHub API call `GET https://api.github.com/repos/:owner/:repo`.
- **Client Un-Trust**: Frontend-supplied repository identifiers (`owner`, `repo`, `githubRepoId`) are NEVER trusted as authorization boundaries. All actions re-evaluate server-side session ownership and project permissions.

---

## 5. GitHub API Rate Limiting & Resilience Architecture

- **Primary Rate Limit Handling**: GitHub OAuth user tokens provide 5,000 requests per hour. Server inspects response headers:
  - `x-ratelimit-remaining`
  - `x-ratelimit-reset`
  - `retry-after`
- **Secondary Rate Limit & Backoff**: Exponential backoff with random jitter (max 3 retries) for transient `502/503/504` responses or secondary burst limits.
- **Circuit Breaker**: If remaining rate limit falls below 50 requests, automated background polling/sync is paused until reset time.

---

## 6. Webhook Architecture & Security

- **Raw Body Signature Verification**: Express `express.raw({ type: 'application/json' })` middleware on `/api/github/webhooks` calculates HMAC SHA-256 using `GITHUB_WEBHOOK_SECRET` and compares with `x-hub-signature-256` header via `crypto.timingSafeEqual`.
- **Replay Protection & Idempotency**: `x-github-delivery` GUID stored in `GitHubWebhookLog` collection with a 7-day TTL index. Duplicate delivery GUIDs are acknowledged immediately with `HTTP 200 OK` without re-processing.
- **Rate Limiting**: Dedicated rate limiter on `/api/github/webhooks` (max 100 requests per minute per IP).

---

## 7. Synchronization Architecture & Source of Truth

> [!IMPORTANT]
> **Source of Truth Rule**
> Task Management System remains authoritative for Task `status`, `assignedTo`, `priority`, `dueDate`, and reward points. GitHub remains authoritative for Git commits, PR merge states, and raw repo metadata.

### Issue vs Task Mapping Evaluation
- **No Automatic Issue -> Task Creation**: Automatically creating Tasks for every GitHub Issue is **REJECTED** to prevent backlog pollution. Importing an Issue as a Task must be an explicit, user-initiated action ("Import Issue as Task").
- **One-Way Sync (GitHub -> Task App)**: Webhook events (`pull_request.closed`, `push`) parse reference tags (e.g. `[TASK-123]` or `fixes #45`) and update Task status to `Done` if project setting `autoCloseOnPRMerge` is enabled.

---

## 8. Proposed Database Schema Design

### 1. `GitHubConnection` (`models/GitHubConnection.js`)
```javascript
{
  userId: { type: ObjectId, ref: 'User', required: true, unique: true },
  githubUserId: { type: String, required: true, unique: true },
  githubUsername: { type: String, required: true },
  encryptedAccessToken: { type: String, required: true }, // AES-256-GCM (iv:authTag:cipher)
  scope: { type: String, default: 'repo' },
  connectedAt: { type: Date, default: Date.now }
}
```

### 2. `GitHubRepositoryLink` (`models/GitHubRepositoryLink.js`)
```javascript
{
  projectId: { type: ObjectId, ref: 'Project', required: true, index: true },
  githubRepoId: { type: String, required: true },
  owner: { type: String, required: true },
  name: { type: String, required: true },
  fullName: { type: String, required: true },
  isPrivate: { type: Boolean, default: false },
  autoCloseOnPRMerge: { type: Boolean, default: true },
  linkedBy: { type: ObjectId, ref: 'User', required: true }
}
// Compound unique index: { projectId: 1, githubRepoId: 1 }
```

### 3. `GitHubSyncMapping` (`models/GitHubSyncMapping.js`)
```javascript
{
  taskId: { type: ObjectId, ref: 'Task', required: true, index: true },
  projectId: { type: ObjectId, ref: 'Project', required: true, index: true },
  githubRepoId: { type: String, required: true },
  entityType: { type: String, enum: ['PR', 'COMMIT', 'ISSUE'], required: true },
  referenceId: { type: String, required: true }, // PR number or Commit SHA
  title: { type: String, default: '' },
  url: { type: String, required: true },
  status: { type: String, default: 'OPEN' }
}
```

### 4. `GitHubWebhookLog` (`models/GitHubWebhookLog.js`)
```javascript
{
  deliveryId: { type: String, required: true, unique: true },
  eventType: { type: String, required: true },
  repositoryFullName: { type: String, default: '' },
  processedStatus: { type: String, enum: ['SUCCESS', 'IGNORED', 'FAILED'], default: 'SUCCESS' },
  createdAt: { type: Date, default: Date.now, expires: '7d' } // TTL index
}
```

---

## 9. Comprehensive Threat Model & Mitigations

| Realistic Threat | Impact | Server-Side Mitigation Strategy |
|---|---|---|
| **OAuth State Injection / CSRF** | Account linking hijack | HMAC-SHA256 signed `state` token with timestamp, nonce & cookie validation |
| **Plaintext Token Leakage** | Complete GitHub account compromise | AES-256-GCM encryption at rest; token excluded from logs, API responses & models |
| **Forged Webhook Payloads** | Malicious status updates | HMAC SHA-256 signature verification (`x-hub-signature-256`) on raw request body |
| **Webhook Replay Attack** | Duplicate event processing | `x-github-delivery` GUID tracking in `GitHubWebhookLog` with 7-day TTL index |
| **Repository IDOR Escalation** | Access to private org repos | Server-side `canAccessProject` check AND GitHub API user permissions check |
| **GitHub API Rate-Limit Abuse** | System denial of service | Inspect `x-ratelimit-remaining`, exponential backoff, circuit breaker pause |

---

## 10. Answers to 12 Explicit Decision Questions

1. **Architecturally Compatible?**: **YES**. Integrates seamlessly as a modular monolith service package (`services/githubService.js`, `services/encryptionService.js`, `routes/github.js`).
2. **Recommended OAuth Architecture?**: OAuth 2.0 Authorization Code Grant with HMAC-SHA256 signed `state` CSRF protection.
3. **Token Encryption Strategy?**: AES-256-GCM authenticated encryption stored as `iv:authTag:cipher`. Zero plaintext exposure.
4. **Source of Truth?**: Task App for Task state, assignments, due dates & rewards; GitHub for Git commits, PR merge states & repo data.
5. **Should GitHub Issues map to Tasks?**: **NO**. Automatic 1:1 mapping is rejected to prevent backlog pollution. Import must be an explicit user action.
6. **One-Way vs Two-Way Sync?**: **One-Way Sync (GitHub -> Task App)** for MVP via webhooks. Two-way sync is deferred to prevent infinite sync loops.
7. **Webhook Architecture?**: `express.raw()` raw body middleware, HMAC SHA-256 signature validation, `x-github-delivery` idempotency TTL store.
8. **Required Models & Indexes?**: `GitHubConnection`, `GitHubRepositoryLink`, `GitHubSyncMapping`, `GitHubWebhookLog`. Compound unique indexes on `{ userId: 1 }`, `{ projectId: 1, githubRepoId: 1 }`, and `{ deliveryId: 1 }`.
9. **Mandatory Security Controls Before Implementation?**: AES-256-GCM token encryption, HMAC SHA-256 OAuth CSRF state verification, Webhook signature verification & replay protection, server-side IDOR checks (`canAccessProject` + GitHub API check).
10. **What Should Be Deferred?**: Two-way sync, automatic issue creation, GitHub Actions, Copilot, CI/CD triggers, code scanning, AI code analysis (P2/P3).
11. **Any Blockers?**: None. Production readiness requires registering a GitHub OAuth App and configuring production environment variables (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_TOKEN_ENCRYPTION_KEY`).
12. **Implementation Milestones to Follow**:
    - Phase 2-H-1: Encryption service, OAuth authentication, connection management, token security tests.
    - Phase 2-H-2: Repository linking, project authorization, IDOR protection, backend repo API tests.
    - Phase 2-H-3: Webhook endpoint, HMAC SHA-256 signature verification, replay protection TTL log, PR merge handler.
    - Phase 2-H-4: Frontend integration (`GitHubConnectBanner.jsx`, `RepoLinkModal.jsx`, `TaskGitHubWidget.jsx`), Vitest UI tests, release gate verification & `phase2-h-stable` tag.

---

## 11. Scope Categorization (P0 / P1 / P2 / P3)

- **P0 (Blockers / Security Foundation)**: HMAC-SHA256 OAuth state CSRF guard, AES-256-GCM token encryption, Webhook HMAC SHA-256 signature verification, `x-github-delivery` TTL idempotency log, `canAccessProject` IDOR checks.
- **P1 (Phase 2-H MVP Scope)**: OAuth connection endpoints, repository linking to Projects, webhook PR merge handler (`autoCloseOnPRMerge`), Task GitHub reference widget UI.
- **P2 (Future Enhancements)**: Manual "Import GitHub Issue as Task" tool, commit reference parser (`fixes #123`).
- **P3 (Out of Scope)**: GitHub Actions, Copilot, CI/CD automation, AI code analysis, external search engines.
