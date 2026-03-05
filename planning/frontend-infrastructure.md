# Frontend Infrastructure Reference (`frontend/`)

## 1. Technology Stack
- **Framework**: Next.js 15 (App Router) with React 18.3 and TypeScript.
- **UI System**: Tailwind CSS 3.x + `tailwindcss-animate`, Radix UI primitives, Lucide icons, custom design tokens (Poppins typography by default).
- **State / Data**:
  - TanStack React Query 5 for server-state caching.
  - React Hook Form + Zod for form validation.
  - Context providers in `src/providers/` (QueryClientProvider, ThemeProvider, Auth contexts).
- **Auth**:
  - NextAuth (App Router handler) for session management and OAuth support.
  - Custom JWT handling via `src/lib/api-client.ts` + `/api/auth/refresh` route to bridge backend refresh tokens.
  - Middleware-based route protection (`frontend/middleware.ts`).
- **Tooling**: pnpm 10, Node ≥22 (per `package.json` engines), Jest 30 + Testing Library + MSW, Playwright/Puppeteer optional via dev dependencies.

## 2. Directory Guide
| Path | Description |
| --- | --- |
| `src/app/` | App Router routes. Each feature (dashboard, inventory, transactions, patients, bundles, etc.) gets its own segment with page/layout/loading files. Includes `api/` routes (e.g., auth refresh) for server-side utilities.
| `src/components/` | Shared UI components (tables, forms, dialogs), Radix wrappers, layout primitives. Subfolders for complex widgets.
| `src/constants/` | App-wide config (role definitions, table columns, enumerations).
| `src/hooks/` | Custom hooks for forms, modals, React Query wrappers.
| `src/lib/` | Infrastructure helpers (API client, permission error handler, fetch utilities, caching helpers).
| `src/models/` | Frontend TypeScript models mirroring backend schemas for typing.
| `src/providers/` | React provider components (QueryClient, Theme, Auth session bridging).
| `src/services/` | Thin wrappers around `api-client` for specific feature domains (inventory service, etc.).
| `src/styles/` | Global styles + Tailwind entrypoints.
| `src/types/` | Type definitions (DTOs, API responses, enums).
| `src/utils/` | Formatting helpers, currency/date utilities, CSV parsers.
| `public/` | Static assets (logos, placeholders, icons).
| `__tests__/` | Jest test suites (unit + integration) w/ setup files, MSW handlers, and configuration.

## 3. Authentication & Authorization Flow
1. **Client-side tokens** stored in both cookies and `localStorage` (`authToken`, `refreshToken`).
2. **API Client** (`src/lib/api-client.ts`):
   - Attaches bearer token on each request; falls back to NextAuth session cookies if token missing.
   - Automatically POSTs to `/api/auth/refresh` when a 401 occurs, then replays the request once.
   - Handles permission errors (403) by triggering toast messaging and optional dialogs, and shows rate-limit toasts for 429.
3. **Middleware** (`frontend/middleware.ts`):
   - Protects key routes (`/dashboard`, `/inventory`, `/transactions`, `/patients`, `/users`, etc.).
   - Redirects unauthenticated users to `/login?redirectTo=…` and prevents authenticated users from revisiting `/login` unnecessarily.
   - Uses JWT expiry checks client-side by decoding the cookie.
4. **NextAuth**: Lives under `src/app/api/auth/[...nextauth]/route.ts` (not shown but configured). Provides session tokens used by Next middleware and API routes.

## 4. Data Fetching & State Management
- **React Query** centralizes data fetches, caching, and stale state handling. Hooks typically wrap `api-client` calls, e.g. `useQuery(['transactions', filters], fetcher)`.
- **Mutations** triggered via `apiClient.post/put/patch/delete`, followed by cache invalidation.
- **Services** (e.g., `services/inventoryService.ts`) encapsulate endpoint URLs and shape responses, ensuring UI components stay declarative.
- **Permission Handling**: `src/lib/permission-error-handler.ts` centralizes error -> UI fallback mapping, so each API call doesn’t need bespoke `403` logic.

## 5. Styling & Components
- **Tailwind** configured through `tailwind.config.ts` and `postcss.config.mjs`. Supports CSS variables for theming (`__next-auth-theme-*` for auth pages, custom tokens for dashboards).
- **Radix UI** provides accessible primitives for dialogs, dropdowns, etc. Combined with custom wrappers in `components/ui`.
- **Charts & Visualizations**: Recharts, Embla Carousel for carousels, Framer Motion for micro-animations.
- **Export Utilities**: `jspdf`, `jspdf-autotable`, `xlsx`, `html2canvas` for PDF/Excel exports right from the UI.

## 6. Testing & Quality
- **Jest + Testing Library** for component tests (`__tests__/unit/`, `__tests__/integration/`).
- **MSW** (Mock Service Worker) for API mocking in tests.
- **ESLint + TypeScript** enforce standards via `pnpm lint` + `pnpm type:check`.
- **Playwright/Puppeteer** dependencies available for optional E2E/regression suites.

## 7. Build & Deployment
- **Scripts** (`package.json`):
  - `pnpm dev`: `next dev`.
  - `pnpm build`: `next build` (emits `.next/` artifacts; results discovered under `.next/server` etc.).
  - `pnpm start`: `next start` for production.
  - `pnpm test`, `test:watch`, `test:coverage` for Jest.
  - `pnpm lint`, `pnpm type:check` for QA gates.
- **Environment Variables** (set via `.env.local` or hosting provider):
  - `NEXT_PUBLIC_API_URL` (frontend fallback for API base, though `api-client` defaults to `http://localhost:5001/api`).
  - NextAuth secrets (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, provider creds).
  - Any feature-specific toggles (see `.env.local`).
- **Hosting**: Designed for Vercel (App Router). For self-hosting or other providers, ensure Node ≥22 per engines spec.

## 8. Developer Workflow Tips
- Keep `api-client` as the single source of truth for backend communication to retain consistent token/refresh logic.
- When adding protected routes, update `protectedRoutes` in `middleware.ts` so navigation guards stay in sync.
- Mirror backend DTO changes by updating `src/types/` & `src/models/` to maintain TypeScript safety across the stack.
- Use `services/*` modules to isolate endpoint URLs; this keeps components free from hard-coded paths and simplifies refactors.
- Prefer React Query for all remote state; avoid sprinkling `useEffect` fetches throughout the component tree.

Pair this reference with `architecture.md` for overall context and `operations.md` for deployment/testing workflows.