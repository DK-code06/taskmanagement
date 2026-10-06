# Phase 2-F Architecture & UX Audit: Focus Mode

## 1. Executive Summary & Baseline Verification

### Verified Production Checkpoint
- **Authoritative Baseline Tag**: `phase2-e-stable`
- **Authoritative Baseline Commit**: `34d27e668b3eec08824788fdad76d3e9e19937ad`
- **Git Working Tree**: Clean
- **Test Baseline**:
  - Backend: 23 / 23 test suites passed (137 / 137 tests)
  - Frontend: 9 / 9 test suites passed (50 / 50 tests)
  - Production Build: PASSED (0 build warnings/errors)

---

## 2. Existing Architecture Audit Findings

### A. Backend Infrastructure
1. **Task Model (`models/Task.js`)**:
   - Holds authoritative task metadata: `status`, `completed`, `assignedTo`, `user`, `projectId`, `milestoneId`, `dueDate`, `startedAt`, `estimatedMinutes`, `actualMinutes`, `completedAt`, `rewardGranted`, `deletedAt`.
   - `startedAt` and `actualMinutes` exist on `Task`, but are static timestamps and counters without session tracking or pause/resume history.
2. **User & Authentication Model (`models/User.js`)**:
   - Manages JWT authentication, `sessionVersion` invalidation, `timezone`, and `aiConsent`.
   - Does not track active focus session state directly.
3. **Authorization & IDOR System (`middleware/authorize.js`)**:
   - `canAccessTask(userId, taskId)` checks:
     1. Direct creator (`user`) or assignee (`assignedTo`).
     2. Parent Project access (`canAccessProject`).
     3. Parent Task access (for subtasks).
     4. Legacy Category access fallback.
   - Ideal authorization helper to enforce IDOR controls for Focus Session operations.
4. **ActivityEvent System (`models/ActivityEvent.js`)**:
   - Append-only log for lifecycle audit events (`TASK_CREATED`, `TASK_COMPLETED`, etc.).
   - Can easily log `FOCUS_SESSION_STARTED`, `FOCUS_SESSION_COMPLETED` without schema breakage.
5. **Timezone Service (`services/timezoneService.js`)**:
   - Provides IANA timezone validation, local day boundaries, and streak detection.
   - Focus Session timestamps must remain UTC in the database, with local presentation calculated via `timezoneService`.
6. **Socket.IO Architecture (`server.js`)**:
   - Authenticated user rooms (`user:<userId>`) and project/team rooms.
   - Allows lightweight focus session state sync across multiple tabs/devices for the same user.

### B. Frontend Architecture
1. **Layout & App Shell (`components/layout/AppShell.jsx`)**:
   - Shell structure with persistent `Header`, `Sidebar`, and `MainContent`.
   - Prime location for a global active focus floating control bar / drawer so the user can navigate freely while maintaining focus.
2. **Task Views (`components/task/TaskDetails.jsx`, `TaskCard.jsx`)**:
   - Contain task metadata, subtask lists, AI tools, and status controls.
   - natural entry points for "Start Focus Session".
3. **Modal / UI Primitives (`components/ui/Modal.jsx`, `Button.jsx`, `Badge.jsx`, `Spinner.jsx`)**:
   - Standardized accessible UI components following M4.1 design system.

---

## 3. Focus Mode Scope & Boundaries

### In Scope (Phase 2-F MVP)
1. **Start Focus Session**: User initiates a focus session associated with an accessible task.
2. **Active Focus Session UI**: Floating bar / docked drawer showing task title, project tag, live ticking timer, pause/resume, and complete/stop controls.
3. **Pause & Resume**: Server-authoritative session pause and resume transitions.
4. **Complete / Stop Session**: Calculates total elapsed focus time, updates session record, and updates task `actualMinutes`.
5. **Single Active Session Rule**: 1 user can have at most 1 active/paused focus session at a time across all devices/tabs.
6. **Server-Authoritative Timer**: Persisted elapsed seconds derived strictly from server timestamps (`startedAt`, `lastResumedAt`, `accumulatedFocusedSeconds`), immune to client clock drift, browser refresh, or tab suspension.
7. **Session Recovery**: Refreshing browser, switching tabs, or reconnecting automatically restores active focus session state.
8. **IDOR & Authorization Protection**: Reuses `canAccessTask(userId, taskId)` to enforce access control.

### Out of Scope / Future Scope (P2 / P3)
- ❌ **Pomodoro / Custom Break Timers** (P2: Optional future addition).
- ❌ **Audio / Chime Notifications** (P2: Optional audio cues).
- ❌ **Browser / Web Push / OS Notifications for Focus** (P2: Future integration).
- ❌ **Distraction / Website Blocking** (P3: Out of scope for web app).
- ❌ **Focus Streaks & Gamification Points for Focus** (P2: Future evaluation; existing task completion reward policy remains untouched).
- ❌ **Calendar / Third-party Integrations** (P3: Out of scope).

---

## 4. Single Source of Truth & Task Relationship

> [!IMPORTANT]
> Focus Mode MUST NOT duplicate or replace Task state. 
> `Task` remains the single source of truth for task status (`READY`, `IN_PROGRESS`, `Done`), assignment, due date, priority, and completion.

### Entity Relationship & Multiplicity
- **Relationship**: `FocusSession` represents discrete work activity sessions performed by a `User` on a `Task`.
- **Multiplicity**:
  - `1 User` → `Max 1 Active/Paused FocusSession` (Global constraint).
  - `1 FocusSession` → `1 Task` & `1 User` & `1 Project` (optional context).
  - `1 Task` → `Many FocusSessions` (Historical log of work sessions over time).

---

## 5. Focus Session Data Model Audit (`FocusSession`)

A dedicated persistent collection `FocusSession` is required to track session state, pause logs, and server-authoritative timestamps across browser refreshes and device switches.

### Proposed Data Schema

```javascript
const focusSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null,
    index: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
    default: 'ACTIVE',
    index: true
  },
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  lastResumedAt: {
    type: Date,
    default: Date.now
  },
  pausedAt: {
    type: Date,
    default: null
  },
  endedAt: {
    type: Date,
    default: null
  },
  accumulatedFocusedSeconds: {
    type: Number,
    default: 0,
    min: 0
  },
  pauseCount: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true,
    default: ""
  }
}, { timestamps: true });

// Partial compound index to guarantee MAX 1 ACTIVE/PAUSED session per user
focusSessionSchema.index(
  { userId: 1, status: 1 },
  { partialFilterExpression: { status: { $in: ['ACTIVE', 'PAUSED'] } }, unique: true }
);

focusSessionSchema.index({ userId: 1, createdAt: -1 });
focusSessionSchema.index({ taskId: 1, status: 1 });
```

---

## 6. Server-Authoritative Timer Architecture

Client-side timers (`setInterval`) are UI-only and MUST NOT be trusted as authoritative.

### Elapsed Time Calculation Formula

When querying or completing a session:
1. **If status is `PAUSED`**:
   $$\text{Total Focused Seconds} = \text{accumulatedFocusedSeconds}$$
2. **If status is `ACTIVE`**:
   $$\text{Current Segment Seconds} = \max\left(0, \left\lfloor \frac{\text{Date.now}() - \text{lastResumedAt}}{1000} \right\rfloor\right)$$
   $$\text{Total Focused Seconds} = \text{accumulatedFocusedSeconds} + \text{Current Segment Seconds}$$

### State Transition Logic
- **Pause Action**:
  - `accumulatedFocusedSeconds += max(0, floor((now - lastResumedAt) / 1000))`
  - `pausedAt = now`
  - `pauseCount += 1`
  - `status = 'PAUSED'`
- **Resume Action**:
  - `lastResumedAt = now`
  - `pausedAt = null`
  - `status = 'ACTIVE'`
- **Complete Action**:
  - Compute final `Total Focused Seconds`.
  - `endedAt = now`
  - `status = 'COMPLETED'`
  - Update parent `Task.actualMinutes += round(Total Focused Seconds / 60)`.

---

## 7. Concurrency & Multi-Device Policy

1. **Strict 1 User → 1 Active Session Policy**:
   - If a user attempts to call `POST /api/focus/sessions` while having an existing `ACTIVE` or `PAUSED` session, the API returns `409 Conflict` with the active session details, giving the user the option to resume existing, complete existing, or cancel existing.
2. **Multi-Tab / Multi-Device Synchronization**:
   - When a session state changes (Start, Pause, Resume, Complete), the server broadcasts a `FOCUS_SESSION_UPDATED` Socket.IO event to `user:<userId>`.
   - Open tabs on other devices update their active focus control bar instantly without polling.

---

## 8. Authorization & IDOR Security Audit

- **Task Access Check**: Every focus session creation verifies `canAccessTask(userId, taskId)`. If denied, returns `403 Forbidden` / `404 Not Found`.
- **Session Ownership Control**: All session mutations (`pause`, `resume`, `complete`, `cancel`) require `userId.equals(req.user.id)`. Non-owners cannot manipulate another user's session even if they know the `sessionId` (`HTTP 403`).
- **Removed Project Member Handling**: If a project member is removed while a focus session is active, their next pause/complete request triggers `canAccessTask`, which gracefully auto-cancels the session if project access is revoked.

---

## 9. Task Status Interaction Rules

- **On Start Focus**: Option to transition task status from `READY` / `To Do` to `IN_PROGRESS` if specified in request body or user preference (`autoStartTask: true`).
- **On Complete Task while Focus Active**: Completing the task in task list auto-completes the active focus session and logs total focused time.
- **On Task Deletion / Reassignment**: Active focus session transitions to `CANCELLED` / `ABANDONED`.

---

## 10. Prioritized Audit Findings

### P0 — Must Resolve Before Implementation
- Enforce strict server-authoritative timer logic (0 client clock dependency).
- Enforce unique partial index on `{ userId: 1, status: { $in: ['ACTIVE', 'PAUSED'] } }` to prevent race conditions.
- Re-use `canAccessTask` for IDOR security on all session routes.

### P1 — Required for Phase 2-F MVP
- REST endpoints (`POST /start`, `GET /active`, `POST /pause`, `POST /resume`, `POST /complete`, `POST /cancel`).
- Global floating Focus bar / docked widget in `AppShell.jsx`.
- Automatic session recovery on page refresh.
- Updates task `actualMinutes` upon session completion.

### P2 — Recommended Future Enhancements
- Pomodoro work/break timer intervals.
- Audio / sound cues for session completion.
- Focus time breakdown by project/task in Analytics dashboard.

### P3 — Explicitly Out of Scope
- Website/distraction blockers.
- Calendar sync.
