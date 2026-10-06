# Phase 3-A: Production Deployment & Go-Live Checklist

This document provides the operational checklist for deploying the Task Management System to production environments (e.g., MongoDB Atlas, Node.js App Hosting, Vercel/Netlify frontend).

---

## 1. Environment Variable & Secret Configuration

### Mandatory Backend Environment Variables

| Variable Name | Description | Production Requirement |
| :--- | :--- | :--- |
| `NODE_ENV` | Process environment mode | Set strictly to `"production"` |
| `PORT` | HTTP Server Port | Set by hosting provider or defaults to `5000` |
| `MONGO_URI` | MongoDB Atlas Connection String | Standard MongoDB connection URI with SSL enabled |
| `JWT_SECRET` | Secret key for signing JWTs | High-entropy string (minimum 32 characters) |
| `CLIENT_ORIGIN` | Allowed Frontend Domain | Set to production web domain (e.g. `https://app.taskmgmt.com`) |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | Registered GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | Registered GitHub OAuth App Client Secret |
| `GITHUB_WEBHOOK_SECRET` | GitHub Webhook Secret | High-entropy secret matching GitHub Webhook settings |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | AES-256-GCM Token Key | **CRITICAL**: Exactly 32 bytes (64 hex or 32 string chars) |
| `GEMINI_API_KEY` | Google Gemini AI API Key | Active API key from Google AI Studio / GCP |
| `VAPID_PUBLIC_KEY` | Web Push VAPID Public Key | Generated VAPID public key string |
| `VAPID_PRIVATE_KEY` | Web Push VAPID Private Key | Generated VAPID private key string |
| `VAPID_SUBJECT` | Web Push Contact Mailto | Valid mailto URI (e.g., `mailto:admin@taskmgmt.com`) |

---

## 2. Critical Operational Requirements

### ⚠️ Secret Backup Notice: `GITHUB_TOKEN_ENCRYPTION_KEY`
> [!CAUTION]
> The `GITHUB_TOKEN_ENCRYPTION_KEY` environment variable is required to encrypt and decrypt user GitHub OAuth tokens using AES-256-GCM.
> 
> **If this key is lost, corrupted, or altered in production, existing encrypted tokens cannot be decrypted, breaking all active user GitHub integrations.**
> 
> This key **MUST** be backed up securely in an enterprise secret manager (e.g. HashiCorp Vault, AWS Secrets Manager, 1Password) prior to production deployment.

---

## 3. Pre-Deployment Step-by-Step Checklist

### A. Security & Environment
- [ ] Verify `NODE_ENV=production` is set in hosting environment.
- [ ] Verify `JWT_SECRET` is a unique, high-entropy 64-character random string.
- [ ] Backup `GITHUB_TOKEN_ENCRYPTION_KEY` to secure offline storage.
- [ ] Confirm `.env` files are excluded from Git repository (`git status`).
- [ ] Verify CORS `CLIENT_ORIGIN` matches production HTTPS domain.

### B. Database & MongoDB Atlas
- [ ] Verify MongoDB Atlas cluster is running MongoDB 6.0+ with TLS/SSL enforced.
- [ ] Verify database indexes have built successfully (`Message` text index, `FocusSession` partial unique index, `GitHubWebhookLog` TTL index).
- [ ] Configure MongoDB Atlas automated daily backups and point-in-time recovery (PITR).

### C. Backend Deployment
- [ ] Deploy backend to containerized/Node.js host.
- [ ] Verify health endpoint returns `200 OK`: `GET /api/health`.
- [ ] Verify readiness endpoint returns `200 OK`: `GET /api/ready`.
- [ ] Verify WebSockets handshake connects cleanly over WSS (WebSocket Secure).

### D. Frontend Deployment
- [ ] Execute production build: `npm run build` in `task-frontend`.
- [ ] Deploy static build assets to CDN or web host.
- [ ] Confirm single-page app (SPA) routing fallback (`index.html`) is configured.
- [ ] Confirm Web Vitals, responsive viewports (320px–1920px), and keyboard focus indicators function cleanly.

### E. Post-Launch Smoke Verification
- [ ] Perform user registration, login, and token refresh verification.
- [ ] Create a project, milestone, task, and subtask.
- [ ] Test Focus Session start/pause/complete lifecycle.
- [ ] Test message search via `GET /api/messages/search?q=test`.
- [ ] Verify GitHub OAuth connection flow and repository linking.
