# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Common Development Commands

### Backend Commands
```bash
cd backend
npm run dev        # Start development server with hot reload (tsx watch)
npm run build      # Compile TypeScript to dist/
npm start          # Run production server
npm run lint       # Run ESLint
npm run type:check # Check TypeScript types
npm test           # Run Jest tests
```

### Frontend Commands
```bash
cd frontend
pnpm dev          # Start Next.js development server
pnpm build        # Create production build
pnpm start        # Run production server
pnpm lint         # Run ESLint
pnpm type:check   # Check TypeScript types
```

Note: Frontend uses `pnpm` (v10.13.1+) as package manager, backend uses `npm`. Frontend requires Node.js 22+, backend requires Node.js 18+.

## High-Level Architecture

### Tech Stack
- **Backend**: Node.js + TypeScript + Express + MongoDB (Mongoose) + ES Modules
- **Frontend**: Next.js 15 + TypeScript + React 18 + Tailwind CSS
- **Authentication**: NextAuth with JWT tokens
- **State Management**: React Query (TanStack Query v5)
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Forms**: React Hook Form + Zod validation

### Project Structure
The project follows a monorepo structure with separate `backend/` and `frontend/` directories.

**Backend** follows MVC pattern:
- `routes/` - API endpoint definitions (16 route files)
- `controllers/` - Request handlers
- `models/` - Mongoose schemas (19 models including User, Patient, Product, Transaction, etc.)
- `services/` - Business logic layer
- `middlewares/` - Express middleware (auth, validation)
- `lib/permissions/` - Permission service with role-based defaults

**Frontend** uses Next.js App Router:
- `src/app/` - Next.js pages and layouts
- `src/components/` - Reusable React components
- `src/components/navigation/` - Strategy-based navigation system
- `src/hooks/` - Custom React hooks
- `src/services/` - API client services
- `src/types/` - TypeScript type definitions
- `src/lib/permissions/` - Frontend permission service (mirrors backend)

### Key Architectural Patterns

1. **Navigation System**: Strategy pattern-based navigation in `frontend/src/components/navigation/`. Supports role-based and permission-based filtering via `RoleStrategy`, `PermissionStrategy`, and `CompositeStrategy`. Configuration-driven via `navigation.config.ts`. See `frontend/src/components/navigation/README.md` for details.

2. **Permission System**: Granular feature-based permissions defined in `PermissionService` (both frontend and backend). Categories include: discounts, reports, inventory, userManagement, patients, transactions, bundles, suppliers, blends, prescriptions, appointments, containers, brands, dosageForms, categories, units, documents, security, settings. Super_admin has all permissions; other roles have configurable defaults with per-user overrides via `featurePermissions`.

3. **Service Layer**: Business logic is separated into service classes in both backend and frontend. Backend uses singleton pattern for services like `EmailService`.

4. **Role-Based Access Control**: Five user roles with hierarchy:
   - `super_admin` - Full access, unlimited permissions
   - `admin` - Most features, limited user management
   - `manager` - Inventory/patient management, limited admin features
   - `staff` - Basic transaction and patient creation
   - `user` - Minimal access

5. **API Structure**: RESTful API mounted at `/api/*`:
   - `/api/auth/*` - Authentication
   - `/api/users/*` - User management
   - `/api/patients/*` - Patient CRUD
   - `/api/inventory/*` - Product/stock management
   - `/api/transactions/*` - Sales transactions
   - `/api/reports/*` - Reporting endpoints
   - `/api/webhooks/*` - External integrations

### Path Aliases
- **Backend**: `@/*`, `@backend/*`, `@models/*`, `@services/*`, `@controllers/*`, `@routes/*`, `@middleware/*`, `@middlewares/*`, `@utils/*`, `@types/*`, `@config/*`, `@lib/*`
- **Frontend**: `@/*` maps to `./src/*`

### Environment Configuration
- Backend loads from `backend/.env.local`
- Required backend vars: `MONGODB_URI`, `JWT_SECRET`
- Backend defaults to port 5000 (configurable via `BACKEND_PORT`)
- Frontend expects API at `NEXT_PUBLIC_API_URL`

### Database
MongoDB Atlas with collections: users, patients, products, transactions, appointments, blendtemplates, categories, brands, suppliers, supplierCategories, refunds, adminActivityLogs, userAuditLogs, customBlendHistories, bundles, unitOfMeasurements, containerTypes, patientEnrichments

## graphify

This project has a graphify knowledge graph at `graphify-out/`. Scope: `backend/` + `frontend/src` (invoice PDFs and build artifacts excluded). Karpathy-style layered on top: `raw/` for unstructured context, `wiki/` for hand-curated articles.

### Reading order (before answering architecture questions)

1. **`graphify-out/INDEX.md`** — start here. One-line navigation of all communities + god nodes. Don't skip this; it's the map.
2. **`wiki/<topic>.md`** — if a hand-curated article exists for the area you're working on, read it. These capture decisions and gotchas that aren't in the code.
3. **`graphify-out/GRAPH_REPORT.md`** — only if INDEX + wiki didn't answer it. Full audit, longer.
4. **Raw files** — last resort. Prefer `graphify query "<question>"` or `graphify explain "<node>"` for targeted lookups.

### Maintenance rules

- **After editing code:** run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to rebuild the graph.
- **After any graph rebuild,** regenerate the Obsidian vault + INDEX.md:
  ```bash
  $(cat graphify-out/.graphify_python) -c "
  import json
  from pathlib import Path
  from networkx.readwrite import json_graph
  from graphify.export import to_obsidian, to_canvas
  from graphify.cluster import score_all
  data = json.loads(Path('graphify-out/graph.json').read_text())
  G = json_graph.node_link_graph(data, edges='links')
  communities = {}
  for nid, d in G.nodes(data=True):
      communities.setdefault(int(d.get('community', 0)), []).append(nid)
  cohesion = score_all(G, communities)
  labels = {cid: (G.nodes[nodes[0]].get('label', f'Community {cid}')[:30] if nodes else f'Community {cid}') for cid, nodes in communities.items()}
  to_obsidian(G, communities, 'graphify-out/obsidian', community_labels=labels, cohesion=cohesion)
  to_canvas(G, communities, 'graphify-out/obsidian/graph.canvas', community_labels=labels)
  "
  $(cat graphify-out/.graphify_python) graphify-out/.gen_index.py
  ```
- **Git commit hook** handles this automatically for code changes — manual rebuild only needed for uncommitted code or when docs/PDFs change.

### Feedback loop (important)

When you answer a non-trivial architecture question that wasn't already obvious from the graph:

1. **Save the answer back to the graph** so future queries benefit:
   ```
   $(cat graphify-out/.graphify_python) -m graphify save-result --question "Q" --answer "A" --type query --nodes Node1 Node2
   ```
2. **If the answer is wiki-worthy** (multi-step flow, trade-off explanation, cross-cutting concern), also add it as a new file in `wiki/<topic>.md` following the style of `wiki/transaction-flow.md`. Link to node notes in `graphify-out/obsidian/` using `[[wikilinks]]`.
3. **If the context behind a decision came from somewhere outside the code** (a Slack thread, a bug report, a design doc), paste it into `raw/` as markdown. Run `/graphify raw --update` to pull it into the graph.

This is the Karpathy pattern: every good answer becomes a persistent artifact, so the knowledge base compounds.
