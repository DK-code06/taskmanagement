# Phase 2-H Decision Record: GitHub Integration Architecture

## Architectural Decision Records (ADRs)

### ADR 1: Modular Monolith Service Architecture
- **Status**: `APPROVED`
- **Context**: GitHub Integration must be added without breaking the existing modular monolith pattern or introducing microservice complexity.
- **Decision**: Implement GitHub features as server-side service and route modules (`services/githubService.js`, `services/encryptionService.js`, `routes/github.js`) within the existing Express application.

### ADR 2: AES-256-GCM Token Encryption at Rest
- **Status**: `APPROVED`
- **Context**: GitHub access tokens provide powerful repository privileges and must be securely protected against database leaks or log dumps.
- **Decision**: Encrypt all stored GitHub access tokens using AES-256-GCM authenticated encryption (`crypto.createCipheriv('aes-256-gcm', ...)`). Store ciphertext as `iv:authTag:encryptedData`. Never expose plaintext tokens in logs, models, or API responses.

### ADR 3: HMAC-SHA256 Signed State Token for OAuth CSRF Guard
- **Status**: `APPROVED`
- **Context**: Prevent OAuth state injection and CSRF attacks during account authorization.
- **Decision**: The `state` parameter generated during `GET /api/github/connect` must be an HMAC-SHA256 signed token containing `userId`, timestamp, and a random 32-byte nonce, validated on callback.

### ADR 4: Rejection of Automatic Issue-to-Task Synchronization
- **Status**: `APPROVED`
- **Context**: Automatically creating a Task for every GitHub Issue pollutes project backlogs with external bug reports and labels.
- **Decision**: Automatic Issue -> Task creation is **REJECTED**. Task creation from GitHub Issues must be an explicit, user-initiated action ("Import Issue as Task").

### ADR 5: One-Way Webhook-Driven Sync Strategy (GitHub -> Task App)
- **Status**: `APPROVED`
- **Context**: Synchronizing Task state with GitHub pull requests and commits without risking infinite sync loops or state conflicts.
- **Decision**: Implement One-Way Sync driven by GitHub webhooks for MVP. Webhook events (`pull_request.closed`) notify the Task App to update Task status (`autoCloseOnPRMerge`). Two-way sync is deferred.

### ADR 6: Webhook Signature & Replay Protection
- **Status**: `APPROVED`
- **Context**: Prevent forged webhook requests or malicious replay attacks on `/api/github/webhooks`.
- **Decision**: Enforce HMAC SHA-256 signature verification (`x-hub-signature-256`) against raw request body using `GITHUB_WEBHOOK_SECRET`. Enforce idempotency by storing `x-github-delivery` GUIDs in `GitHubWebhookLog` with a 7-day TTL index.

### ADR 7: Repository Authorization & IDOR Protection
- **Status**: `APPROVED`
- **Context**: Prevent users from linking repositories they do not own or accessing projects they cannot manage.
- **Decision**: Re-evaluate server-side authorization on every GitHub API call: verify project access via `canAccessProject(userId, projectId)` (admin role required) AND verify user's GitHub repository permissions via GitHub API (`GET /repos/:owner/:repo`). Never trust frontend-supplied identifiers.

### ADR 8: Rate Limiting & Circuit Breaker Policy
- **Status**: `APPROVED`
- **Context**: GitHub API rate limits (5,000 req/hr) must be managed gracefully without crashing background sync.
- **Decision**: Inspect `x-ratelimit-remaining` and `retry-after` headers. Implement exponential backoff for transient errors, and activate a circuit breaker to pause automated background sync if remaining limit falls below 50 requests.

### ADR 9: Database Model & Indexing Architecture
- **Status**: `APPROVED`
- **Context**: Define structured schemas for GitHub connections, repo links, sync mappings, and webhook logs.
- **Decision**: Create `GitHubConnection` (`{ userId: 1 }` unique), `GitHubRepositoryLink` (`{ projectId: 1, githubRepoId: 1 }` unique), `GitHubSyncMapping` (`{ taskId: 1 }`), and `GitHubWebhookLog` (`{ deliveryId: 1 }` unique + 7-day TTL index).

### ADR 10: Exclusion of Heavy AI & CI/CD Tooling
- **Status**: `APPROVED`
- **Context**: Prevent scope creep into unrelated developer tools.
- **Decision**: Exclude GitHub Actions, Copilot, CI/CD automation, code scanning, and AI code analysis from Phase 2-H (categorized as P3 out of scope).
