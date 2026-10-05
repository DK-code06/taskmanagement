# Phase 2-D Decision Record — Advanced Project Recommendations Lifecycle

## 1. Architectural Decisions

### DECISION 1: Deterministic Rule Engine (Zero AI / LLM)
- **Decision**: Recommendations are generated strictly using deterministic, explainable condition evaluators based on database metrics and Phase 2-C intelligence outputs. No LLM, AI, or probabilistic models are used.
- **Status**: **APPROVED**

### DECISION 2: Reuse of Phase 2-C Intelligence Services
- **Decision**: Phase 2-D must directly invoke `taskDebtService.js` and `workloadIntelligenceService.js` to inspect task debt and workload utilization. Re-calculating or duplicating debt formulas is strictly prohibited.
- **Status**: **APPROVED**

### DECISION 3: Lightweight Recommendation State Persistence for Dismissals
- **Decision**: To prevent dismissed recommendations from re-appearing on page refresh, introduce a lightweight `RecommendationState` schema storing `(projectId, ruleType, entityId, targetUserId, status: 'DISMISSED', dismissedAt)`. Dynamic active recommendations are generated on-the-fly and filtered against stored dismissals.
- **Status**: **APPROVED**

### DECISION 4: Standardized Recommendation Types & Priorities
- **Decision**:
  - `REALLOCATE_WORKLOAD` (HIGH): Utilization $> 130\%$ vs $< 60\%$.
  - `REBREAKDOWN_STAGNANT_TASK` (HIGH): Task Debt Score $\ge 75$ or stagnation $> 5$ days.
  - `RESOLVE_BLOCKER` (MEDIUM): Status `BLOCKED` $> 48\text{h}$.
  - `ADJUST_DUE_DATE` (MEDIUM): Due in $< 24\text{h}$ with high debt score.
  - `ARCHIVE_COMPLETED_PROJECT` (LOW): $100\%$ project task completion on `ACTIVE` project.
- **Status**: **APPROVED**

### DECISION 5: Confidence & Explanation Standard
- **Decision**: Every recommendation object MUST contain:
  - `recommendationId`: Deterministic string identifier.
  - `type`: Recommendation type enum string.
  - `title`: Human-readable summary title.
  - `explanation`: Clear text explanation detailing exact data triggers.
  - `suggestedAction`: Advisory action suggestion text.
  - `confidenceScore`: Fixed rule confidence value between `0.80` and `1.00`.
  - `priority`: `HIGH`, `MEDIUM`, or `LOW`.
  - `isAdvisoryOnly`: `true`.
- **Status**: **APPROVED**

### DECISION 6: Recommendation Expiration Logic
- **Decision**: Active recommendations expire automatically when the underlying trigger condition resolves (e.g. task debt drops below threshold or task is completed). Dismissed recommendations remain stored until explicitly reset or 30 days elapse.
- **Status**: **APPROVED**

### DECISION 7: Authorization & IDOR Policy
- **Decision**: All recommendation endpoints MUST use `authorizeProject('MEMBER')` or `canAccessProject` for project-scoped recommendations and `authorizeTeam('Member')` for team recommendations. Unauthorized users receive `403 Forbidden`.
- **Status**: **APPROVED**

### DECISION 8: Notification System Integration
- **Decision**: High-priority recommendations (`priority: 'HIGH'`) can trigger lightweight in-app notifications via `notificationService.js` (`type: 'RECOMMENDATION'`). Notifications respect user preferences.
- **Status**: **APPROVED**

### DECISION 9: Read-Only Advisory UI Components
- **Decision**: UI components (`RecommendationCard.jsx`, `ProjectRecommendationsWidget.jsx`) are strictly advisory and read-only. Clicking a recommendation provides guidance or opens relevant modals; zero automatic task mutation is triggered.
- **Status**: **APPROVED**

### DECISION 10: Performance & Indexing Strategy
- **Decision**: Recommendation engine runs in single-pass aggregation over project tasks and consumes indexed fields. Database read overhead per project request is $< 20\text{ms}$.
- **Status**: **APPROVED**

---

## 2. Summary Decision Table

| Decision | Area | Choice | Status |
|---|---|---|---|
| 1 | Engine | 100% Deterministic Rule Evaluators (Zero AI) | APPROVED |
| 2 | Intelligence | Direct consumption of Phase 2-C Services | APPROVED |
| 3 | Persistence | `RecommendationState` for tracking user dismissals | APPROVED |
| 4 | Rules | 5 Standardized Types (`REALLOCATE_WORKLOAD`, etc.) | APPROVED |
| 5 | Payload | Standardized confidence, explanation & action fields | APPROVED |
| 6 | Lifecycle | Dynamic expiration upon condition resolution | APPROVED |
| 7 | Security | Strict `authorizeProject('MEMBER')` IDOR checks | APPROVED |
| 8 | Notifications | In-App dispatch for HIGH priority recommendations | APPROVED |
| 9 | UI | Read-Only advisory presentation widgets | APPROVED |
| 10 | Performance | Single-pass project aggregation | APPROVED |
