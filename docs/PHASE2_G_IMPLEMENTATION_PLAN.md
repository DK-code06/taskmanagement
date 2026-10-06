# Phase 2-G Implementation Plan: Secure Message Search

## Overview
This implementation plan defines the step-by-step technical roadmap for building Phase 2-G (Secure Message Search) upon explicit authorization. No application code is modified during this audit phase.

---

## Step-by-Step Technical Roadmap

### Step 1: Database Indexes (`task-backendd/models/Message.js`) [MODIFY]
- Add compound indexes for message search performance:
  ```javascript
  messageSchema.index({ fromUser: 1, createdAt: -1 });
  messageSchema.index({ toUser: 1, createdAt: -1 });
  ```

### Step 2: Search Controller & Route (`task-backendd/routes/friends.js`) [MODIFY]
- Implement `GET /api/messages/search`:
  - Validate query parameter `q` (min 2, max 100 chars).
  - Sanitize query using `escapeRegex(q.trim())`.
  - Build database-constrained query:
    ```javascript
    const searchFilter = {
      $and: [
        { $or: [{ fromUser: req.user.id }, { toUser: req.user.id }] },
        { content: { $regex: sanitizedQuery, $options: 'i' } }
      ]
    };
    ```
  - Apply optional `friendId` scope if passed.
  - Apply cursor pagination (`before` ISO date string) and limit (default 20, max 50).
  - Return populated message search results.

### Step 3: Frontend Search Components (`task-frontend`) [NEW]
- Create `src/components/chat/MessageSearchInput.jsx`:
  - Search input with clear button, debounced API calls, and loading spinner.
- Create `src/components/chat/MessageSearchResults.jsx`:
  - Results list showing snippet, sender name, timestamp, and click-to-navigate action.

### Step 4: Chat Drawer Integration (`task-frontend/src/components/chat/ChatDrawer.jsx`) [MODIFY]
- Render `MessageSearchInput` at top of `ChatDrawer`.
- When a search result is selected, set `selectedFriend` and highlight/focus the matching message.

### Step 5: Automated Test Suites [NEW]
- Backend Jest suite: `task-backendd/tests/messageSearch.test.js`
  - Tests query validation, IDOR isolation, cross-user leakage prevention, pagination, and performance.
- Frontend Vitest suite: `task-frontend/src/components/chat/__tests__/messageSearch.test.jsx`
  - Tests search bar input, debounced queries, result rendering, and conversation navigation.

---

## Verification & Release Gate Checklist

1. **Backend Tests**: 24 existing suites + 1 new message search suite (`100% PASS`).
2. **Frontend Tests**: 10 existing suites + 1 new search UI suite (`100% PASS`).
3. **Production Build**: Vite production build (`0 errors`).
4. **Git Discipline**: Clean working tree and tag `phase2-g-stable`.
