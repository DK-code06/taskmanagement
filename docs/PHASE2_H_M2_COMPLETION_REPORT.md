# Phase 2-H Milestone 2 Completion Report: GitHub Repository Linking & Project Authorization

## Executive Summary

Phase 2-H Milestone 2 (**GitHub Repository Linking & Project Authorization**) has been successfully implemented and verified in accordance with `docs/PHASE2_H_AUDIT.md`, `docs/PHASE2_H_DECISION_RECORD.md`, and `docs/PHASE2_H_IMPLEMENTATION_PLAN.md`.

This milestone establishes secure server-side repository discovery, server-side repository access verification, project-level repository mapping, and server-side IDOR protection without exposing access tokens to the frontend or modifying core task-management logic.

---

## Authoritative Baseline

- **Baseline Tag**: `phase2-h-m1-stable`
- **Baseline Commit**: `6af82d3aba1e5aac7854925e770fd0c1c14a8d03`
- **Milestone 2 Commit**: `feat(phase2-h): implement github repository linking`
- **Milestone 2 Tag**: `phase2-h-m2-stable`

---

## Architectural Principles & Data Boundaries

1. **Source of Truth Framing**:
   - **Task App**: Authoritative for Task `status`, `assignedTo`, `priority`, `dueDate`, `rewards`, and Project state.
   - **GitHub**: Authoritative for Git commits, Pull Requests, repository metadata, and branch state.
   - **Rule**: GitHub Issues MUST NOT automatically become Tasks.

2. **Server-Side Token Boundary**:
   - Decryption of stored GitHub access tokens occurs exclusively inside `services/githubService.js`.
   - Access tokens are never returned to route handlers or sent to the frontend.

3. **Server-Side Authorization & IDOR Framing**:
   - Every repository link/unlink action enforces dual verification:
     1. **Task App Project Authorization**: Re-evaluates `authorizeProject('ADMIN')` (or `MEMBER` for listing) server-side.
     2. **GitHub API Authorization**: Calls GitHub API `GET /repos/:owner/:name` server-side using the user's decrypted OAuth access token.
   - Frontend claims of repository ownership or IDs are strictly un-trusted.

---

## Components Implemented & Modified

### 1. MongoDB Model: `GitHubRepositoryLink`
- **File**: `task-backendd/models/GitHubRepositoryLink.js`
- **Schema**:
  - `projectId`: ObjectId reference to `Project` (required, indexed).
  - `githubRepoId`: String repository ID from GitHub API (required, indexed).
  - `owner`: Repository owner login string.
  - `name`: Repository name string.
  - `fullName`: Full repository handle string (`owner/name`).
  - `private`: Boolean visibility flag.
  - `defaultBranch`: Default Git branch string (default: `'main'`).
  - `autoCloseOnPRMerge`: Boolean flag for future PR merge behavior (default: `true`).
  - `linkedBy`: ObjectId reference to `User` who created the link.
  - `linkedAt`: Link creation timestamp.
- **Index Constraint**: Compound unique index on `{ projectId: 1, githubRepoId: 1 }` ensuring a repository cannot be linked twice to the same project.

### 2. Centralized GitHub API Service
- **File**: `task-backendd/services/githubService.js`
- **Functions**:
  - `getUserRepositories(encryptedAccessToken, options)`: Fetches user's accessible repositories with pagination, returning normalized minimum metadata (`githubRepoId`, `owner`, `name`, `fullName`, `private`, `defaultBranch`, `htmlUrl`, `description`).
  - `verifyAndFetchRepository(encryptedAccessToken, owner, name)`: Validates server-side that the authenticated GitHub user has access to `owner/name` via GitHub API `GET /repos/:owner/:name`. Returns canonical repo metadata or throws status-specific errors (`404/403`).

### 3. API Endpoints
- **File**: `task-backendd/routes/github.js` & `task-backendd/server.js`
- **Endpoints**:
  - `GET /api/github/repositories`: Discovers accessible GitHub repositories for the authenticated user (requires connected GitHub account).
  - `GET /api/projects/:projectId/github/repositories`: Lists linked repositories for a project (requires Project `MEMBER` role).
  - `POST /api/projects/:projectId/github/repositories`: Links a verified GitHub repository to a project (requires Project `ADMIN` role & server-side GitHub access check).
  - `DELETE /api/projects/:projectId/github/repositories/:repositoryId`: Unlinks a repository from a project (requires Project `ADMIN` role). Unlinking only removes the link record without deleting the Project, Tasks, Milestones, or GitHub connection.

### 4. Security Audit Logging
- **Files**: `task-backendd/models/AuditLog.js` & `task-backendd/routes/github.js`
- Added audit actions:
  - `GITHUB_REPO_LINKED`
  - `GITHUB_REPO_UNLINKED`
  - `GITHUB_REPO_LINK_FAILED`

### 5. Frontend UI Component & Vitest Tests
- **Files**: `task-frontend/src/components/github/RepoLinkModal.jsx` & `task-frontend/src/components/github/__tests__/repoLink.test.jsx`
- WCAG 2.2 AA compliant modal with ARIA accessibility roles (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`).
- Features repository discovery search/filter, selection, link action, unlink action, loading states, empty states, and un-connected state guidance.

---

## Verification & Release Gate Results

### Backend Test Suite Execution
- **Test Suites**: 28 / 28 passed (100%)
- **Total Tests Passed**: 198 / 198 passed (100%)
- **New Milestone 2 Test Suite**:
  - `tests/githubRepo.test.js`: 17 / 17 passed

### Frontend Test Suite Execution
- **Test Suites**: 12 / 12 passed (100%)
- **Total Tests Passed**: 60 / 60 passed (100%)
- **New Milestone 2 Test Suite**:
  - `src/components/github/__tests__/repoLink.test.jsx`: 4 / 4 passed

### Production Build
- **Vite Production Build**: PASSED with 0 warnings/errors (205 modules transformed).

---

## Security Audit & Checklist

- [x] **IDOR Protection**: Verified server-side via `authorizeProject('ADMIN')` and GitHub API repo access checks.
- [x] **Token Leakage**: Decryption occurs inside `githubService.js`. Plaintext token never output in logs or API responses.
- [x] **Un-Trusted Frontend Claims**: Server independently re-verifies repository ownership and permissions via GitHub REST API before creating link.
- [x] **Duplicate Protection**: Compound unique index on `{ projectId: 1, githubRepoId: 1 }` prevents duplicate links.
- [x] **Safe Unlink Behavior**: Deleting a repository link leaves Project, Tasks, Milestones, and GitHub connection completely intact.

---

## Next Milestone

- **Milestone 3**: Webhook Verification, Replay Protection & One-Way Sync (`pull_request.closed`).
