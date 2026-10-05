# Phase 2 Architectural Decision Record (ADR)

**Date**: October 5, 2026  
**Status**: Proposal for Review  
**Rule**: All Phase 2 architectural decisions remain **PENDING** until explicit user review and approval are granted. No dependent implementation will proceed before approval.

---

## Decision 1: AI Provider & SDK Integration

### Options
- **Option A**: Google Gen AI SDK (Gemini API) using `GEMINI_API_KEY`.
- **Option B**: OpenAI API SDK using `OPENAI_API_KEY`.
- **Option C**: Self-hosted local LLM via Ollama / LocalAI.

### Recommendation
- **Option A**: Gemini API provides fast inference, generous tier limits, and native SDK integration matching the Antigravity ecosystem.

### Status: PENDING

---

## Decision 2: AI Input Privacy & Execution Scoping

### Options
- **Option A**: Automatic background AI processing for all project tasks.
- **Option B**: Explicit user-triggered AI actions (advisory only) with PII sanitization.

### Recommendation
- **Option B**: AI operates strictly on explicit user action (e.g. clicking "Decompose Task with AI" or "Suggest Prioritization"). AI outputs are presented as draft suggestions and never mutate database state automatically.

### Status: PENDING

---

## Decision 3: Task Debt & Workload Intelligence Calculation Architecture

### Options
- **Option A**: Probabilistic AI evaluation of user productivity.
- **Option B**: Deterministic, rule-based backend calculations using persisted `Task` and `ActivityEvent` records.

### Recommendation
- **Option B**: Deterministic scoring guarantees 100% explainability, zero API costs, zero latency overhead, and complete testability.

### Status: PENDING

---

## Decision 4: Message Search Technology

### Options
- **Option A**: MongoDB Native Text Index on `Message` collection (`{ content: 'text' }`).
- **Option B**: MongoDB Atlas Search (Lucene-based).
- **Option C**: External Elasticsearch cluster.

### Recommendation
- **Option A**: Native MongoDB text index requires zero external infrastructure, zero extra costs, and integrates directly with existing Mongoose queries while enforcing strict conversation authorization (`$or: [{ fromUser: userId }, { toUser: userId }]`).

### Status: PENDING

---

## Decision 5: GitHub Integration Strategy

### Options
- **Option A**: Full bidirectional sync with automatic code push/pull.
- **Option B**: Event-driven Webhook receiver with OAuth 2.0 user linking, repository-to-project association, and Issue/PR status sync.

### Recommendation
- **Option B**: Provides clean, secure, event-driven visibility without complex merge-conflict resolution engines.

### Status: PENDING

---

## Decision 6: Focus Session Persistence

### Options
- **Option A**: Transient frontend-only Pomodoro timer state.
- **Option B**: Hybrid model — active timer state in local component state; completed focus sessions logged to `FocusSession` collection for productivity analytics.

### Recommendation
- **Option B**: Enables tracking deep-work time alongside task completions in personal analytics while keeping active timer controls responsive.

### Status: PENDING
