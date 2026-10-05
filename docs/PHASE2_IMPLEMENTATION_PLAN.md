# Phase 2 Implementation Plan — Executable Roadmap

This document outlines the proposed multi-stage implementation roadmap for Phase 2 capabilities. Implementation will proceed only after explicit user approval.

---

## Roadmap Overview

```
Phase 2-A: Audit & Architecture (CURRENT)
    ↓
Phase 2-B: Intelligence Infrastructure & Activity Event Enhancements
    ↓
Phase 2-C: Task Debt & Workload Intelligence
    ↓
Phase 2-D: Advanced Project Recommendations
    ↓
Phase 2-E: AI / LLM Capabilities (Task Decomposition & Assistance)
    ↓
Phase 2-F: Focus Mode & Deep Work Timer
    ↓
Phase 2-G: Secure Message Search
    ↓
Phase 2-H: GitHub Integration MVP
```

---

## Detailed Milestone Proposals

### Phase 2-B — Intelligence Infrastructure & Activity Event Enhancements
- **Objective**: Establish foundational backend data aggregators, compound database indexes on `ActivityEvent`, and shared metrics utilities.
- **Scope**:
  - Add compound indexes to `ActivityEvent` (`{ projectId: 1, eventType: 1, createdAt: -1 }`).
  - Create `services/intelligenceService.js` helper.
- **Files Affected**: `task-backendd/models/ActivityEvent.js`, `task-backendd/services/intelligenceService.js`.
- **Release Gate**: 100% backend test pass; zero query performance regression.

### Phase 2-C — Task Debt & Workload Intelligence
- **Objective**: Implement deterministic Task Debt Index (0–100) and user/team Workload Capacity metrics.
- **Scope**:
  - `GET /api/analytics/debt/project/:id`
  - `GET /api/analytics/workload/team/:id`
  - Frontend components: `TaskDebtWidget.jsx`, `WorkloadWidget.jsx`.
- **Release Gate**: Unit & integration tests for debt scoring and capacity math; IDOR authorization verified.

### Phase 2-D — Advanced Project Recommendations
- **Objective**: System suggestions for task reassignments, milestone completion, and stale task handling.
- **Scope**:
  - Recommendation lifecycle: `PROPOSED` → `ACCEPTED` / `DISMISSED`.
  - Endpoint: `GET /api/recommendations/project/:id`, `POST /api/recommendations/:id/accept`.
  - Frontend: `RecommendationPanel.jsx`.
- **Release Gate**: IDOR protection verified; activity logging on accepted recommendations.

### Phase 2-E — AI / LLM Capabilities
- **Objective**: Opt-in, advisory AI task decomposition, natural language parsing, and project summaries using Google Gen AI SDK (Gemini API).
- **Scope**:
  - Service: `services/aiService.js` (with timeout & fallback).
  - Endpoints: `POST /api/ai/decompose-task`, `POST /api/ai/parse-task`.
  - Frontend: `AIDecomposeModal.jsx`, `AIAssistantWidget.jsx`.
- **Release Gate**: Prompt sanitization verified; fallback behavior tested when API key missing/invalid.

### Phase 2-F — Focus Mode & Deep Work Sessions
- **Objective**: Pomodoro deep-focus timer with notification suppression.
- **Scope**:
  - Model: `FocusSession.js`.
  - Endpoint: `POST /api/focus/session`.
  - Frontend: `FocusModeDrawer.jsx`, `FocusTimer.jsx`.
- **Release Gate**: Notification suppression verified; session history tests passing.

### Phase 2-G — Secure Message Search
- **Objective**: Full-text search across direct messages.
- **Scope**:
  - Index: Text index on `Message` collection `{ content: 'text' }`.
  - Endpoint: `GET /api/friends/messages/search?q=query`.
- **Release Gate**: User conversation isolation verified (cannot search un-friended or unauthorized user chats).

### Phase 2-H — GitHub Integration MVP
- **Objective**: Link GitHub repositories to Projects, verify webhooks, and sync Issue/PR status.
- **Scope**:
  - Model: `GitHubConnection.js` (encrypted tokens).
  - Webhook route: `POST /api/integrations/github/webhook`.
  - Frontend: `GitHubRepoSelector.jsx`.
- **Release Gate**: HMAC signature verification tested; token AES-256 encryption verified.
