# Phase 2-E Implementation Plan — Opt-In AI Task Decomposition & Summarization

## 1. Plan Overview

This document defines the future implementation roadmap for **Phase 2-E — Opt-In AI Task Decomposition & Summarization**.

Implementation will begin **ONLY AFTER** receiving explicit user authorization.

---

## 2. Implementation Sub-Milestones & Deliverables

### Sub-Milestone 2-E.1: User Opt-In Consent Model
- Add `aiConsent: { type: Boolean, default: false }` to `User` schema (or preferences).
- Add endpoint `PUT /api/user/preferences/ai` allowing users to toggle AI consent.

### Sub-Milestone 2-E.2: Gemini Service Integration & Security Pipeline (`task-backendd/services/geminiService.js`)
- Initialize `@google/genai` or `@google/generative-ai` client using `process.env.GEMINI_API_KEY`.
- Implement `decomposeTaskWithAI(taskData)`: Sends task title/description framed in XML tags with structured JSON output instructions.
- Implement `summarizeTaskWithAI(taskData)`: Generates concise executive summary of task and activity history.
- Implement input sanitization pipeline to strip prompt injection phrases and credentials.
- Implement 10-second `AbortController` timeout and fallback handling.

### Sub-Milestone 2-E.3: AI REST Endpoints (`task-backendd/routes/ai.js`)
- `GET /api/ai/status`: Check if AI features are enabled for user and backend key is configured.
- `POST /api/ai/tasks/:id/decompose`: Protected by `canAccessTask` and user `aiConsent` check.
- `POST /api/ai/tasks/:id/summarize`: Protected by `canAccessTask` and user `aiConsent` check.
- Rate-limited to max 10 requests / 15m / user.

### Sub-Milestone 2-E.4: Frontend Advisory UI Components (`task-frontend/src/components/ai/`)
- `AIConsentToggle.jsx`: Toggle switch in user settings/preferences.
- `AIDecomposeModal.jsx`: Renders preview list of suggested subtasks with checkboxes and "Add Selected Subtasks" action button.
- `AISummarizeWidget.jsx`: Displays generated summary draft with "Copy Summary" or "Save to Notes" button.

### Sub-Milestone 2-E.5: Comprehensive Test Suite & Release Gate
- Create `task-backendd/tests/ai.test.js`:
  - Test consent validation (403 when consent false).
  - Test IDOR security (403 for non-project members).
  - Test prompt injection defense and JSON output validation.
  - Test API key missing / timeout fallback behavior.
- Create `task-frontend/src/components/ai/__tests__/ai.test.jsx`:
  - Test consent toggle, subtask preview selection, and advisory action rendering.

---

## 3. Release Gate & Verification Strategy

Before tagging `phase2-e-stable`:
1. **Backend Tests**: $100\%$ pass rate (`npm test` in `task-backendd`).
2. **Frontend Tests**: $100\%$ pass rate (`npx vitest run` in `task-frontend`).
3. **Frontend Production Build**: `npm run build` in `task-frontend` succeeds with 0 warnings/errors.
4. **Security Verification**: IDOR tests confirm 403 Forbidden for unauthorized task AI requests.
5. **Git Working Tree**: Clean working tree.

---

## 4. Rollback Strategy

If any regression occurs during Phase 2-E implementation:
1. Revert Git repository state to baseline tag `phase2-d-stable` (`cc5aee7e5373ce7467226f3ab2186a7b2b41c8b5`).
2. Verify all Phase 2-D test suites.
