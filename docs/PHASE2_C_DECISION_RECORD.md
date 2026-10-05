# Phase 2-C Decision Record — Task Debt & Workload Intelligence

## 1. Architectural Decisions

### DECISION 1: Deterministic & Explainable Task Debt Formula
- **Decision**: Task Debt is computed deterministically using bounded linear formulas based on `dueDate`, `status`, `priority`, and `ActivityEvent` history. No AI, LLM, or machine-learning scoring is allowed.
- **Status**: **APPROVED**

### DECISION 2: Task Debt Signal Weights & Multipliers
- **Decision**:
  - Overdue Duration Severity: Max 40 points (8 pts/day).
  - Due Date Proximity (Unstarted within 48h): Max 15 points.
  - Status Stagnation (In Progress / Blocked > 3 days): Max 20 points (4 pts/day after day 3).
  - Activity Event Churn (Reopenings & Due Date Changes): Max 15 points (6 pts/reopen, 3 pts/due-date shift).
  - Priority Multipliers: `High` = 1.5x, `Medium` = 1.0x, `Low` = 0.7x, `No Priority` = 0.5x.
  - Final Score Cap: Bounded to $[0, 100]$.
- **Status**: **APPROVED**

### DECISION 3: Debt Classification Thresholds
- **Decision**:
  - `LOW`: 0 – 24
  - `MODERATE`: 25 – 49
  - `HIGH`: 50 – 74
  - `CRITICAL`: 75 – 100
- **Status**: **APPROVED**

### DECISION 4: Workload Calculation Mechanics
- **Decision**: Workload is calculated by summing `estimatedMinutes` for incomplete tasks assigned to a user (`completed: false`, `status` not in `['Done', 'COMPLETED']`, `deletedAt: null`). If `estimatedMinutes` is 0 or unassigned, default effort fallback is 60 minutes for tracking purposes without mutating the database record.
- **Status**: **APPROVED**

### DECISION 5: Assumed Capacity MVP Model
- **Decision**: Because `User` does not store working hours, default capacity is assumed to be **8 hours/day (480 mins)** or **40 hours/week (2,400 mins)** per active user. All API responses and UI components must explicitly label this value as **Assumed Capacity (Default 40h/wk)**.
- **Status**: **APPROVED**

### DECISION 6: Workload Utilization Formula
- **Decision**:
  $$\text{Utilization \%} = \left( \frac{\text{Sum of Assigned Incomplete Estimated Minutes}}{\text{Assumed Weekly Capacity (2,400 mins)}} \right) \times 100$$
- **Status**: **APPROVED**

### DECISION 7: Overload Warning Thresholds
- **Decision**:
  - `NORMAL`: $< 90\%$
  - `MODERATE LOAD`: $90\% – 110\%$
  - `HIGH LOAD`: $111\% – 130\%$
  - `OVERLOADED`: $> 130\%$ OR Overdue High-Priority Tasks $> 3$.
  - Advisory-only: UI displays warning pill/banner; zero automatic task reassignment or task state mutation occurs.
- **Status**: **APPROVED**

### DECISION 8: Timezone Handling Policy
- **Decision**: Date calculations (overdue days, calendar week boundaries, daily workload) must use `services/timezoneService.js` with `user.timezone` (defaulting to `'UTC'`). Server-local timezone is strictly prohibited.
- **Status**: **APPROVED**

### DECISION 9: API Endpoint Architecture
- **Decision**: Expose intelligence endpoints under `/api/intelligence`:
  - `GET /api/intelligence/tasks/:id/debt`
  - `GET /api/intelligence/projects/:id/debt`
  - `GET /api/intelligence/projects/:id/workload`
  - `GET /api/intelligence/users/:id/workload`
  - `GET /api/intelligence/users/:id/overview`
- **Status**: **APPROVED**

### DECISION 10: Authorization Enforcement
- **Decision**: Reuse existing middleware:
  - Project endpoints use `canAccessProject` / `authorizeProject('MEMBER')`.
  - User workload endpoints require `req.user.id === targetUserId` OR authorized team/project owner scope.
- **Status**: **APPROVED**

### DECISION 11: Advisory Frontend Presentation
- **Decision**: Intelligence components (`DebtScoreBadge`, `DebtBreakdown`, `WorkloadSummary`, `OverloadIndicator`) are strictly read-only and advisory. No automatic task mutation or background task creation is initiated from UI components.
- **Status**: **APPROVED**

### DECISION 12: Query Performance & Aggregation Strategy
- **Decision**: Use single-pass Mongoose aggregation pipelines and leverage existing compound index `{ projectId: 1, eventType: 1, createdAt: -1 }` and indexed fields (`projectId`, `assignedTo`, `status`, `dueDate`).
- **Status**: **APPROVED**

### DECISION 13: In-Memory Caching Strategy
- **Decision**: In-memory caching is postponed (marked **PENDING / NOT NEEDED FOR MVP**) because aggregation queries on indexed Mongo collections complete in $< 15\text{ms}$. Avoid adding Redis or memory cache complexity.
- **Status**: **PENDING (NOT NEEDED FOR MVP)**

---

## 2. Decision Matrix Summary

| Decision | Area | Choice | Status |
|---|---|---|---|
| 1 | Logic | Deterministic bounded linear scoring | APPROVED |
| 2 | Weights | Overdue (40), Proximity (15), Stagnation (20), Churn (15) | APPROVED |
| 3 | Classification | LOW (0-24), MODERATE (25-49), HIGH (50-74), CRITICAL (75-100) | APPROVED |
| 4 | Workload | Sum of `estimatedMinutes` of active incomplete tasks | APPROVED |
| 5 | Capacity | Assumed default 40h/week, explicitly labeled | APPROVED |
| 6 | Utilization | `(Workload Mins / 2,400 Mins) * 100` | APPROVED |
| 7 | Overload | Advisory threshold at >130% or >3 overdue high-prio tasks | APPROVED |
| 8 | Timezone | Strict `timezoneService` execution with UTC fallback | APPROVED |
| 9 | API | Dedicated `/api/intelligence/*` routes | APPROVED |
| 10 | Security | `authorizeProject('MEMBER')` and IDOR checks | APPROVED |
| 11 | Frontend | Advisory read-only widgets, zero auto-mutation | APPROVED |
| 12 | Performance | Single-pass aggregation on indexed fields | APPROVED |
| 13 | Caching | Direct indexed DB query (no Redis) | PENDING (NOT NEEDED) |
