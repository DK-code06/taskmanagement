# Phase 2-G Architecture & Security Audit: Secure Message Search (Revision)

## 1. Executive Summary & Baseline Verification

### Verified Production Checkpoint
- **Authoritative Baseline Tag**: `phase2-f-stable`
- **Authoritative Baseline Commit**: `b8daf7a9cca040263769f289b19311c0c627e137`
- **Current Audit Commit**: `4c3b6c0cda6f968a68a647599a0b425a07d8d169`
- **Git Working Tree**: Clean
- **Test Baseline**:
  - Backend: 24 / 24 test suites passed (147 / 147 tests)
  - Frontend: 10 / 10 test suites passed (53 / 53 tests)
  - Production Build: PASSED (0 build warnings/errors)

---

## 2. Re-Evaluation of Search Engine: MongoDB `$text` vs `$regex`

> [!IMPORTANT]
> **Production Search Engine Decision: MongoDB Native `$text` Index**
> Unanchored case-insensitive regular expression searches (`$regex: ...`, `$options: 'i'`) cannot utilize standard B-tree index prefixes. On a growing `Message` collection, `$regex` forces MongoDB to perform full collection scans ($O(N)$ complexity), resulting in high CPU utilization, memory pressure, and degraded query response times.

### Evaluation of Options

| Search Engine Option | Performance & Scaling | Operational Complexity | Typo / Substring Behavior | Decision |
|---|---|---|---|---|
| **Option A: MongoDB Native `$text` Index** | **High ($O(\log N)$ text index scan)** | **Zero (Built-in)** | **Word stems & phrase search** | **RECOMMENDED (MVP)** |
| **Option B: Unanchored `$regex`** | Poor ($O(N)$ collection scan) | Zero | Substring / Infix matching | ❌ Rejected for Prod |
| **Option C: MongoDB Atlas Search** | High | Medium (Cloud-only) | Full Fuzzy & Typo | Deferred (Future P2) |
| **Option D: External Engine (Elasticsearch)**| High | Very High (New cluster) | Full Fuzzy & Semantic | ❌ Out of Scope |

### Native `$text` Capabilities & Explicit Limitations
- **Capabilities**:
  - Tokenized word matching and root stemming (e.g., searching "deploy" matches "deployment", "deployed").
  - Exact phrase matching using quoted strings (e.g., `"release candidate"`).
  - Relevance ranking via MongoDB `textScore`.
- **Explicit Limitations**:
  - **No arbitrary infix/substring matching**: Searching "auth" will **not** match "authentication" (requires full word or stem).
  - **No typo tolerance or fuzzy search**: Misspelled words (e.g., "deplyment") will not yield results.
  - **No semantic / vector search**: AI embeddings are out of scope.

---

## 3. Authorization & IDOR Architecture

> [!CRITICAL]
> **Database-Constrained Authorization Rule**
> Authorization constraints MUST be applied directly to the MongoDB query framing. `friendId` is strictly a filter parameter and MUST NEVER be trusted as an authorization boundary.

### Database Query Construction
Every search request frames the query using the authenticated user's ID:

```javascript
const searchCondition = {
  $and: [
    {
      $or: [
        { fromUser: req.user.id },
        { toUser: req.user.id }
      ]
    },
    {
      $text: { $search: query }
    }
  ]
};
```

If an optional `friendId` filter is provided:
1. Validate `friendId` format (valid MongoDB `ObjectId`).
2. Apply scoping: `{ $or: [{ fromUser: req.user.id, toUser: friendId }, { fromUser: friendId, toUser: req.user.id }] }`.
3. If the specified `friendId` does not match conversations where `req.user.id` is a participant, the query naturally evaluates to 0 results, eliminating cross-user leakage.

---

## 4. Resolution of Historical DM Policy (ADR 8)

### Final MVP Decision: Historical DM Persistence
- **Policy**: Historical 1-on-1 direct messages remain searchable by both original participants (`fromUser` and `toUser`) even if friendship status is subsequently removed.
- **Audit Findings**:
  - Inspection of `models/Message.js` confirms that messages currently have **no soft-delete (`deletedAt`) or hard-delete semantics**. DMs are permanent historical records of communication between two users.
  - Maintaining searchability for historical DMs ensures **100% parity** between normal chat history retrieval (`GET /api/friends/chat/:friendId`) and search access (`GET /api/messages/search`), avoiding any access discrepancy.

---

## 5. Index Strategy & Redundancy Prevention

To support fast, authorized text search without creating redundant B-tree indexes, the following minimal index set is proposed for `models/Message.js`:

1. **Text Search Index**:
   ```javascript
   messageSchema.index({ content: "text" });
   ```
2. **User Conversation & Order Indexes**:
   ```javascript
   messageSchema.index({ fromUser: 1, createdAt: -1 });
   messageSchema.index({ toUser: 1, createdAt: -1 });
   ```

### Rationale
- The single-field B-tree indexes on `fromUser` and `toUser` accelerate direct message retrieval for normal chat threads and compound with `$or` authorization filters.
- The `content: "text"` index accelerates word-stem text evaluation across the collection.

---

## 6. Proposed API Contract & Validation

```http
GET /api/messages/search?q=<query>&friendId=<optional>&limit=20&before=<createdAt_iso>
Authorization: Bearer <jwt_token>
```

### Validation Rules
- `q`: Required string, length **2 to 100 characters**. Whitespace-only queries return `HTTP 400 Bad Request`.
- `limit`: Integer between 1 and 50 (default: 20).
- `before`: Optional ISO date string for cursor pagination.

---

## 7. Scope Categorization

### P0 — Must Resolve Before Coding
- Database-level query authorization constraint (`$or: [{ fromUser }, { toUser }]`).
- Server-side query validation (2-100 chars).
- MongoDB `$text` index definition on `Message.content`.

### P1 — Required for Phase 2-G MVP
- `GET /api/messages/search` API endpoint with cursor pagination.
- Search input bar in `ChatDrawer.jsx`.
- Results list rendering matching snippets, sender, and timestamps.
- Click-to-jump thread navigation opening target chat.

### P2 — Future Enhancements
- Date range filter (last 7 days, last 30 days).
- Quoted phrase helper UI.

### P3 — Explicitly Out of Scope
- Unanchored `$regex` scans in production.
- External search engine clusters (Elasticsearch/OpenSearch).
- AI vector / semantic search, OCR, voice transcription.
