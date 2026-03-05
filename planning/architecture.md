# LeafToLife Project – System Architecture Overview

## 1. High-Level Structure
- **Client + Admin UI**: `frontend/` (Next.js 15 App Router, React 18, TypeScript, Tailwind CSS, Radix UI). Provides all authenticated dashboards (inventory, transactions, patients, bundles, etc.), authentication screens, and internal API routes for token refresh.
- **Backend API**: `backend/` (Express 4 + TypeScript, Mongoose 8). Exposes REST endpoints under `/api/*` for auth, inventory, finance modules, PDF invoice generation, and webhooks.
- **Data Stores**:
  - **MongoDB Atlas** (primary transactional DB for all domains).
  - **Local file storage** (`backend/invoices/`) for generated PDFs; abstraction kept via `BlobStorageService` (swappable with Azure Blob).
  - **SMTP** (Nodemailer) for transactional emails.
- **Deployment targets**:
  - Backend configured for Render.com via `backend/render.yaml` (Node 18 runtime, health checks on `/health`).
  - Frontend designed for Vercel/Next.js hosting (Node ≥22). Local API base defaults to `http://localhost:5001/api`.

Refer to `infrastructure-diagram.html` in the same folder for a visual system context.

## 2. Request / Data Flow
1. **User** interacts with Next.js UI.
2. **Next.js Middleware** (`frontend/middleware.ts`) intercepts navigation, injecting auth guards and redirect rules before hitting page components.
3. **Client Data Access** via `src/lib/api-client.ts`:
   - Adds JWT bearer token (mirrored in cookies + `localStorage`).
   - Falls back to NextAuth session cookies when tokens are absent.
   - Automatically retries once on 401 using `/api/auth/refresh` (Next.js API route) before proxying to the Express API.
4. **Backend Express API** receives the request through router stacks (`backend/routes/*`) → controller → service → model. Shared middleware enforces DB connectivity, rate limiting, and CORS/helmet policies.
5. **MongoDB Atlas** handles persistence via Mongoose models under `backend/models/*` (patients, products, transactions, audits, bundles, etc.).
6. **Ancillary flows**:
   - PDF invoices written locally (`invoices/…`) via `services/invoiceGenerator.ts`, optionally emailed through `EmailService`.
   - Webhooks enter via `/api/webhooks` routes and are validated before affecting domain data.

## 3. Codebase Topography
### Backend (`backend/`)
| Segment | Purpose |
| --- | --- |
| `controllers/` | HTTP orchestration per domain (auth, inventory, bundles, transactions, reports…).
| `services/` | Business logic (Invoice generation, Email, Inventory analysis, Refund handling, Permission checks, Blob storage abstraction).
| `models/` | Mongoose schemas for all domain entities + subdirectories like `models/inventory`.
| `routes/` | Express routers mapping REST paths to controllers with middleware composition.
| `middlewares/` | Auth guards, permission checks, DB readiness, rate limiting, webhook signature validation.
| `auth/` | JWT utilities, NextAuth compatibility helpers, current user retrieval.
| `scripts/` | One-off maintenance and migration utilities (bundle fixers, user creation, analysis scripts).
| `__tests__/` | Jest unit + integration suites (MongoDB Memory Server setup).

### Frontend (`frontend/`)
| Segment | Purpose |
| --- | --- |
| `src/app/` | App Router pages (dashboard, inventory, transactions, patients, etc.) and nested routes.
| `src/components/` | UI primitives + feature components (Radix-based dialogs, tables, forms).
| `src/lib/` | API client, auth helpers, query utilities, permission handlers.
| `src/hooks/` | React Query helpers, form hooks.
| `src/providers/` | Context providers (Theme, QueryClient, Auth).
| `src/services/` | Thin client-side service wrappers (e.g., inventory service, caching helpers).
| `src/types/` | Shared TypeScript contracts for front/back parity.
| `src/utils/` | Formatting, date helpers, currency utilities.
| `public/` | Static assets (icons, upload placeholders, logos).
| `__tests__/` | Jest + Testing Library suites, MSW handlers for API mocking.

## 4. Cross-Cutting Concerns
- **Authentication & Authorization**
  - Backend uses JWT secrets (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`) with helper utilities in `auth/` and guards in `middlewares/auth.middleware.ts` and `permission.middleware.ts`.
  - Frontend relies on JWT cookies + NextAuth sessions; middleware enforces protected route access and redirects.
- **Security Baseline**
  - Helmet, compression, Express rate limiting (global + per sensitive route), strict CORS allow-list (localhost + production domains), trust proxies for Render.
  - DB connection watchdog middleware blocks API access if Mongo is unavailable.
  - Request body limits (`10mb`) and webhook signature validation.
- **Testing Strategy**
  - Backend: Jest + `mongodb-memory-server` for integration, organized under `__tests__/integration` & `__tests__/unit`.
  - Frontend: Jest + Testing Library + MSW for mocking APIs; Playwright/Puppeteer available for E2E harnesses.
- **Observability & Ops**
  - Winston logger for backend instrumentation.
  - Health endpoint `/health` returns service + DB status for Render.
  - Extensive maintenance scripts for data repair and migrations (`backend/scripts/*`).

This document anchors the shared mental model for how the frontend, backend, and infrastructure pieces interoperate. Detailed backend/frontend operations and deployment notes live in the companion files inside the same `planning/` directory.