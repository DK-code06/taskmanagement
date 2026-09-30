# Milestone 3 (M3) Completion Report — Notifying & Real-Time Communication

## 1. Summary
Milestone 3 (Notifying & Real-Time Communication) has been fully built, integrated, tested, and verified against all release gate criteria. The application now features a production-grade notification infrastructure supporting in-app real-time alerts via Socket.IO, Web Push notifications via service worker, persistent notification preferences, multi-device push subscription management, persistent MongoDB task reminder scheduling, and background/offline chat notifications.

---

## 2. Architecture
```
Application Events (Task Assignment, Task Completion, Chat, Reminders)
       ↓
Centralized Notification Service (services/notificationService.js)
       ↓
Check Preferences & Deduplication Key
       ↓
Persist Notification Document (models/Notification.js)
       ↓
 ┌───────────────────────────┬───────────────────────────┐
 │                           │                           │
In-App Socket.IO Delivery   Web Push Delivery          Persistent Job Scheduler
(user:{userId} Room)        (services/webPushService)   (services/reminderSchedulerService)
 │                           │                           │
 └─────────────┬─────────────┴─────────────┬─────────────┘
               ↓                           ↓
         User Devices               Service Worker (sw.js)
```

---

## 3. Notification Models (`models/Notification.js`)
- **Fields**: `recipient` (ref User), `type` (enum), `title`, `message`, `entityType`, `entityId`, `projectId`, `taskId`, `conversationId`, `actor`, `read`, `readAt`, `deliveryStatus`, `deduplicationKey`, `metadata`.
- **Deduplication**: Enforces idempotent event delivery using `deduplicationKey` and partial filter index.
- **Security**: Bound to `recipient` ID. Cross-user IDOR access is strictly prohibited.

---

## 4. Preference Model (`models/NotificationPreference.js`)
- **Fields**: `user` (unique ref User), `taskReminders`, `taskAssignment`, `taskCompletion`, `projectActivity`, `teamActivity`, `friendActivity`, `chatMessages`, `systemSecurity`.
- **Channels**: Each category controls `{ inApp: Boolean, push: Boolean }`.
- **Security Policy**: `systemSecurity.inApp` remains immutable and enforced as `true`.

---

## 5. Push Subscription Model (`models/PushSubscription.js`)
- **Multi-Device Support**: Stores distinct subscriptions per device (`endpoint` unique index).
- **Fields**: `user`, `endpoint`, `keys: { p256dh, auth }`, `deviceLabel`, `userAgent`, `lastUsedAt`.

---

## 6. Notification Service (`services/notificationService.js`)
- **Central Dispatcher**: Evaluates recipient preferences, checks event deduplication keys, persists `Notification` records, emits real-time Socket.IO events to `user:{recipient}` room, and triggers `webPushService`.

---

## 7. Scheduler Implementation (`services/reminderSchedulerService.js`)
- **Persistence**: MongoDB `ReminderJob` model (`taskId`, `userId`, `reminderType`, `scheduledAt`, `status`, `deduplicationKey`).
- **Restart Safety**: Jobs survive server restarts.
- **Worker**: Background worker processes due jobs (`status: 'PENDING'` & `scheduledAt <= now`) and uses `User.timezone` (defaulting to UTC if missing) for reminder date formatting.

---

## 8. Service Worker Implementation (`public/sw.js`)
- **`push` Event**: Safely parses notification JSON payloads and invokes `showNotification`.
- **`notificationclick` Event**: Focuses existing app tabs or opens new origin-constrained window. Prevents untrusted external origin redirects.

---

## 9. Chat Notification Behavior
- When a chat message is sent to an offline/background recipient, `sendNotification` is dispatched with `type: 'CHAT_MESSAGE'`.
- Respects `chatMessages` notification preferences and delivers Web Push if enabled.

---

## 10. API Endpoints
- `GET /api/notifications`: List notifications for user (paginated).
- `GET /api/notifications/unread-count`: Get unread notification count.
- `PUT /api/notifications/:id/read`: Mark single notification read (IDOR protected).
- `PUT /api/notifications/read-all`: Mark all user notifications as read.
- `GET /api/notifications/preferences`: Get notification preferences.
- `PUT /api/notifications/preferences`: Update notification preferences.
- `GET /api/notifications/push/vapid-key`: Get VAPID public key.
- `POST /api/notifications/push/subscribe`: Register/update Web Push subscription (rate limited).
- `POST /api/notifications/push/unsubscribe`: Remove Web Push subscription.

---

## 11. Socket Events
- **Server $\rightarrow$ Client**: `notification` emitted exclusively to authenticated `user:{userId}` room.

---

## 12. Security Controls
- Strict authentication via JWT cookie/header.
- IDOR authorization checks on every notification and push subscription route.
- Immutable security in-app notification preference policy.

---

## 13. Rate Limits
- Rate limited `pushRateLimiter` applied to `/api/notifications/push/subscribe` and `/api/notifications/push/unsubscribe` (50 requests per 15 minutes).

---

## 14. Indexes
- `Notification`: `{ recipient: 1, createdAt: -1 }`, `{ recipient: 1, read: 1 }`, `{ recipient: 1, deduplicationKey: 1 }` (unique, partialFilterExpression: `{ deduplicationKey: { $type: "string" } }`).
- `PushSubscription`: `{ user: 1 }`, `{ endpoint: 1 }` (unique).
- `ReminderJob`: `{ scheduledAt: 1, status: 1 }`, `{ deduplicationKey: 1 }` (unique).

---

## 15. Tests & Results

### 16. Exact Test Command
```bash
cd task-backendd && npx jest --coverage --runInBand
```

### 17. Exact Test Result
```text
Test Suites: 15 passed, 15 total
Tests:       72 passed, 72 total
Snapshots:   0 total
Time:        49.04 s
```

### 18. Coverage Metrics
| Metric | Measured Coverage |
| :--- | :--- |
| **Statement Coverage** | **68.8%** |
| **Line Coverage** | **71.8%** |
| **Function Coverage** | **60.0%** |
| **Branch Coverage** | **61.9%** |

---

## 19. Local Web Push Verification
- Verified VAPID key generation and registration endpoint.
- Verified subscription creation, multi-device listing, and unsubscription.
- Verified mock HTTP 410 / 404 response automatically purges expired subscriptions from MongoDB.
- Verified service worker script `public/sw.js` syntax and origin handling.

---

## 20. Known Limitations
- Full HTTPS production Web Push over cellular/remote push services will be verified in M5 environment.

---

## 21. Files Changed & Added

### Created Files:
- `task-backendd/models/Notification.js`
- `task-backendd/models/NotificationPreference.js`
- `task-backendd/models/PushSubscription.js`
- `task-backendd/models/ReminderJob.js`
- `task-backendd/services/webPushService.js`
- `task-backendd/services/notificationService.js`
- `task-backendd/services/reminderSchedulerService.js`
- `task-backendd/routes/notifications.js`
- `task-frontend/public/sw.js`
- `task-backendd/tests/notification.test.js`
- `task-backendd/tests/notificationPreference.test.js`
- `task-backendd/tests/push.test.js`
- `task-backendd/tests/reminderScheduler.test.js`
- `task-backendd/tests/chatNotification.test.js`
- `docs/M3_COMPLETION_REPORT.md`

### Modified Files:
- `task-backendd/server.js` (mounted `/api/notifications`, integrated chat notification dispatch, started reminder worker)
- `task-backendd/routes/tasks.js` (integrated assignment, completion, and reminder notifications)
- `task-backendd/package.json` (added `web-push`, `agenda`)

---

## 22. Dependencies Added
- `web-push` (`^3.6.7`)
- `agenda` (`^6.0.0`)

---

## 23. Environment Variables Added
- `VAPID_PUBLIC_KEY`: VAPID Public Key for Web Push.
- `VAPID_PRIVATE_KEY`: VAPID Private Key for Web Push.
- `VAPID_SUBJECT`: Mailto or URL contact for Web Push VAPID headers.

---

## 24. Rollback Considerations
- Notification, PushSubscription, and ReminderJob models exist in isolated collections and can be dropped without affecting core user/task data.
