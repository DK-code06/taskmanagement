# Production Deployment Guide — Task Management System

This document provides complete production deployment instructions, environment variable specifications, configuration requirements, security checklists, and rollback strategies for the Task Management System.

---

## 1. System Architecture

The application is structured as a decoupled web platform:
- **Frontend**: Single-Page Application (SPA) built with React 19, Vite 7, and centralized design system primitives.
- **Backend**: Express.js modular monolith providing RESTful APIs, JWT authentication, and background worker services.
- **Database**: MongoDB (Mongoose ODM) storing user profiles, projects, milestones, tasks, subtasks, activity events, reward events, notifications, and reminders.
- **Real-Time Communication**: Socket.IO server utilizing user-scoped channels (`user:${userId}`).
- **Infrastructure Services**: Centralized notification service, Web Push service (VAPID), and persistent reminder scheduler worker.

---

## 2. Required Environment Variables

Below is the complete inventory of environment variables required in production. Do not expose actual production secrets in source control.

| Environment Variable | Purpose | Example Value (Do NOT copy secrets) |
| :--- | :--- | :--- |
| `PORT` | HTTP Server Port | `5000` |
| `NODE_ENV` | Environment mode | `production` |
| `CLIENT_ORIGIN` | Production Frontend Origin for CORS & Socket.IO | `https://tasks.yourdomain.com` |
| `MONGO_URI` | Production MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/taskdb` |
| `JWT_SECRET` | Secret key for signing access JWT tokens | `super-secret-jwt-key-min-32-chars` |
| `VAPID_PUBLIC_KEY` | Web Push VAPID Public Key | `BEl62iUYgQ...` |
| `VAPID_PRIVATE_KEY` | Web Push VAPID Private Key | `K8n_9xP...` |
| `VAPID_SUBJECT` | Web Push contact mailto URI | `mailto:admin@yourdomain.com` |

---

## 3. Authentication Configuration

- **Access Token**: Short-lived JWT (15-minute expiration) passed via `Authorization: Bearer <token>` header.
- **Refresh Token**: HTTP-only, secure, SameSite cookie validating against `User.sessionVersion`.
- **Session Revocation**: Password changes or explicit "logout-all" actions increment `sessionVersion`, immediately revoking all issued access and refresh tokens.

---

## 4. CORS Configuration

- Production origin must match `process.env.CLIENT_ORIGIN`.
- `credentials: true` must be enabled to allow HTTP-only refresh cookies.
- Helmet security middleware must remain enabled.

---

## 5. MongoDB Configuration

- Production connection string must be configured via `MONGO_URI`.
- Database user must have read-write privileges on target database.
- Mongoose automatic index creation is managed via defined models (`User`, `RewardEvent`, `ActivityEvent`, `Task`, `Notification`).

---

## 6. Web Push Configuration

- Web Push requires HTTPS in production.
- Generate VAPID key pairs using `web-push generate-vapid-keys` and set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in server environment.

---

## 7. Frontend SPA Deployment

- **Build Command**: `npm run build` inside `task-frontend/`.
- **Build Output**: `dist/` directory containing minified assets.
- **SPA Fallback**: Host provider (e.g. Nginx, Cloudflare Pages, Vercel) must rewrite all non-file route requests to `/index.html`.

---

## 8. Backend Deployment & Process Management

- **Start Command**: `node server.js` or `pm2 start server.js` in `task-backendd/`.
- **Health Check Endpoint**: `GET /api/health` returns `200 OK` (unauthenticated, lightweight process liveness check).
- **Readiness Endpoint**: `GET /api/ready` returns `200 OK` when MongoDB is connected, or `503 Service Unavailable` when database is disconnected.

---

## 9. Socket.IO Production Requirements

- WebSocket connection must use `wss://` over HTTPS in production.
- Client handshake includes JWT token for identity derivation and joining user-isolated rooms (`user:${userId}`).

---

## 10. Production Security Checklist

- [x] HTTPS enforced on frontend and API endpoints.
- [x] No `.env` files or secrets committed to git repository.
- [x] CORS strictly configured to production domain.
- [x] Access JWT secret generated with high entropy (32+ characters).
- [x] Rate limiting active on authentication (`/api/auth/login`, `/api/auth/register`) and general API endpoints (`/api/`).
- [x] Mongo sanitization (`express-mongo-sanitize`) and Helmet enabled.
- [x] Server-side authorization checks active across all endpoints.

---

## 11. Deployment Verification Protocol

After deploying frontend and backend to production, run the following verification checks:

1. **Liveness & Readiness**: Query `GET /api/health` (expect 200 OK) and `GET /api/ready` (expect 200 OK, `db: "connected"`).
2. **Authentication Flow**: Register a test user, verify login JWT issuance, test token refresh, and test logout.
3. **Project & Task Flow**: Create a project, add a milestone, create a task, assign to user, and complete task. Verify reward points awarded.
4. **Real-Time Communication**: Verify Socket.IO connects securely over WSS.
5. **Notifications**: Send test notification and verify delivery.

---

## 12. Rollback Strategy

If an unrecoverable issue occurs during deployment, roll back immediately to the previous verified stable checkpoint:

```bash
git checkout m4.6-stable
```

If rolling back to previous milestone release:

```bash
git checkout m4.5-b-stable
```

---

## 13. Current Known Limitations & Out-of-Scope Items

Legacy Category endpoints (`/api/categories`, `/category/:categoryId`) remain functional for backwards compatibility. Primary user flows use Project → Milestone → Task → Subtask hierarchy.

The following Phase 2 features remain explicitly **OUT OF SCOPE** and deferred:
- AI / LLM features
- Focus Mode
- Task Debt Intelligence
- Workload Intelligence
- Advanced Project Recommendations
- Message Search
- GitHub Integration
