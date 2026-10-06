# Phase 2-H Implementation Plan: GitHub Integration

## Overview
This implementation plan outlines the future technical milestones for Phase 2-H (GitHub Integration) upon authorization. No application code is modified during this audit phase.

---

## Technical Milestones Breakdown

### Milestone 1: Token Security & OAuth Connection Infrastructure
- **Files**: `services/encryptionService.js` [NEW], `models/GitHubConnection.js` [NEW], `services/githubAuthService.js` [NEW], `routes/github.js` [NEW].
- **Tasks**:
  - Implement AES-256-GCM encryption and decryption helpers (`crypto.createCipheriv`).
  - Implement OAuth state generator with HMAC-SHA256 signature and 10-minute expiration.
  - Implement `GET /api/github/connect` and `GET /api/github/callback`.
  - Implement `GET /api/github/status` and `POST /api/github/disconnect` (with token revocation).
  - Add backend tests for token encryption/decryption and OAuth state validation.

### Milestone 2: Repository Linking & IDOR Protection
- **Files**: `models/GitHubRepositoryLink.js` [NEW], `services/githubRepoService.js` [NEW], `routes/github.js` [MODIFY].
- **Tasks**:
  - Implement `GET /api/github/repositories` (fetches user's accessible repos from GitHub API).
  - Implement `POST /api/projects/:id/github/link` (requires `authorizeProject('ADMIN')` and verifies GitHub repo ownership).
  - Implement `DELETE /api/projects/:id/github/unlink`.
  - Add backend tests for project IDOR protection and repo linking authorization.

### Milestone 3: Webhook Verification, Replay Protection & One-Way Sync
- **Files**: `models/GitHubWebhookLog.js` [NEW], `models/GitHubSyncMapping.js` [NEW], `routes/githubWebhooks.js` [NEW].
- **Tasks**:
  - Configure `express.raw()` raw body parser on `/api/github/webhooks`.
  - Implement HMAC SHA-256 signature verification (`x-hub-signature-256`).
  - Implement `x-github-delivery` GUID idempotency log with 7-day TTL index.
  - Implement PR merge handler (`pull_request.closed`) to parse task tags and auto-complete Tasks (`autoCloseOnPRMerge`).
  - Add backend tests for signature verification, replay protection, and PR merge sync.

### Milestone 4: Frontend UI Components & Release Gate
- **Files**: `src/components/github/GitHubConnectBanner.jsx` [NEW], `src/components/github/RepoLinkModal.jsx` [NEW], `src/components/github/TaskGitHubWidget.jsx` [NEW], `src/components/project/ProjectOverview.jsx` [MODIFY].
- **Tasks**:
  - Build UI for GitHub connection status in User Settings.
  - Build repository selection modal in Project Settings.
  - Build linked PRs/commits widget on Task Details view.
  - Add Vitest frontend tests.
  - Execute full release gate verification (`npm test`, `vitest run`, `npm run build`).
  - Tag `phase2-h-stable`.

---

## Verification & Release Gate Checklist

1. **Backend Tests**: 25 existing suites + 4 new GitHub suites (`100% PASS`).
2. **Frontend Tests**: 11 existing suites + 1 new GitHub UI suite (`100% PASS`).
3. **Production Build**: Vite production build (`0 errors`).
4. **Git Discipline**: Clean working tree and tag `phase2-h-stable`.
