# Phase 2-F Decision Record: Focus Mode Architecture

## Architectural Decision Records (ADRs)

### ADR 1: Single Source of Truth for Task State
- **Status**: `APPROVED`
- **Context**: Focus Mode must track focused work duration without creating duplicate or competing task attributes.
- **Decision**: `Task` remains the single authoritative source for task status (`READY`, `IN_PROGRESS`, `Done`), assignment, due date, and priority. `FocusSession` tracks work sessions on a task. Upon completion, `FocusSession` updates `Task.actualMinutes`.

### ADR 2: Concurrency Rule — 1 Active Session Per User
- **Status**: `APPROVED`
- **Context**: Users could attempt to start multiple focus sessions simultaneously across tabs or devices.
- **Decision**: A user is restricted to a maximum of **1 active or paused focus session at any given time**. Attempting to start a second focus session returns `409 Conflict` with the active session details.

### ADR 3: Server-Authoritative Timer Mechanics
- **Status**: `APPROVED`
- **Context**: Client timers (`setInterval`) fail across tab suspension, browser refresh, device sleep, or client clock drift.
- **Decision**: Persisted elapsed focus duration is calculated strictly using server UTC timestamps (`startedAt`, `lastResumedAt`, `accumulatedFocusedSeconds`). The frontend timer is presentational only.

### ADR 4: FocusSession Data Model Schema & Persistence Strategy
- **Status**: `APPROVED`
- **Context**: Focus state must persist across page refreshes and network reconnects.
- **Decision**: Create a dedicated Mongoose model `FocusSession` in `task-backendd/models/FocusSession.js` with partial unique index on `{ userId: 1, status: { $in: ['ACTIVE', 'PAUSED'] } }`.

### ADR 5: Authorization & IDOR Reuse Strategy
- **Status**: `APPROVED`
- **Context**: Focus session endpoints must prevent unauthorized access or session hijacking.
- **Decision**: Focus session APIs leverage `canAccessTask(userId, taskId)` for task access authorization, and enforce strict session ownership checks (`userId.equals(req.user.id)`).

### ADR 6: Focus Session Lifecycle States
- **Status**: `APPROVED`
- **Context**: Define allowable state transitions for a focus session.
- **Decision**: Allowed states are `ACTIVE`, `PAUSED`, `COMPLETED`, and `CANCELLED`.
  - Transitions:
    - `ACTIVE` → `PAUSED`
    - `PAUSED` → `ACTIVE`
    - `ACTIVE` / `PAUSED` → `COMPLETED`
    - `ACTIVE` / `PAUSED` → `CANCELLED`

### ADR 7: Auto-Transition Task Status on Focus Start
- **Status**: `PENDING` (Requires user/product policy confirmation)
- **Context**: Should starting a focus session automatically change a task status from `READY`/`To Do` to `IN_PROGRESS`?
- **Recommendation**: Optional opt-in parameter `autoStartTask: true` (default `true` if task status is currently `READY`/`To Do`).

### ADR 8: Pomodoro & Custom Break Timer Scope
- **Status**: `APPROVED` (Phase 2-F MVP: Deferred to P2)
- **Context**: Complex break timers and Pomodoro cycles can overcomplicate MVP focus tracking.
- **Decision**: Exclude Pomodoro interval logic from Phase 2-F MVP. Focus Mode MVP focuses on stopwatch-style work session tracking with manual pause/resume/complete.

### ADR 9: Gamification & Focus Rewards Policy
- **Status**: `APPROVED` (Phase 2-F MVP: Deferred to P2)
- **Context**: Reward points policy for completing tasks is already established in M4.3 / M4.5.
- **Decision**: Focus sessions do not grant additional reward points automatically in MVP. Task completion reward policies remain authoritative and untouched.

### ADR 10: Realtime Synchronization Strategy
- **Status**: `APPROVED`
- **Context**: Keeping multiple open tabs/devices in sync when a focus session starts/pauses/completes.
- **Decision**: Use REST API for all state mutations, with Socket.IO broadcasting `FOCUS_SESSION_UPDATED` to `user:<userId>` room for real-time tab/device synchronization.
