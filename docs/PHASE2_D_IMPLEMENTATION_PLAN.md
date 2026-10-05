# Phase 2-D Implementation Plan — Advanced Project Recommendations Lifecycle

## 1. Plan Overview

This document defines the implementation roadmap for **Phase 2-D — Advanced Project Recommendations Lifecycle**.

Implementation will begin **ONLY AFTER** receiving explicit user authorization.

---

## 2. Implementation Sub-Milestones & Deliverables

### Sub-Milestone 2-D.1: Recommendation Model & Service Layer
- Create `task-backendd/models/RecommendationState.js` schema for tracking recommendation dismissals:
  - `projectId`, `ruleType`, `entityId`, `targetUserId`, `status` (`'DISMISSED'`), `dismissedAt`, `expiresAt`.
- Create `task-backendd/services/recommendationService.js`:
  - `generateProjectRecommendations(projectId, requestingUserId, options)`: Evaluates project rules (`REALLOCATE_WORKLOAD`, `REBREAKDOWN_STAGNANT_TASK`, `RESOLVE_BLOCKER`, `ADJUST_DUE_DATE`, `ARCHIVE_COMPLETED_PROJECT`), filters out dismissed states, and returns active recommendations.
  - `dismissRecommendation(projectId, ruleType, entityId, userId)`: Stores dismissal state.

### Sub-Milestone 2-D.2: Recommendation REST Endpoints (`task-backendd/routes/recommendations.js`)
- `GET /api/projects/:id/recommendations`: Returns active recommendations for project. Protected by `authorizeProject('MEMBER')`.
- `POST /api/projects/:id/recommendations/:recommendationId/dismiss`: Dismisses recommendation for user. Protected by `authorizeProject('MEMBER')`.
- Register router in `server.js` under `/api/projects`.

### Sub-Milestone 2-D.3: Advisory Frontend UI Components (`task-frontend/src/components/recommendations/`)
- `RecommendationCard.jsx`: Displays title, type badge, explanation, confidence score, and dismiss button.
- `ProjectRecommendationsWidget.jsx`: Renders active recommendations inside `ProjectOverview` or `Dashboard`.
- Integrate into project dashboard views as a read-only advisory section.

### Sub-Milestone 2-D.4: Comprehensive Test Suite
- Create `task-backendd/tests/recommendations.test.js`:
  - Test rule evaluator triggers (`REALLOCATE_WORKLOAD`, `REBREAKDOWN_STAGNANT_TASK`, `RESOLVE_BLOCKER`, `ADJUST_DUE_DATE`, `ARCHIVE_COMPLETED_PROJECT`).
  - Test dismissal persistence and filtering.
  - Test IDOR security (403 for non-project members).
- Create `task-frontend/src/components/recommendations/__tests__/recommendations.test.jsx`:
  - Test component rendering, advisory badges, dismissal button interaction.

---

## 3. Release Gate & Verification Strategy

Before tagging `phase2-d-stable`:

1. **Backend Tests**: $100\%$ pass rate (`npm test` in `task-backendd`).
2. **Frontend Tests**: $100\%$ pass rate (`npx vitest run` in `task-frontend`).
3. **Frontend Production Build**: `npm run build` in `task-frontend` succeeds with 0 warnings/errors.
4. **Security Verification**: IDOR tests confirm 403 Forbidden for unauthorized project access.
5. **Git Working Tree**: Clean working tree.

---

## 4. Rollback Strategy

If any regression occurs during Phase 2-D implementation:
1. Revert Git repository state to baseline tag `phase2-c-stable` (`d39d5e8284f4691e5cf4b545735dc34daf867110`).
2. Verify all Phase 2-C test suites.
