# Phase 2-E Decision Record — AI/LLM Architecture & Security Audit

## 1. Architectural Decisions

### DECISION E-1: Provider & API Key Security
- **Decision**: Use Google Gemini API via server-side `GEMINI_API_KEY` stored exclusively in `.env`. Zero key exposure to client applications.
- **Status**: **APPROVED (Baseline)**

### DECISION E-2: Explicit Opt-In User Consent Model
- **Decision**: Require explicit user consent (`aiConsent: true` on User model/preferences) before processing any AI request for a user. Default is `false` (Opt-In).
- **Status**: **PENDING (REQUIRES USER APPROVAL)**

### DECISION E-3: Read-Only Advisory Preview UX Architecture
- **Decision**: AI responses (subtasks, summaries) are returned as transient previews in the UI. User must explicitly click "Add Selected Subtasks" or "Save Summary". LLM never directly mutates database records.
- **Status**: **PENDING (REQUIRES USER APPROVAL)**

### DECISION E-4: Prompt Injection Protection & Input Sanitization Pipeline
- **Decision**: Sanitize user inputs and enclose task data in `<user_task_input>` tags with system instructions to treat enclosed content strictly as data.
- **Status**: **PENDING (REQUIRES USER APPROVAL)**

### DECISION E-5: Server-Side Structured Output JSON Schema Validation
- **Decision**: Require Gemini to output JSON adhering to strict schemas for decomposition and summarization, validated on the backend before returning to the UI.
- **Status**: **PENDING (REQUIRES USER APPROVAL)**

### DECISION E-6: Rate Limiting, 10s Abort Timeout & Token Cost Control
- **Decision**: Enforce max 10 requests / 15m / user, `maxOutputTokens: 1000`, `temperature: 0.2`, and 10-second `AbortController` timeouts.
- **Status**: **PENDING (REQUIRES USER APPROVAL)**

### DECISION E-7: Strict Separation of Authoritative Business Data & AI Logic
- **Decision**: Task state, status, points, rewards, permissions, and project data remain 100% controlled by deterministic backend logic.
- **Status**: **APPROVED (Baseline)**

### DECISION E-8: IDOR & Access Control on AI Endpoints
- **Decision**: AI endpoints (`/api/ai/*`) enforce existing `canAccessTask` / `authorizeProject('MEMBER')` checks. Unauthorized users receive `403 Forbidden`.
- **Status**: **APPROVED (Baseline)**

---

## 2. Architectural Decision Summary Matrix

| Decision ID | Topic | Proposed Option | Status |
|---|---|---|---|
| DECISION E-1 | Provider | Google Gemini API via `GEMINI_API_KEY` in `.env` | APPROVED (Baseline) |
| DECISION E-2 | Consent Model | Opt-In consent flag (`aiConsent: boolean`) | PENDING USER APPROVAL |
| DECISION E-3 | UX Model | Read-only advisory preview (manual user confirmation) | PENDING USER APPROVAL |
| DECISION E-4 | Prompt Security | XML tag boundary framing + system instruction rules | PENDING USER APPROVAL |
| DECISION E-5 | Validation | Server-side structured JSON schema parsing | PENDING USER APPROVAL |
| DECISION E-6 | Cost & Limits | 10 req/15m/user, 1000 max tokens, 10s timeout | PENDING USER APPROVAL |
| DECISION E-7 | Data Isolation | Authoritative DB data strictly deterministic | APPROVED (Baseline) |
| DECISION E-8 | Security | `canAccessTask` IDOR protection on all AI endpoints | APPROVED (Baseline) |
