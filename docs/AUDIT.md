# System Audit Report

**Date**: September 29, 2026  
**Repository**: `https://github.com/DK-code06/taskmanagement.git`  
**Auditor**: Principal Technical Architect & Engineering Lead  
**Scope**: Read-Only Architecture, Security, Data Model, API, Real-Time, Frontend, and Quality Audit

---

## 1. Executive Summary

This audit evaluates the codebase to establish a baseline for transforming it into a production-grade, secure, real-time collaborative productivity platform. The application is built using a React (Vite) frontend and a Node.js (Express + Socket.IO + Mongoose) backend.

While core flows (authentication, task CRUD, category grouping, team creation, and basic friend socket chat) function prototypically, the audit revealed **critical security vulnerabilities**, **data integrity flaws**, **unhandled edge cases**, **architectural defects in real-time socket events**, and **absent test coverage**.

All 43 items in the Bug Register from the Master Implementation Prompt have been audited against the actual repository code.

---

## 2. Existing Repository Bug Register

| ID | Issue Description | Audit Finding & Evidence | Status |
|---|---|---|---|
| **1** | `.env` and `node_modules` tracked in Git | Tracked in initial commits (`82cb1bc`, `a5debf1`). Cleaned & untracked in Phase 0. | **CONFIRMED** (Cleaned) |
| **2** | JWT secret exposed in Git history | Commit `82cb1bc` contained `JWT_SECRET=0608` in `task-backendd/.env`. Rotated in Phase 0. | **CONFIRMED** (Rotated) |
| **3** | Hard-coded `localhost` URLs | Found in `Dashboard.jsx`, `Register.jsx`, `Login.jsx`, `App.jsx`, `SocketContext.jsx`, `CategoryView.jsx`, `Teams.jsx`, `Friends.jsx`, `ChatWindow.jsx`, `TeamAnalytics.jsx`. | **CONFIRMED** |
| **4** | `PrivateRoute` relying only on token presence | `main.jsx` lines 14–17 checks `localStorage.getItem("token")` without decoding or verifying expiration/validity. | **CONFIRMED** |
| **5** | Wildcard CORS configuration | `server.js` line 27 uses `cors: { origin: "*" }` for Socket.IO and line 33 uses `app.use(cors())` for Express without origin restriction. | **CONFIRMED** |
| **6** | Task schema drops `startedAt` | `models/Task.js` has no `startedAt` property in schema definition. | **CONFIRMED** |
| **7** | Task schema drops `estimatedCompletionTime` | `models/Task.js` has no `estimatedCompletionTime` property in schema definition. | **CONFIRMED** |
| **8** | Existing task timing data fails to persist | `routes/tasks.js` lines 150 & 152 assign `updateFields.startedAt` and `updateFields.estimatedCompletionTime`, but Mongoose strips them on `.save()`. | **CONFIRMED** |
| **9** | Category/Team relationships contain inconsistent references | `models/Category.js` references `Team` via `ownerId`. Deleting a `Team` leaves orphaned `Category` documents that crash on subsequent operations. | **CONFIRMED** |
| **10** | Frontend calls `GET /api/analytics/team/:id` without backend endpoint | `TeamAnalytics.jsx` line 16 issues GET request to `/analytics/team/${teamId}`, but `routes/analytics.js` only implements `GET /`. | **CONFIRMED** |
| **11** | Missing ownership/membership checks on tasks | `routes/tasks.js` (`PUT /:id`, `DELETE /:id`) fetches task using `Task.findOne({ _id: req.params.id })` without verifying `user` ID or team membership. | **CONFIRMED** |
| **12** | Missing authorization on comments | `routes/tasks.js` line 80 allows any authenticated user to append comments to any task ID without checking task access rights. | **CONFIRMED** |
| **13** | Missing authorization on category operations | `routes/categories.js` does not restrict team category permissions properly across reorder/view routes. | **CONFIRMED** |
| **14** | IDOR vulnerability across multiple endpoints | Resources (`Task`, `Category`, `Team`, `Message`) use direct Mongo ObjectIds with missing authorization checks. | **CONFIRMED** |
| **15** | Client-controlled `userId` on Socket.IO | `SocketContext.jsx` line 25 emits `authenticate` with client-provided `decodedToken.id`; `server.js` line 42 accepts it without socket authentication. | **CONFIRMED** |
| **16** | Client-controlled `fromUser` on Socket.IO | `server.js` line 53 accepts `{ fromUser, toUser, content }` directly from socket payloads without setting `fromUser = socket.userId`. | **CONFIRMED** |
| **17** | Client-controlled `roomName` on Socket.IO | `server.js` line 48 allows sockets to join any arbitrary `roomName` string without verifying membership. | **CONFIRMED** |
| **18** | Weak Socket.IO authorization | Socket handshake in `server.js` performs no JWT validation or token handshake check. | **CONFIRMED** |
| **19** | One socket stored per user | `server.js` line 44 maintains `userSockets[userId] = socket.id` as a single string, breaking multi-tab and multi-device connections. | **CONFIRMED** |
| **20** | Global `io.emit("tasksUpdated")` broadcasts | `routes/tasks.js` lines 69, 93, 122, 185, 200 issue global broadcast to all connected clients, triggering mass refetches. | **CONFIRMED** |
| **21** | Completion points credited to `req.user` | `routes/tasks.js` line 160 awards completion points to `req.user.id` (the request executor) regardless of assigned user. | **CONFIRMED** |
| **22** | Reopening tasks re-awards points | `routes/tasks.js` line 175 sets `completedAt = null` when status changes from 'Done', but fails to deduct points; re-completing re-credits points. | **CONFIRMED** |
| **23** | Same-day completions break user streaks | `routes/tasks.js` line 167 `areConsecutiveDays(today, user.lastCompletionDate)` returns `false` for same-day completions (`diffDays === 0`), resetting streak to 1. | **CONFIRMED** |
| **24** | Completion and reward operations lack idempotency | Concurrent completion requests increment `user.points` multiple times without unique constraint or transactional locking. | **CONFIRMED** |
| **25** | Missing-recipient crash in friend request | `routes/friends.js` line 37 executes `recipient.friends.some(...)` without checking if `recipient` is `null` (returns HTTP 500 TypeError). | **CONFIRMED** |
| **26** | Self-friend requests allowed | `routes/friends.js` line 31 does not prevent `recipientId === senderId`. | **CONFIRMED** |
| **27** | Accept friend request does not check pending status | `routes/friends.js` line 67 updates `status` to `'accepted'` without filtering for `status: 'pending'`. | **CONFIRMED** |
| **28** | Duplicate friend requests possible | `routes/friends.js` line 38 checks recipient's friends array, but ignores pending requests in the sender's array or reverse direction. | **CONFIRMED** |
| **29** | Unescaped `$regex` in user search | `routes/friends.js` line 20 passes raw query to `$regex` without escaping special characters (ReDoS / syntax crash vulnerability). | **CONFIRMED** |
| **30** | Team invitation adds users immediately | `routes/teams.js` line 70 pushes user directly to `team.members` upon invite without an explicit invitation acceptance step. | **CONFIRMED** |
| **31** | Any team member may invite users | `routes/teams.js` line 58 allows any `Member` role to add users, ignoring `Admin` role checks. | **CONFIRMED** |
| **32** | Invitee friendship requirement not verified | `routes/teams.js` line 47 does not verify if the invited user is in the inviter's friend list. | **CONFIRMED** |
| **33** | Category delete crashes when Team is missing | `routes/categories.js` line 95 executes `team.members.find(...)` assuming `team` exists. If `team` is `null`, it throws a fatal TypeError. | **CONFIRMED** |
| **34** | DB fallback behavior in `db.js` | In-memory fallback (`mongodb-memory-server`) was added in Phase 0 for local dev convenience, but must be disabled in production. | **CONFIRMED** |
| **35** | Heavy unindexed `$lookup` aggregations | Aggregation pipelines in `categories.js`, `leaderboard.js`, and `friends.js` perform `$lookup` joins on unindexed fields. | **CONFIRMED** |
| **36** | Missing database indexes | Schema files (`User.js`, `Task.js`, `Category.js`, `Team.js`, `Message.js`) define no custom indexes on query targets (`user`, `category`, `assignedTo`, `ownerId`). | **CONFIRMED** |
| **37** | Unbounded chat history query | `routes/friends.js` line 139 executes `Message.find(...)` without cursor pagination or `.limit()`. | **CONFIRMED** |
| **38** | `src/App.jsx` dead code | `main.jsx` mounts `Dashboard.jsx`; `src/App.jsx` is unused dead code. | **CONFIRMED** |
| **39** | `pages/require('dotenv').config();` stray file | File with literal name `require('dotenv').config();` exists in `src/pages/`. | **CONFIRMED** |
| **40** | `userdatatask.txt` stray file | Stray text file containing hardcoded URI exists in `src/pages/`. | **CONFIRMED** |
| **41** | `updateListDate.js` points to wrong DB / outdated schema | Script uses database name `taskdb` instead of `taskdb-users` and targets `listDate` which is not in `Task` schema. | **CONFIRMED** |
| **42** | Unused `sw.js` demo service worker | Demo file `public/sw.js` exists but is never registered in the React application. | **CONFIRMED** |
| **43** | Schema mismatch in migration script | `updateListDate.js` attempts to set `$createdAt` to `listDate` on an incompatible database connection string. | **CONFIRMED** |

---

## 3. Architecture & Codebase Analysis

### 3.1 Backend Architecture
- **Framework**: Express.js with Node HTTP server and `socket.io`.
- **Database Layer**: Mongoose 7.x connecting to MongoDB.
- **Defects Identified**:
  - Routing files contain direct inline business logic (no separate Service layer).
  - Lack of centralized request validation middleware (raw `req.body` directly used in queries).
  - Lack of standardized JSON error responses (mixed `res.status(500).json({ error: ... })` vs string sends).
  - Lack of audit logging for security-sensitive operations.

### 3.2 Real-Time & WebSockets
- **Implementation**: Socket.IO 4.x.
- **Defects Identified**:
  - Authentication happens post-connect via `socket.on('authenticate', userId)` with untrusted client payload.
  - User sockets stored in single-value map `userSockets[userId] = socket.id`, breaking multi-device support.
  - Global `io.emit("tasksUpdated")` causes global stampede of network requests on every task mutation.

### 3.3 Frontend Architecture
- **Framework**: React 19 + Vite 7 + React Router 7.
- **State & Context**: `SocketContext` and `ToastContext`.
- **Styling**: Mixed CSS (`App.css`, `Dashboard.css`, `index.css`). Tailwind CSS 4 package present in `package.json`.
- **Defects Identified**:
  - API base URLs hardcoded to `http://localhost:5000`.
  - Token handling relies on raw `localStorage.getItem("token")` without proactive expiration checks or refresh mechanisms.
  - Dead files (`App.jsx`, stray pages) pollute the repository.

---

## 4. Test Suite Inventory

- **Automated Tests Found**: **0**
- **Unit Tests**: None
- **Integration Tests**: None
- **E2E Tests**: None
- **Action Required**: Milestone 1 must introduce automated backend API and unit test frameworks (Jest/Supertest or Vitest) to establish a release gate.

---

## 5. Architectural Retention & Replacement Assessment

### 5.1 Retainable Components
- **Express + Node.js Single Monolith**: Genuinely fit for target Modular Monolith architecture.
- **MongoDB + Mongoose Data Store**: Suitable for document-based user, task, and team hierarchies.
- **Socket.IO Layer**: Retain framework, refactor authorization to connection handshake and room-based subscriptions.
- **React + Vite + Tailwind CSS Frontend Stack**: Retain modern SPA foundation; refactor component structure and layout.

### 5.2 Unfit / Replacement Components
- **Global `io.emit("tasksUpdated")`**: Replace with scoped room events (`user:{id}`, `project:{id}`).
- **Single-Socket User Map**: Replace with Socket.IO room joining (`user:{id}`).
- **Direct Controller-to-Model Mutations**: Introduce clean Service layer for business logic.
