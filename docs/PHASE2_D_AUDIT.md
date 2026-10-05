# Phase 2-D Audit — Advanced Project Recommendations Lifecycle

## 1. Executive Summary

Milestone **Phase 2-D — Advanced Project Recommendations Lifecycle** provides a comprehensive architectural design for a deterministic, explainable, and advisory recommendation engine for Projects, Milestones, and Tasks.

This phase is **AUDIT ONLY**. No application source code, database schemas, or existing system behaviors are modified during this audit phase.

---

## 2. Baseline Verification

The Phase 2-D pre-audit baseline was verified against the authoritative production repository state:

- **Authoritative Baseline Tag**: `phase2-c-stable`
- **Current HEAD Commit**: `d39d5e8284f4691e5cf4b545735dc34daf867110`
- **Git Working Tree**: Clean (`nothing to commit, working tree clean`)
- **Backend Test Suite (Jest)**: **115 / 115 passed** (21 / 21 test suites passed)
- **Frontend Test Suite (Vitest)**: **40 / 40 passed** (7 / 7 test suites passed)
- **Frontend Production Build (Vite)**: **PASSED** (`0` errors, `0` warnings, 199 modules transformed in 1.54s)

---

## 3. Integration with Existing Phase 2 Systems

### 3.1 Consuming Phase 2-C Intelligence Services
Phase 2-D will directly consume existing Phase 2-C services without duplicating scoring logic or queries:
- **`taskDebtService.js`**: `calculateTaskDebt(taskId)` and `getProjectDebtSummary(projectId)`.
- **`workloadIntelligenceService.js`**: `getUserWorkload(userId)` and `getProjectWorkload(projectId)`.
- **`timezoneService.js`**: `getLocalDateString` for timezone-aware date threshold checks.

### 3.2 ActivityEvent Index Utilization
Recommendations leverage the Phase 2-B compound index `{ projectId: 1, eventType: 1, createdAt: -1 }` on `ActivityEvent` to inspect task reopening frequency, status change history, and overdue shifts.

---

## 4. Deterministic Recommendation Rules & Types

Recommendations are 100% deterministic, explainable, and derived from quantifiable database metrics. Zero AI, LLM, or probabilistic models are used.

| Recommendation Type | Trigger Condition | Suggested Action | Priority |
|---|---|---|---|
| `REALLOCATE_WORKLOAD` | Project member capacity utilization $> 130\%$ AND another project member utilization $< 60\%$. | "Consider reassigning tasks from [Member A] to [Member B]." | HIGH |
| `REBREAKDOWN_STAGNANT_TASK` | Task Debt Score $\ge 75$ (`CRITICAL`) OR task stagnant in `IN_PROGRESS` $> 5$ days. | "Consider breaking task into subtasks or re-estimating scope." | HIGH |
| `RESOLVE_BLOCKER` | Task in `BLOCKED` status for $> 48\text{h}$. | "Follow up on blocker dependencies or update task status." | MEDIUM |
| `ADJUST_DUE_DATE` | Task due in $< 24\text{h}$ with 0 subtasks completed or high debt score. | "Consider adjusting due date or prioritizing immediate execution." | MEDIUM |
| `ARCHIVE_COMPLETED_PROJECT` | Project completion percentage $= 100\%$ but project status is `'ACTIVE'`. | "Project is 100% complete. Consider marking project as ARCHIVED or COMPLETED." | LOW |

---

## 5. Recommendation Lifecycle & State Machine

```
   +-------------------+
   |   RULE TRIGGER    |
   +---------+---------+
             |
             v
   +-------------------+
   |   ACTIVE (0.95)   |  <--- (Dynamic computation or DB state)
   +----+---------+----+
        |         |
        |         +-----------------------+
        v                                 v
+---------------+                 +---------------+
|   DISMISSED   |                 |    EXPIRED    |
+---------------+                 +---------------+
```

### State Definitions
1. **ACTIVE**: Rule conditions currently met; recommendation presented in UI.
2. **DISMISSED**: Explicitly dismissed by an authorized user. Dismissal recorded to prevent re-display.
3. **EXPIRED**: Underlying rule condition no longer met (e.g. task completed or debt dropped).

---

## 6. Security, Authorization & IDOR Protection

1. **Project Scope**: Protected via `canAccessProject` / `authorizeProject('MEMBER')`. Non-members receive `403 Forbidden`.
2. **Team Scope**: Protected via `authorizeTeam('Member')`.
3. **Advisory Guarantee**: Recommendations are strictly advisory. Zero automatic task mutation or auto-reassignment is permitted.

---

## 7. Audit Conclusion & Feasibility

Phase 2-D is **100% FEASIBLE** without introducing external AI dependencies, breaking changes, or schema mutations.
