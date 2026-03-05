# Backend Infrastructure Reference (`backend/`)

## 1. Technology Stack
- **Runtime**: Node.js ≥18 (Render deploy config enforces 18.x).
- **Framework**: Express 4 with TypeScript (compiled via `tsc` + `tsc-alias`).
- **Database**: MongoDB Atlas (requires `MONGODB_URI`); Mongoose 8 with custom plugins (`lib/mongoosePlugins.ts`).
- **Auth & Security**:
  - JWT tokens for API auth (`auth/jwt.ts`, `controllers/auth.controller.ts`).
  - Rate limiting via `express-rate-limit` (global middleware + tighter guards inside `middlewares/rateLimiting.middleware.ts`).
  - Helmet, compression, strict JSON body limits (10 MB) and origin allow-list (`FRONTEND_URL`, production domains).
- **Messaging & Files**:
  - Nodemailer SMTP (`services/EmailService.ts`) for invoices/notifications.
  - Local file-system storage for PDFs through `services/BlobStorageService.ts` (shim keeping Azure-like API, defaulting to `invoices/`).
- **Testing**: Jest 29 + `mongodb-memory-server` for integration suites located under `__tests__/`.

## 2. Application Entry & Bootstrapping
- `server.ts` handles:
  - DNS override (sets Google/Cloudflare resolvers before Mongo connection to work around local ISP limitations).
  - `.env.local` loading via `dotenv` before any imports.
  - Express app creation, proxy trust (`app.set('trust proxy', 1)`), middleware wiring, and HTTP server start after Mongo connection is confirmed.
  - Graceful shutdown on `SIGINT` to close Mongo connections.
- `index.ts` re-exports the configured Express app for tests.

## 3. Directory Responsibilities
| Path | Responsibility |
| --- | --- |
| `auth/` | JWT creation/verification, session helpers, NextAuth compatibility utilities.
| `controllers/` | Route-level orchestration per domain (auth, appointments, brands, bundles, containers, invoices, inventory, patients, products, refunds, reports, suppliers, transactions, users, webhooks). Controllers call services and shape HTTP responses.
| `routes/` | Express routers mounting controllers + validators + middleware per feature (e.g., `/api/transactions`, `/api/bundles`).
| `services/` | Business logic + integrations (invoice generator, email service, permission resolver, inventory analysis, refund engine, blob storage abstraction, etc.).
| `models/` | Mongoose schemas (e.g., `Patient.ts`, `Transaction.ts`, `Product.ts`, `Bundle.ts`, `BlendTemplate.ts`, `CustomBlendHistory.ts`, `AuditLog.ts`, etc.). Includes subfolders such as `models/inventory/` for specialized schemas.
| `middlewares/` | Auth guard, permission checks, DB connection enforcement (`checkDbConnection`), rate limiting, webhook verification.
| `utils/` | Shared helper functions (e.g., `transactionUtils.ts`).
| `lib/` | DB client helpers (`mongodb.ts`, `mongoose.ts`), error helpers, validation schemas, permission definitions, unit conversion utilities.
| `scripts/` | Operational tooling (data imports, bundle fixers, migration helpers, audit scripts). Many scripts rely on `ts-node` or `.cjs` entrypoints for quick execution.
| `__tests__/` | Jest integration/unit suites (+ `setup` utilities for DB mocking).

## 4. Core Capabilities
- **Authentication & Session Management**
  - Login/logout endpoints issue JWT access + refresh tokens (`auth.controller.ts`, `auth/jwt.ts`).
  - Refresh flow handled via `/auth/refresh`, validating stored refresh tokens and issuing new access tokens.
  - Permission middleware (`permission.middleware.ts`) checks role/ability matrices before controller logic executes.
- **Inventory & Commerce**
  - Inventory, brands, suppliers, container types, units: read/write endpoints backed by `InventoryAnalysisService`, `InventoryCostService`, etc.
  - Transaction & revenue tracking via `Transaction.ts` model, `transactions.controller.ts`, and services (inventory deduction, PDF invoice generation, refund pipelines).
  - Bundles & blend templates: `Bundle.ts`, `BlendTemplateService`, migrations + tests for bundle integrity.
- **Patient & Appointment Management**
  - `Patient.ts`, `PatientService.ts`, `Appointment.ts` cover CRM-like functionality.
  - Scripts exist for imports (`import-patients.js`, `create-patient-indexes.js`, etc.).
- **Reporting & Dashboarding**
  - `dashboard/` types/services deliver aggregated metrics consumed by frontend dashboards.
  - `reports` controllers emit CSV/PDF exports, hooking into services for data aggregation.
- **Invoicing & Documents**
  - `services/invoiceGenerator.ts` builds PDF using PDFKit, stores output, and optionally emails via `EmailService`.
  - Generated PDF files live under `backend/invoices/` (git-tracked for reference but typically ephemeral in production if stored externally).
- **Webhooks**
  - `routes/webhooks.routes.ts` + `middlewares/webhook.middleware.ts` handle inbound events (signature validation, rate limiting) before dispatching to `WebhookService`.

## 5. Configuration & Environment
- **Primary Environment Variables** (loaded from `.env.local` or platform secrets):
  - `BACKEND_PORT` / `PORT`: HTTP port (defaults to 5000 if unset; Render provides env `PORT`).
  - `MONGODB_URI`: MongoDB Atlas connection string (required, process exits if missing).
  - `FRONTEND_URL`: Allowed CORS origin (in addition to hard-coded `localhost` ports and production domains `https://crm.leaftolife.com.sg`, `https://leaftolife.com.sg`).
  - `JWT_SECRET`, `REFRESH_TOKEN_SECRET`: Access/refresh signing secrets.
  - SMTP vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`, `EMAIL_ENABLED`).
  - Optional toggles for email or blob storage.
- **CORS**: Only origins in the `allowedOrigins` array (plus env) can access; requests without `Origin` header (e.g., curl/Postman) are permitted.
- **Rate Limits**: Global 15-minute window (100 reqs prod, 1000 dev) plus feature-specific middleware for sensitive endpoints.

## 6. Build, Test, Deploy
- **Commands** (from `package.json`):
  - `pnpm dev` / `npm run dev`: `tsx watch server.ts` for live reload.
  - `pnpm build`: `tsc && tsc-alias` (outputs to `dist/`).
  - `pnpm start`: `node dist/server.js` (used in production, including Render start command per `render.yaml`).
  - `pnpm test:*`: Jest suites (unit/integration/coverage) using `--experimental-vm-modules` for ESM.
  - `pnpm lint`, `pnpm type:check` for quality gates.
- **Deployment (Render)**:
  - `render.yaml` defines Node service `l2l-backend`, build command `pnpm install --frozen-lockfile && pnpm build`, start `node dist/server.js`, health check `/health`.
  - Environment variables managed via Render dashboard or `.env` for local dev.

## 7. Operational Tooling & Scripts
- Hundreds of targeted scripts exist under `scripts/` for data hygiene (bundle verifiers, patient importers, transaction fixes, migration verification). Typical usage:
  ```bash
  pnpm ts-node scripts/create-admin.ts
  node scripts/check-products-for-bundles.cjs
  ```
- Each script imports the same `lib/mongodb.ts` helpers, so ensure `.env.local` is loaded or supply variables via CLI.
- Generated PDF invoices within `backend/invoices/` are useful for QA but should be excluded/relocated in production (consider hooking `BlobStorageService` back to Azure if needed).

## 8. Observability & Maintenance
- **Logging**: Winston transports defined in services for structured logs (request successes/failures, email send results, invoice generation, etc.).
- **Health checks**: `/health` returns `{ status, timestamp, service, version, database }` with DB status (200 OK when connected, 503 if degraded). Suitable for uptime monitors or Render health checks.
- **Error Handling**: Global `errorHandler` returns JSON errors with sanitized messages; validation errors mapped to 400, unauthorized to 401.
- **Scripts + Tests**: Keep `pnpm install` deterministic via `pnpm-lock.yaml`. Tests rely on `jest.config.ts` (ESM) and `mongodb-memory-server` — no external DB required.

This reference should be the starting point for onboarding engineers and for planning changes that touch the backend stack. Pair it with `architecture.md` (system context) and `operations.md` (deployment & workflow) for a complete picture.