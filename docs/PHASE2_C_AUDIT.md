# Phase 2-C Audit — Task Debt & Workload Intelligence

## 1. Executive Summary

Milestone **Phase 2-C — Task Debt & Workload Intelligence** provides a deep architectural audit and design specification for a deterministic, explainable intelligence layer built directly upon existing application models (`Task`, `Project`, `Milestone`, `User`, `ActivityEvent`, `RewardEvent`).

This phase is **AUDIT ONLY**. No application source code, database schemas, or runtime behaviors are modified in this phase.

---

## 2. Baseline Verification

The Phase 2-C pre-audit baseline was verified against the authoritative production repository state:

- **Baseline Tag**: `phase2-b-stable`
- **Current HEAD Commit**: `5a84bad47c2517ecadfde6503ced609fc98bb776`
- **Git Working Tree**: Clean (`nothing to commit, working tree clean`)
- **Backend Test Suite (Jest)**: **94 / 94 passed** (19 / 19 test suites passed)
- **Frontend Test Suite (Vitest)**: **34 / 34 passed** (6 / 6 test suites passed)
- **Frontend Production Build (Vite)**: **PASSED** (`0` errors, `0` warnings, 199 modules transformed in 1.23s)

---

## 3. Codebase Data Feasibility Audit

### 3.1 Available Schema Fields

| Model | Field | Type | Reliability & Feasibility |
|---|---|---|---|
| **Task** | `dueDate` | Date | **High**: Used for overdue duration, due-date proximity, and deadline urgency. |
| **Task** | `startedAt`, `completedAt` | Date | **High**: Used for cycle time and completion velocity calculation. |
| **Task** | `estimatedMinutes`, `actualMinutes` | Number | **High**: Used for workload estimation and effort variance analysis. |
| **Task** | `status` | String (enum) | **High**: Values: `'READY'`, `'IN_PROGRESS'`, `'BLOCKED'`, `'COMPLETED'`, `'To Do'`, `'Done'`. Used for stagnation detection. |
| **Task** | `priority` | String (enum) | **High**: Values: `'High'`, `'Medium'`, `'Low'`, `'No Priority'`. Used for priority debt weighting. |
| **Task** | `assignedTo`, `user` | ObjectId | **High**: Used for user workload allocation and creator attribution. |
| **Task** | `projectId`, `milestoneId` | ObjectId | **High**: Used for project/milestone scope filtering and hierarchy rollup. |
| **Task** | `deletedAt` | Date | **High**: Soft-deleted tasks are filtered out (`deletedAt: null`). |
| **User** | `timezone` | String | **High**: Preferred IANA timezone string (default `'UTC'`). |
| **ActivityEvent** | `eventType`, `createdAt` | String, Date | **High**: Contains event history (`TASK_REOPENED`, `TASK_DUE_DATE_CHANGED`, `TASK_STATUS_CHANGED`, `TASK_POSTPONED`). |

### 3.2 Missing Data & Constraints

- **User Capacity**: The `User` model currently lacks explicit capacity fields (`workingHours`, `dailyCapacityMinutes`, `weeklyCapacityMinutes`, `availabilityStatus`).
- **Resolution**: Phase 2-C designs an explicit **Assumed Capacity MVP Model** (default 8 hours/day or 40 hours/week) without altering the database schema. In all UI and API outputs, capacity is clearly labeled as **Assumed Capacity (Default 40h/wk)** to avoid misrepresenting assumptions as user-configured data.

---

## 4. Task Debt Intelligence Design

### 4.1 Debt Score Formula (0 – 100)

Task Debt is a bounded, deterministic score from 0 to 100 calculated as:

$$\text{Task Debt Score} = \min\left(100, \text{Base Debt} \times \text{Priority Weight}\right)$$

Where **Base Debt** is the sum of four component signals:

$$\text{Base Debt} = S_{\text{overdue}} + S_{\text{proximity}} + S_{\text{stagnation}} + S_{\text{churn}}$$

#### Component Signals & Normalization

1. **Overdue Duration Severity ($S_{\text{overdue}}$, Max 40 pts)**:
   - Evaluated if `dueDate < NOW` and task is incomplete.
   - Formula: $S_{\text{overdue}} = \min\left(40, \text{Days Overdue} \times 8\right)$.
   - 1 day overdue = 8 pts, 5+ days overdue = max 40 pts.

2. **Due Date Proximity ($S_{\text{proximity}}$, Max 15 pts)**:
   - Evaluated if `dueDate >= NOW` and task is in `'READY'` or `'To Do'` (unstarted).
   - Formula: If hours remaining $\le 48\text{h}$, $S_{\text{proximity}} = \lfloor (48 - \text{Hours Remaining}) / 3.2 \rfloor$.
   - Urgent unstarted tasks within 48h receive up to 15 pts.

3. **Status Stagnation ($S_{\text{stagnation}}$, Max 20 pts)**:
   - Evaluated for tasks stuck in `'IN_PROGRESS'` or `'BLOCKED'` without updates.
   - Formula: If days in current status $> 3$, $S_{\text{stagnation}} = \min\left(20, (\text{Days Stagnant} - 3) \times 4\right)$.

4. **Event Churn History ($S_{\text{churn}}$, Max 15 pts)**:
   - Derived deterministically from `ActivityEvent` records for the task.
   - $S_{\text{churn}} = \min\left(15, (\text{Count}(\text{TASK\_REOPENED}) \times 6) + (\text{Count}(\text{TASK\_DUE\_DATE\_CHANGED}) \times 3)\right)$.

#### Priority Multiplier

- `High`: **1.5x**
- `Medium`: **1.0x**
- `Low`: **0.7x**
- `No Priority`: **0.5x**

### 4.2 Edge Cases & Boundary Conditions

- **Completed Tasks** (`completed: true` or `status` in `['Done', 'COMPLETED']`) $\rightarrow$ Debt Score = **0**.
- **Soft-Deleted Tasks** (`deletedAt != null`) $\rightarrow$ Debt Score = **0**.
- **Tasks in Archived Projects** $\rightarrow$ Excluded from active project debt calculations.
- **Tasks without Due Date** $\rightarrow$ $S_{\text{overdue}} = 0$, $S_{\text{proximity}} = 0$; debt depends solely on stagnation and churn.
- **Recently Created Tasks (< 24h old)** $\rightarrow$ $S_{\text{stagnation}} = 0$.

---

## 5. Task Debt Classification Thresholds

- **LOW (0 – 24)**: Normal progress. Low or no debt.
- **MODERATE (25 – 49)**: Mild delay or proximity warning. Requires monitoring.
- **HIGH (50 – 74)**: Significant delay, stagnation, or multiple due-date shifts. Action required.
- **CRITICAL (75 – 100)**: Severely overdue high-priority task or severe churn. Immediate intervention required.

---

## 6. Workload Intelligence & Capacity Model

### 6.1 Workload Metrics

Workload is aggregated at User, Project, Milestone, and Team levels:

1. **Assigned Incomplete Task Count**: Total active incomplete tasks assigned to a user.
2. **Estimated Workload Minutes**: $\sum \text{estimatedMinutes}$ of assigned incomplete tasks.
3. **Overdue Workload Minutes**: $\sum \text{estimatedMinutes}$ of overdue incomplete tasks.
4. **High-Priority Workload Count**: Count of assigned incomplete tasks with `priority === 'High'`.

### 6.2 Capacity & Utilization Model (Assumed MVP)

- **Default Daily Capacity**: 480 minutes (8 hours).
- **Default Weekly Capacity**: 2,400 minutes (40 hours / 5 work days).
- **Utilization Formula**:

$$\text{Utilization \%} = \left( \frac{\text{Estimated Workload Minutes (Weekly)}}{\text{Assumed Weekly Capacity (2,400 mins)}} \right) \times 100$$

### 6.3 Overload Thresholds

- **NORMAL**: Utilization $< 90\%$
- **MODERATE LOAD**: $90\% \le \text{Utilization} \le 110\%$
- **HIGH LOAD**: $111\% \le \text{Utilization} \le 130\%$
- **OVERLOADED**: Utilization $> 130\%$ OR Overdue High-Priority Tasks $> 3$.

---

## 7. Security & IDOR Safeguards

1. **Project Intelligence Access**: All project debt/workload queries verify `canAccessProject(userId, projectId)` using existing `authorizeProject('MEMBER')` middleware.
2. **Team Workload Access**: Verified via `authorizeTeam('Member')`.
3. **User Workload Privacy**: Users can only request their own workload unless requested by a Team Owner/Admin or Project Owner in a shared context.

---

## 8. Summary of Feasibility

Phase 2-C is **100% FEASIBLE** without schema alterations, third-party dependencies, or AI. All required data signals are available in current models and indexed via Phase 2-B infrastructure.
