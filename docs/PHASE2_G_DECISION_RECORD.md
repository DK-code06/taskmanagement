# Phase 2-G Decision Record: Secure Message Search Architecture

## Architectural Decision Records (ADRs)

### ADR 1: Native MongoDB Search Engine Choice
- **Status**: `APPROVED`
- **Context**: Message search must be lightweight, fast, secure, and maintainable without introducing external infrastructure complexity.
- **Decision**: Use MongoDB Native query capabilities (`$regex` with `escapeRegex` or native `$text` index) on `Message.content`. Reject external search clusters (Elasticsearch/OpenSearch) or cloud-only Atlas Search dependencies for Phase 2-G MVP.

### ADR 2: Database-Constrained Query Authorization
- **Status**: `APPROVED`
- **Context**: Prevent IDOR vulnerabilities where users could attempt to search messages belonging to unauthorized users or conversations.
- **Decision**: All message search database queries MUST incorporate `{ $or: [{ fromUser: req.user.id }, { toUser: req.user.id }] }` directly into the MongoDB query framing. Never rely on post-fetch JavaScript filtering.

### ADR 3: ReDoS & Sanitization Security Strategy
- **Status**: `APPROVED`
- **Context**: Regular expression searches are vulnerable to ReDoS attacks if user inputs contain unescaped regex control characters.
- **Decision**: All user query inputs pass through the pre-existing `escapeRegex(query.trim())` utility function and are constrained to `2` to `100` characters.

### ADR 4: Cursor-Based Pagination Mechanics
- **Status**: `APPROVED`
- **Context**: Bounded pagination is required to prevent high memory consumption or un-paginated response dumps.
- **Decision**: Implement cursor-based pagination ordering by `{ createdAt: -1, _id: -1 }` with a default limit of 20 and a maximum limit of 50.

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
- **Decision**: Add a search input bar to `ChatDrawer.jsx` above the conversation list. Clicking a result opens that friend's conversation thread and scrolls to the message.

### ADR 8: Historical DM Access Policy for Removed Friends
- **Status**: `PENDING` (Requires user policy confirmation)
- **Context**: Should a user who is unfriended/removed retain search access to past 1-on-1 messages sent while they were friends?
- **Recommendation**: Default to querying messages where `fromUser === userId` OR `toUser === userId` regardless of active friendship status, as 1-on-1 DMs are historical records of past communication unless hard deleted.

### ADR 9: MongoDB Indexing Strategy
- **Status**: `APPROVED`
- **Context**: Ensure search queries perform efficiently as message volume grows.
- **Decision**: Recommend compound index `{ fromUser: 1, createdAt: -1 }` and `{ toUser: 1, createdAt: -1 }` on `Message` collection.

### ADR 10: Realtime Socket.IO Scope Exclusions
- **Status**: `APPROVED`
- **Context**: Determine whether message search requires Socket.IO events.
- **Decision**: Search is strictly HTTP request/response based. Socket.IO is not required for search query execution.
