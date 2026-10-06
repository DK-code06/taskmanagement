# Phase 2-G Decision Record: Secure Message Search Architecture (Revision)

## Architectural Decision Records (ADRs)

### ADR 1: Primary Search Engine Choice — MongoDB Native `$text` Index
- **Status**: `APPROVED`
- **Context**: Unanchored `$regex` queries force $O(N)$ full collection scans, creating performance bottlenecks as the `Message` collection grows.
- **Decision**: Use MongoDB Native `$text` search index on `Message.content`. Reject unanchored `$regex` for production search. External search clusters (Elasticsearch/OpenSearch) remain out of scope.

### ADR 2: Database-Constrained Query Authorization
- **Status**: `APPROVED`
- **Context**: Prevent IDOR vulnerabilities where users could attempt to search messages belonging to unauthorized conversations.
- **Decision**: All message search queries MUST constrain the database lookup using `{ $or: [{ fromUser: req.user.id }, { toUser: req.user.id }] }`. `friendId` is strictly a filter and never an authorization boundary.

### ADR 3: Query Sanitization & Length Bounds
- **Status**: `APPROVED`
- **Context**: Prevent invalid or overly broad search queries from overloading database resources.
- **Decision**: Enforce server-side length validation (min 2, max 100 characters). Whitespace-only queries return `HTTP 400 Bad Request`.

### ADR 4: Cursor-Based Pagination & Relevance Ranking
- **Status**: `APPROVED`
- **Context**: Bounded pagination is required for stable performance.
- **Decision**: Implement cursor-based pagination using `before` (ISO date cursor on `createdAt`) with a default limit of 20 and a maximum limit of 50. Order results by `textScore` and `createdAt`.

### ADR 5: Data Minimization in Search Results
- **Status**: `APPROVED`
- **Context**: Search results must not expose unneeded user metadata or internal attributes.
- **Decision**: Return minimal necessary fields: `_id`, `fromUser` (populated `_id`, `username`), `toUser` (populated `_id`, `username`), `content`, and `createdAt`.

### ADR 6: Search API Endpoint Architecture
- **Status**: `APPROVED`
- **Context**: Provide a clean REST endpoint for global and scoped conversation search.
- **Decision**: Expose `GET /api/messages/search?q=<query>&friendId=<optional>&limit=20&before=<createdAt_iso>`.

### ADR 7: Frontend UX Integration in ChatDrawer
- **Status**: `APPROVED`
- **Context**: Users need a seamless way to search DMs from the existing chat drawer.
- **Decision**: Add a search input bar to `ChatDrawer.jsx` above the conversation list. Clicking a result opens that friend's conversation thread and jumps to the message.

### ADR 8: Resolution of Historical DM Policy
- **Status**: `APPROVED`
- **Context**: Determine searchability of 1-on-1 direct messages after friendship removal.
- **Decision**: Historical 1-on-1 direct messages remain searchable by both original participants (`fromUser` and `toUser`) even after friendship removal. Inspection confirms `Message` model has no soft/hard delete flags; this maintains 100% parity with existing chat storage access.

### ADR 9: MongoDB Indexing Strategy
- **Status**: `APPROVED`
- **Context**: Ensure search queries perform efficiently without redundant B-tree index overhead.
- **Decision**: Define single-field B-tree indexes `{ fromUser: 1, createdAt: -1 }` and `{ toUser: 1, createdAt: -1 }` alongside the native `$text` index on `content`.

### ADR 10: Realtime Socket.IO Scope Exclusions
- **Status**: `APPROVED`
- **Context**: Determine whether message search requires Socket.IO events.
- **Decision**: Search is strictly HTTP request/response based. Socket.IO is not required for search query execution.
