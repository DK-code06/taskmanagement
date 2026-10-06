# Phase 2-G Architecture & Security Audit: Secure Message Search

## 1. Executive Summary & Baseline Verification

### Verified Production Checkpoint
- **Authoritative Baseline Tag**: `phase2-f-stable`
- **Authoritative Baseline Commit**: `b8daf7a9cca040263769f289b19311c0c627e137`
- **Git Working Tree**: Clean
- **Test Baseline**:
  - Backend: 24 / 24 test suites passed (147 / 147 tests)
  - Frontend: 10 / 10 test suites passed (53 / 53 tests)
  - Production Build: PASSED (0 build warnings/errors)

---

## 2. Existing Chat Architecture Audit Findings

### A. Backend Architecture (`task-backendd`)
1. **Message Model (`models/Message.js`)**:
   - Fields: `fromUser` (`ObjectId`, ref `User`), `toUser` (`ObjectId`, ref `User`), `content` (`String`), `createdAt`, `updatedAt`.
   - Simple, lightweight direct messaging schema between two users.
2. **Friends & Chat Routes (`routes/friends.js`)**:
   - `GET /api/friends/chat/:friendId`: Returns chat history between logged-in user and an accepted friend.
   - Enforces friendship check: `currentUser.friends.some(f => f.user.equals(friendId) && f.status === 'accepted')`.
   - Contains pre-existing regex escaping utility `escapeRegex(string)`:
     ```javascript
     const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
     ```
3. **Socket.IO Chat Real-Time Transport (`server.js`)**:
   - Handles `sendMessage`, `joinRoom`, and `receiveMessage` Socket.IO events.
   - Restricts messages to verified accepted friends (`isFriend` check).

### B. Frontend Architecture (`task-frontend`)
1. **Chat Drawer (`components/chat/ChatDrawer.jsx`)**:
   - Drawer container displaying active friend conversations or single active friend chat thread.
2. **Message Components (`MessageList.jsx`, `MessageComposer.jsx`, `ConversationList.jsx`)**:
   - Render chat history bubbles, typing indicators, and message submission forms.

---

## 3. Existing Message Data Model & Search Scope

### Current Data Model
| Field | Type | Description | Searchable |
|---|---|---|---|
| `_id` | `ObjectId` | Unique message identifier | No |
| `fromUser` | `ObjectId` | Sender user ID | Filter-only |
| `toUser` | `ObjectId` | Recipient user ID | Filter-only |
| `content` | `String` | Message text content | **YES** |
| `createdAt` | `Date` | Timestamp message was sent | Sort/Filter |
| `updatedAt` | `Date` | Timestamp message was updated | Sort/Filter |

### Search Scope Boundaries
- **Direct Messages Only**: Users can ONLY search messages in conversations where they are either the sender (`fromUser === userId`) or recipient (`toUser === userId`).
- **Global & Scoped Search**:
  - Global Search: Search across all DMs belonging to the logged-in user.
  - Scoped Search: Search within a specific friend's conversation (`friendId`).

---

## 4. Security & IDOR Audit

> [!CRITICAL]
> **Database-Constrained Authorization Rule**
> The database query ITSELF must strictly enforce ownership boundaries. Under no circumstances may authorization rely on post-fetch JavaScript filtering or frontend hiding.

### Database Query Constraints
Every search request must construct a MongoDB query framed by the user's ID:

```javascript
const queryCondition = {
  $and: [
    {
      $or: [
        { fromUser: req.user.id },
        { toUser: req.user.id }
      ]
    },
    {
      content: { $regex: escapedSearchTerm, $options: 'i' }
    }
  ]
};
```

If a user supplies an optional `friendId` filter:
1. Verify `friendId` is a valid accepted friend (or `req.user.id`).
2. Constrain query: `{ $or: [{ fromUser: req.user.id, toUser: friendId }, { fromUser: friendId, toUser: req.user.id }] }`.

This guarantees 0% cross-user message leakage, even if a malicious user alters query parameters or guesses conversation IDs.

---

## 5. Search Engine Evaluation

| Criterion | Option A: MongoDB Native `$text` Index | Option B: MongoDB Atlas Search | Option C: External Search (Elasticsearch) | Option D: Indexed `$regex` + `escapeRegex` |
|---|---|---|---|---|
| **Dependencies** | None (Built-in) | Cloud Atlas Only | High (New Service) | None (Built-in) |
| **Operational Complexity**| Zero | Low (Cloud only) | Very High | Zero |
| **Substring Matching** | Whole word stem only | Full fuzzy | Full fuzzy | Exact substring |
| **Security / IDOR** | Native `$or` filter | Native pipeline | Manual sync filter | Native `$or` filter |
| **Local Dev Support** | Full | Partial / Cloud | Requires Docker | Full |
| **Recommendation** | **Suitable** | Optional Cloud | ❌ Excess Burden | **RECOMMENDED (MVP)** |

### Conclusion & Recommendation
MongoDB Native Query with `$regex` (sanitized using existing `escapeRegex`) or Native `$text` search index is the **simplest, safest, and most production-appropriate solution**. Zero new external services or npm dependencies are needed.

---

## 6. ReDoS & Query Validation Security

### ReDoS Mitigation
- User input MUST be passed through `escapeRegex(query.trim())` before building the MongoDB `$regex` condition.
- Enforce strict server-side query length limits:
  - Minimum length: `2` characters.
  - Maximum length: `100` characters.
  - Reject whitespace-only or empty queries (`HTTP 400 Bad Request`).

---

## 7. Proposed API Contract

```http
GET /api/messages/search?q=<query>&friendId=<optional>&limit=20&before=<createdAt_iso>
Authorization: Bearer <jwt_token>
```

### Request Parameters
- `q` (required, string, 2-100 chars): Search term.
- `friendId` (optional, string ObjectId): Scope search to specific friend conversation.
- `limit` (optional, integer, default 20, max 50): Page size.
- `before` (optional, ISO date string): Cursor pagination marker.

### Response Shape
```json
{
  "query": "deployment",
  "total": 1,
  "results": [
    {
      "_id": "60d5ecb9f123456789abcdef",
      "fromUser": { "_id": "60d5ecb9f123456789abc001", "username": "alice" },
      "toUser": { "_id": "60d5ecb9f123456789abc002", "username": "bob" },
      "content": "The deployment pipeline passed all backend tests.",
      "createdAt": "2026-10-06T09:30:00.000Z"
    }
  ]
}
```

---

## 8. Pagination & Data Minimization

- **Cursor Pagination**: Uses `createdAt` ISO string cursor (`before`) for stable, scalable performance without offset degradation.
- **Data Minimization**: Returns only necessary display fields (`_id`, `fromUser`, `toUser`, `content`, `createdAt`). Excludes sensitive user metadata or security tokens.

---

## 9. Scope Categorization

### P0 — Must Resolve Before Coding
- Database-level query authorization constraint (`$or: [{ fromUser }, { toUser }]`).
- ReDoS protection via `escapeRegex` and 2-100 char limit bounds.

### P1 — Required for Phase 2-G MVP
- `GET /api/messages/search` API endpoint.
- Search input bar in `ChatDrawer.jsx`.
- Results list with message snippets and timestamps.
- Click-to-jump navigation opening the target conversation thread.

### P2 — Future Enhancements
- Highlighting matched search terms in message text.
- Filter by date range (e.g. last 7 days, last 30 days).

### P3 — Explicitly Out of Scope
- AI semantic search / vector search.
- Image OCR or attachment search.
- Voice message transcription search.
- External search engine clusters (Elasticsearch/OpenSearch).
