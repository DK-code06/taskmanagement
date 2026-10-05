# Phase 2-C Implementation Plan — Task Debt & Workload Intelligence

## 1. Plan Overview

This document defines the implementation roadmap for **Phase 2-C — Task Debt & Workload Intelligence**. 

Implementation will begin **ONLY AFTER** receiving explicit user authorization.

---

## 2. Implementation Sub-Milestones & Subtasks

### Sub-Milestone 2-C.1: Intelligence Service Layer (`task-backendd/services/intelligenceService.js`)
- Implement `calculateTaskDebt(task, activityEvents = [])` returning score $[0, 100]$, classification (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`), and explainable breakdown.
- Implement `calculateProjectDebt(projectId)` aggregating task debt across project tasks.
- Implement `calculateUserWorkload(userId, options)` returning active task count, estimated workload minutes, capacity utilization percentage, and overload status.
- Implement `calculateProjectWorkload(projectId)`.

### Sub-Milestone 2-C.2: Intelligence REST Endpoints (`task-backendd/routes/intelligence.js`)
- `GET /api/intelligence/tasks/:id/debt`: Returns task debt score and signal breakdown.
- `GET /api/intelligence/projects/:id/debt`: Returns project debt summary and top high-debt tasks.
- `GET /api/intelligence/projects/:id/workload`: Returns project workload breakdown.
- `GET /api/intelligence/users/:id/workload`: Returns user workload metrics and utilization.
- `GET /api/intelligence/users/:id/overview`: Returns user personal intelligence overview.
- Register router in `server.js` under `/api/intelligence`.

### Sub-Milestone 2-C.3: Advisory Frontend UI Components (`task-frontend/src/components/intelligence/`)
- `DebtScoreBadge.jsx`: Compact visual badge displaying debt score and color-coded status (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`).
- `DebtBreakdownPopover.jsx`: Popover showing breakdown of overdue, proximity, stagnation, and churn scores.
- `WorkloadSummaryWidget.jsx`: Dashboard widget showing user workload utilization bar and active task count.
- `OverloadIndicatorBanner.jsx`: Advisory alert banner displayed when workload exceeds capacity threshold.
- Integrate widgets into `TaskCard`, `TaskDetails`, `ProjectOverview`, and `Dashboard`.

### Sub-Milestone 2-C.4: Backend & Frontend Test Suites
- Create `task-backendd/tests/taskDebt.test.js`: Test debt score boundaries, priority multipliers, stagnation logic, event churn contribution, edge cases (completed, deleted, no due date), and timezone boundaries.
- Create `task-backendd/tests/workloadIntelligence.test.js`: Test workload aggregation, utilization percentages, overload detection thresholds, and IDOR access control.
- Create `task-frontend/src/components/intelligence/__tests__/intelligence.test.jsx`: Test visual component rendering, badge color coding, popover toggle, and advisory banner display.

---

## 3. Migration Requirements

- **Database Migrations**: **NONE REQUIRED**. All calculations use existing fields on `Task`, `Project`, `Milestone`, `User`, and `ActivityEvent`.
- **Backward Compatibility**: Fully preserved for all existing APIs (M1–M4.6 and Phase 2-B).

---

## 4. Release Gate Verification Criteria

Before tagging `phase2-c-stable`:

1. **Backend Tests**: $100\%$ pass rate (`npm test` in `task-backendd`). Expected: $\ge 21$ test suites, $\ge 110$ individual tests.
2. **Frontend Tests**: $100\%$ pass rate (`npx vitest run` in `task-frontend`). Expected: $\ge 7$ test suites, $\ge 40$ individual tests.
3. **Frontend Production Build**: `npm run build` in `task-frontend` succeeds with 0 warnings/errors.
4. **Security Verification**: IDOR tests confirm 403 Forbidden for unauthorized project/user workload access.
5. **Git Working Tree**: Clean working tree.

---

## 5. Rollback Strategy

If any regression occurs during Phase 2-C implementation:

1. Git revert to baseline tag `phase2-b-stable` (`5a84bad47c2517ecadfde6503ced609fc98bb776`).
2. Verify system functionality using Phase 2-B release gate scripts.
