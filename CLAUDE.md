# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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