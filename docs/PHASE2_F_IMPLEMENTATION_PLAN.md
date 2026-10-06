# Phase 2-F Implementation Plan: Focus Mode

## Overview
This implementation plan outlines the technical steps required to build Phase 2-F (Focus Mode) upon authorization. No application code is modified during this audit phase.

---

## Technical Component Breakdown

### Step 1: Data Model (`task-backendd/models/FocusSession.js`) [NEW]
- Create `FocusSession` schema with fields: `userId`, `taskId`, `projectId`, `status`, `startedAt`, `lastResumedAt`, `pausedAt`, `endedAt`, `accumulatedFocusedSeconds`, `pauseCount`, `notes`.
- Define partial unique index `{ userId: 1, status: 1 }` for active/paused sessions.

### Step 2: Backend Focus Service (`task-backendd/services/focusService.js`) [NEW]
- Implement business logic functions:
  - `startSession({ userId, taskId, notes, autoStartTask })`
  - `getActiveSession(userId)`
  - `pauseSession({ userId, sessionId })`
  - `resumeSession({ userId, sessionId })`
  - `completeSession({ userId, sessionId, notes })`
  - `cancelSession({ userId, sessionId, reason })`
- Compute server-authoritative elapsed seconds.
- Update parent `Task.actualMinutes` on session completion.

### Step 3: Controller & API Routes (`task-backendd/routes/focus.js`) [NEW]
- Expose REST Endpoints:
  - `POST /api/focus/sessions` — Start session (IDOR check via `canAccessTask`).
  - `GET /api/focus/sessions/active` — Fetch current user's active session.
  - `POST /api/focus/sessions/:id/pause` — Pause active session.
  - `POST /api/focus/sessions/:id/resume` — Resume paused session.
  - `POST /api/focus/sessions/:id/complete` — Complete session and sync duration.
  - `POST /api/focus/sessions/:id/cancel` — Cancel session.
  - `GET /api/focus/sessions/history` — Query user's past focus sessions.

### Step 4: Route Registration & Socket Integration (`task-backendd/server.js`) [MODIFY]
- Mount focus routes: `app.use("/api/focus", auth, focusRoutes(io));`.
- Broadcast `FOCUS_SESSION_UPDATED` to `user:<userId>` room on state change.

### Step 5: Frontend Focus State & UI Components (`task-frontend`) [NEW]
- Create `src/context/FocusContext.jsx` or `src/hooks/useFocusSession.js` for active session state management.
- Create `src/components/focus/FocusControlBar.jsx` — Persistent floating bar in `AppShell.jsx`.
- Create `src/components/focus/FocusModal.jsx` — Full focus view modal.

### Step 6: Integration Points (`task-frontend`) [MODIFY]
- Add "🎯 Start Focus" button to `TaskDetails.jsx` and `TaskCard.jsx`.
- Mount `FocusControlBar` in `AppShell.jsx`.

### Step 7: Automated Test Suites [NEW]
- Backend Jest suite: `task-backendd/tests/focus.test.js`
- Frontend Vitest suite: `task-frontend/src/components/focus/__tests__/focus.test.jsx`

---

## Verification & Release Gate Checklist

1. **Backend Tests**: 23 existing suites + 1 new focus suite (`100% PASS`).
2. **Frontend Tests**: 9 existing suites + 1 new focus UI suite (`100% PASS`).
3. **Production Build**: Vite production build (`0 errors`).
4. **Git Discipline**: Clean working tree and tag `phase2-f-stable`.
