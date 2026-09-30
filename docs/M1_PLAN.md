# Milestone 1 (M1) Implementation Plan: Safe Foundation

**Date**: September 29, 2026  
**Goal**: Resolve all critical security vulnerabilities, IDOR flaws, socket authentication gaps, gamification math bugs, and stray files in the existing codebase without rewriting working features or causing data loss.

---

## 1. Components & File Changes

### 1.1 Security & Authorization Layer - [NEW]
- **`middleware/authorize.js`**: Create reusable resource authorization middleware to enforce ownership and team membership checks across tasks, categories, teams, and comments.
- **`middleware/rateLimiter.js`**: Implement rate limiters (strict for login/register, moderate for general APIs).
- **`middleware/validate.js`**: Implement Zod/express-validator schema validation for all HTTP request bodies, params, and queries.
- **`middleware/mongoSanitize.js`**: Prevent NoSQL injection attacks by sanitizing user input keys containing `$` or `.`.

### 1.2 Security Hardening & Headers
- **`server.js`**:
  - Integrate `helmet()` for secure HTTP headers.
  - Replace wildcard CORS with configurable origin (`process.env.CLIENT_ORIGIN` / `VITE_API_URL`).
  - Set request payload body limits (`100kb`).
  - Strict production DB fallback (fail fast on DB connection error when `NODE_ENV === 'production'`).

### 1.3 Authentication & Session Hardening
- **`middleware/auth.js`**:
  - Add `sessionVersion` validation against User document.
  - Handle token expiration cleanly with user-facing HTTP 401 error codes.
- **`routes/authRoutes.js`**:
  - Add `/change-password` endpoint.
  - Add `/logout-all` endpoint (increments `user.sessionVersion`).

### 1.4 Socket.IO Security & Real-Time Scoping
- **`server.js` & `context/SocketContext.jsx`**:
  - Move authentication to Socket.IO connection handshake (`io.use(socketAuthMiddleware)` using JWT).
  - Bind authenticated `userId` directly to socket object (`socket.userId`).
  - Replace `userSockets` single-value object with Socket.IO rooms (`socket.join(`user:${socket.userId}`)`).
  - Validate room membership prior to room join (`socket.on('joinRoom')`).
  - Replace global broadcasts (`io.emit("tasksUpdated")`) with targeted room events (`io.to(`user:${userId}`).emit(...)`).

### 1.5 Gamification & Streak Math Correction
- **`routes/tasks.js`**:
  - Credit task completion points to `assignedTo` user (or creator if unassigned), not `req.user.id`.
  - Prevent duplicate points on task reopen/re-complete (`rewardGranted` flag & `RewardEvent` idempotency check).
  - Fix `areConsecutiveDays` streak calculation: same-day completions keep current streak intact without resetting to 1.

### 1.6 Friend System Edge-Case Fixes
- **`routes/friends.js`**:
  - Fix missing-recipient crash: return HTTP 404 if `recipient` user is null.
  - Prevent self-friend requests (`senderId === recipientId`).
  - Require `status: 'pending'` when accepting friend requests.
  - Prevent duplicate requests in either direction.
  - Escape special regex characters in `/search` endpoint to prevent ReDoS / syntax errors.

### 1.7 API Endpoint Corrections
- **`routes/analytics.js`**:
  - Add `GET /team/:teamId` endpoint returning team completion stats and per-member breakdown (resolving Bug 10).

### 1.8 Environment & Cleanup
- **Environment URLs**:
  - Update frontend components (`Dashboard.jsx`, `Register.jsx`, `Login.jsx`, `SocketContext.jsx`, `CategoryView.jsx`, `Teams.jsx`, `Friends.jsx`, `ChatWindow.jsx`, `TeamAnalytics.jsx`) to use `import.meta.env.VITE_API_URL` and `import.meta.env.VITE_SOCKET_URL`.
- **Stray File & Dead Code Removal**:
  - Safely remove verified dead files: `src/App.jsx`, `updateListDate.js`, `src/pages/require('dotenv').config();`, `src/pages/userdatatask.txt`.

### 1.9 Audit Logging System - [NEW]
- **`models/AuditLog.js`**: Create append-only AuditLog model.
- **Audit Events**: Record `LOGIN_SUCCESS`, `LOGIN_FAILED`, `PASSWORD_CHANGED`, `LOGOUT_ALL`, `PERMISSION_DENIED`.

---

## 2. Verification Plan & Automated Tests

### 2.1 Automated Backend Test Suite
Implement backend test runner (Jest / Supertest) covering:
1. **IDOR Test Matrix**: Verify `GET`, `POST`, `PUT`, `DELETE` operations block unauthorized users across tasks, categories, teams, and comments.
2. **JWT Tampering**: Verify altered JWT payloads and expired tokens return HTTP 401.
3. **Session Invalidation**: Verify `sessionVersion` increment invalidates all issued JWTs.
4. **Socket Authentication**: Verify unauthenticated socket connections are rejected at handshake.
5. **Socket Spoofing**: Verify client cannot emit messages with forged `fromUser` or join unauthorized rooms.
6. **Reward Idempotency**: Verify rapid concurrent completion calls result in exactly 1 point award.
7. **Streak Calculation**: Verify multiple task completions on the same day preserve streak counter.
8. **Friend Edge Cases**: Verify non-existent user IDs return 404, self-requests return 400, and unescaped regex search does not crash server.

### 2.2 Release Gate
M1 release gate requires 100% pass on all automated tests, clean frontend build without console errors, and zero unresolved critical/high security issues.
