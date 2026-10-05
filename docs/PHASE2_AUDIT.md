# Phase 2 Audit — Product Intelligence & Feature Architecture Audit

## 1. Executive Summary

Phase 2-A performs a comprehensive architecture audit, dependency mapping, risk assessment, and implementation blueprint for seven deferred product capabilities:
1. **AI / LLM Features**
2. **Focus Mode**
3. **Task Debt Intelligence**
4. **Workload Intelligence**
5. **Advanced Project Recommendations**
6. **Message Search**
7. **GitHub Integration**

No application source code, database schemas, API routes, or dependencies were altered during this audit. The current codebase remains strictly at the verified `m4.6-stable` baseline (`d24fbd15c976a0ffeadbe68f72a0784764a634d7`).

---

## 2. Baseline & Current Architecture Verification

- **Git HEAD**: `d24fbd15c976a0ffeadbe68f72a0784764a634d7`
- **Baseline Tag**: `m4.6-stable`
- **Backend Tests**: 84 / 84 passed (18 / 18 test suites)
- **Frontend Tests**: 34 / 34 passed (6 / 6 test suites)
- **Production Build**: Passed (0 warnings)

### Existing Infrastructure Available for Reuse
- **Authentication & Security**: Access JWT (15m) + HTTP-only refresh cookie tied to `User.sessionVersion`. Server-side IDOR checks (`canAccessProject`, `authorizeTask`, `authorizeTeam`).
- **Data Models**: `User`, `Project`, `Milestone`, `Task`, `ActivityEvent` (append-only historical log), `RewardEvent` (idempotent reward log), `Notification`, `NotificationPreference`, `PushSubscription`, `ReminderJob`, `Message`, `Conversation`.
- **Services**: `notificationService` (in-app + web push), `reminderSchedulerService`, `activityService`, `timezoneService`.
- **Frontend Primitives**: M4.1 design system (`Button`, `Card`, `Input`, `Badge`, `Modal`, `Drawer`, `Toast`, `Spinner`, `Progress`, `Avatar`, `Tooltip`, `EmptyState`, `ConfirmDialog`, `AppShell`, `Header`).

---

## 3. Comprehensive Feature-by-Feature Audit

### Feature 1 — AI / LLM Features
- **Recommended Scope**:
  1. *Task Decomposition*: Given a complex task title and description, suggest 3–5 actionable subtasks.
  2. *Natural-Language Task Creation*: Parse text input like "Fix auth bug by Friday high priority" into structured `{ title, dueDate, priority }`.
  3. *Advisory Task Debt Summarization*: Provide human-readable explanations of project bottlenecks.
- **Architectural Rules**:
  - **Advisory Only**: AI output must never directly mutate database records without explicit user confirmation.
  - **Asynchronous Execution**: AI processing occurs asynchronously via background queue or non-blocking POST endpoints with strict timeout handling (e.g. 10s timeout).
  - **Privacy & Security**: Zero sensitive user credentials or PII sent to external LLMs. Input strings sanitized to prevent prompt injection.
  - **Provider Choice**: Google Gen AI SDK (Gemini API) using server-side `GEMINI_API_KEY`.
- **Status**: Proposed for Phase 2-E.

### Feature 2 — Focus Mode
- **Recommended Scope**:
  - Pomodoro deep-work timer integrated with a specific target `Task`.
  - Session state managed primarily in frontend state with an optional `FocusSession` log (`taskId`, `userId`, `durationSeconds`, `completedAt`).
  - Suppresses non-critical UI notifications while focus session is active (`isFocusActive = true`).
  - Completion awards normal task completion rewards if task is marked Done during or upon session end.
- **Status**: Proposed for Phase 2-F.

### Feature 3 — Task Debt Intelligence
- **Recommended Scope**:
  - Deterministic Task Debt Index (0–100) calculated from real application signals:
    - Overdue task count (`dueDate < now` & incomplete).
    - Postponed task count (tracked via `TASK_POSTPONED` or `TASK_DUE_DATE_CHANGED` in `ActivityEvent`).
    - Stale task count (in status `In Progress` for > 7 days without update).
    - Reopened task count (`TASK_REOPENED` in `ActivityEvent`).
- **Calculation Architecture**: Rule-based aggregation engine in backend (`services/taskDebtService.js`), leveraging indexed `ActivityEvent` records. No probabilistic AI required.
- **Status**: Proposed for Phase 2-C.

### Feature 4 — Workload Intelligence
- **Recommended Scope**:
  - Computes capacity utilization across team members and individual users.
  - Metrics: Sum of `estimatedMinutes` for open assigned tasks vs historical throughput over past 14/30 days.
  - Flags overload risk (> 40 assigned hours/week) and unassigned task bottlenecks.
- **Calculation Architecture**: Deterministic MongoDB aggregation pipelines joining `Task` and `ActivityEvent`.
- **Status**: Proposed for Phase 2-C.

### Feature 5 — Advanced Project Recommendations
- **Recommended Scope**:
  - Actionable system suggestions generated from Task Debt, Workload, and Milestone progress signals:
    - "Unassign stale task inactive for 10 days?"
    - "Reassign task from User A (overloaded) to User B (available)?"
    - "Milestone 1 is 100% completed - mark milestone completed?"
  - Lifecycle: `PROPOSED` → `ACCEPTED` (executes action) or `DISMISSED` or `EXPIRED`.
- **Status**: Proposed for Phase 2-D.

### Feature 6 — Message Search
- **Recommended Scope**:
  - Full-text search across direct chat messages.
  - Security-First Architecture: Uses MongoDB text index on `Message` collection (`content`) scoped strictly to `$or: [{ fromUser: currentUserId }, { toUser: currentUserId }]`. Respects `deletedAt`.
- **Status**: Proposed for Phase 2-G.

### Feature 7 — GitHub Integration
- **Recommended Scope**:
  - OAuth 2.0 application link allowing users to link GitHub repositories to Projects (`Project.githubRepo`).
  - Webhook receiver (`POST /api/integrations/github/webhook`) verifying HMAC signatures (`X-Hub-Signature-256`).
  - Syncs GitHub Pull Requests and Issues with Tasks and Milestones.
- **Security & Storage**: GitHub access tokens encrypted at rest in DB (`GitHubConnection` schema with AES-256 encryption).
- **Status**: Proposed for Phase 2-H.

---

## 4. Cross-Feature Dependency Analysis & Milestone Roadmap

```
Phase 2-A: Audit & Architecture (CURRENT)
    ↓
Phase 2-B: Foundational Intelligence Infrastructure & Activity Event Enhancements
    ↓
Phase 2-C: Task Debt & Workload Intelligence Engine
    ↓
Phase 2-D: Advanced Project Recommendations
    ↓
Phase 2-E: AI / LLM Capabilities (Task Decomposition & Summarization)
    ↓
Phase 2-F: Focus Mode & Deep Work Sessions
    ↓
Phase 2-G: Message Search
    ↓
Phase 2-H: GitHub Integration
```

---

## 5. Security, Privacy & Performance Risk Matrix

| Risk Category | Feature | Identified Risk | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Security** | AI / LLM | Prompt injection / Data leakage to external APIs | Sanitize prompts; strip PII; require advisory user confirmation |
| **Security** | GitHub | OAuth token theft / Webhook spoofing | AES-256 token encryption at rest; HMAC signature verification |
| **Security** | Message Search | Cross-user conversation data leak | Strict MongoDB query scoping to authenticated user's conversations |
| **Performance** | Workload / Debt | Unindexed full table scans on `ActivityEvent` | Compound index on `{ projectId: 1, eventType: 1, createdAt: -1 }` |
| **Performance** | AI Service | Synchronous API latency blocking server | Asynchronous processing with 10s strict timeout fallbacks |

---

## 6. Required User Decisions (Pending)

All decisions remain **PENDING** until explicit user approval:
1. **AI Model Provider Choice**: Gemini API vs OpenAI compatible provider.
2. **AI Data Privacy**: Consent model for sending task titles to LLM for subtask generation.
3. **GitHub OAuth Strategy**: GitHub App vs OAuth App.
