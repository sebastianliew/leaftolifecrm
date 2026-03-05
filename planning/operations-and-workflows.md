# Operations & Workflow Guide

## 1. Local Development
### Prerequisites
- Node.js ≥22 for `frontend/`, ≥18 for `backend/` (install both for compatibility).
- pnpm 10.x (preferred), or npm if necessary.
- MongoDB Atlas credentials (`MONGODB_URI`) and SMTP credentials (optional locally unless testing email).

### Environment Setup
1. Clone repo and copy `.env.local.example` (if available) or create new `.env.local` files under both `backend/` and `frontend/` with the variables described in the backend/frontend references.
2. Install dependencies:
   ```bash
   cd backend && pnpm install
   cd ../frontend && pnpm install
   ```
3. Start services:
   - **Backend**: `pnpm dev` (watches `server.ts`, listens on `BACKEND_PORT` or 5000).
   - **Frontend**: `pnpm dev` (Next.js on port 3000 by default). Ensure `NEXT_PUBLIC_API_URL` or `api-client` config points to the backend (adjust to `http://localhost:5000/api` or `5001/api` depending on `.env`).
4. Optional: run Jest suites via `pnpm test` in each workspace.

## 2. Testing Strategy
| Layer | Command | Notes |
| --- | --- | --- |
| Backend unit/integration | `pnpm test`, `pnpm test:unit`, `pnpm test:integration` | Uses `mongodb-memory-server`; no external DB needed. |
| Backend coverage | `pnpm test:coverage` | Generates Jest coverage reports. |
| Frontend unit/integration | `pnpm test`, `pnpm test:watch` | MSW intercepts API calls for deterministic tests. |
| Frontend coverage | `pnpm test:coverage` | Works with Jest 30 + React Testing Library. |
| Lint/type checks | `pnpm lint`, `pnpm type:check` (both apps) | Run before PRs/commits. |
| E2E (optional) | Configure Playwright/Puppeteer if/when needed. |

## 3. Deployment
### Backend (Render.com)
- Declared in `backend/render.yaml`:
  - Build: `pnpm install --frozen-lockfile && pnpm build`.
  - Start: `node dist/server.js`.
  - Health check: `/health`.
- Set environment variables via Render dashboard (at minimum `MONGODB_URI`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `FRONTEND_URL`, SMTP creds).
- Logs accessible in Render console; Winston also logs to stdout.

### Frontend (Vercel or Self-Hosted Next.js)
- Build command: `pnpm build`.
- Start command (self-hosted): `pnpm start`.
- Environment variables to configure in hosting provider:
  - `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, provider creds (if OAuth), `NEXT_PUBLIC_API_URL`, any feature toggles.
- Ensure backend API is reachable from the deployed frontend (update `NEXT_PUBLIC_API_URL` accordingly).

### Version Control / CI
- No CI config is packaged; recommended steps before pushing:
  1. `pnpm lint` (both apps).
  2. `pnpm type:check`.
  3. Relevant test suites (`pnpm test`).
- If integrating with CI/CD, run backend + frontend pipelines independently but share the `.env` contract documented above.

## 4. Maintenance & Scripts
- **Data migrations/fixes**: use scripts under `backend/scripts/`. Examples:
  ```bash
  pnpm ts-node scripts/create-admin.ts
  node scripts/fix-bundles-complete.cjs
  pnpm ts-node scripts/update-atlas-user.cjs
  ```
  Always back up data (Atlas snapshot) before executing destructive scripts.
- **Invoice PDFs**: generated files accumulate under `backend/invoices/`. Clean periodically or route to external storage in production by swapping `BlobStorageService` implementation.
- **Email testing**: set `EMAIL_ENABLED=false` in `.env.local` when you don’t want to send real emails. The service logs warnings when SMTP configs are missing.
- **Health monitoring**: Poll `/health` (backend) to confirm Mongo connectivity and service uptime. Render uses this for auto-restarts.

## 5. Troubleshooting Tips
| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| Frontend 401 loops | Missing/expired JWT, refresh route misconfigured | Verify `/api/auth/refresh` is working, ensure backend `REFRESH_TOKEN_SECRET` matches frontend environment, clear `authToken` cookie/localStorage. |
| Requests blocked by CORS | `FRONTEND_URL` not set or domain missing in allow-list | Update backend `.env.local` and restart server; add domain to `allowedOrigins` array. |
| Mongo connection fails locally | Globe Broadband DNS issue (documented in `server.ts`) | Ensure DNS override remains (already enforced) or verify local network resolves Atlas SRV records. |
| Email not sending | SMTP vars missing or `EMAIL_ENABLED=false` | Check backend logs (Email service prints warnings). |
| Rate-limit (429) toasts | Rapid API retries | Tune client retry logic or increase limits in `middlewares/rateLimiting.middleware.ts` (with caution). |

## 6. File Locations of Interest
- `planning/architecture.md`: system overview (this folder).
- `planning/backend-infrastructure.md` / `frontend-infrastructure.md`: deeper dives.
- `planning/infrastructure-diagram.html`: visual diagram for presentations.

Use this document alongside the rest of the planning folder to onboard engineers, run day-to-day development, and execute deployments with confidence.