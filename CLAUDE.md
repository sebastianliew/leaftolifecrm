# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Backend Commands
```bash
cd backend
npm run dev        # Start development server with hot reload
npm run build      # Compile TypeScript to dist/
npm start          # Run production server
npm run lint       # Run ESLint
npm run type:check # Check TypeScript types
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

Note: Frontend uses `pnpm` as package manager, backend uses `npm`.

## High-Level Architecture

### Tech Stack
- **Backend**: Node.js + TypeScript + Express + MongoDB (Mongoose)
- **Frontend**: Next.js 15 + TypeScript + React 19 + Tailwind CSS
- **Authentication**: NextAuth with JWT tokens
- **State Management**: React Query (TanStack Query)

### Project Structure
The project follows a monorepo structure with separate `backend/` and `frontend/` directories.

**Backend** follows MVC pattern:
- `routes/` - API endpoint definitions
- `controllers/` - Request handlers
- `models/` - Mongoose schemas
- `services/` - Business logic layer
- `middlewares/` - Express middleware (auth, validation)

**Frontend** uses Next.js App Router:
- `app/` - Next.js pages and layouts
- `components/` - Reusable React components
- `hooks/` - Custom React hooks
- `services/` - API client services
- `types/` - TypeScript type definitions

### Key Architectural Patterns

1. **Navigation System**: Flexible role-based navigation defined in `frontend/src/lib/navigation/` with strategies for different user types. See `frontend/src/lib/navigation/README.md` for details.

2. **Repository Pattern**: Data access is abstracted through repositories (e.g., `BlendTemplateRepository`) in the backend.

3. **Service Layer**: Business logic is separated into service classes in both backend and frontend.

4. **Role-Based Access Control**: Five user roles (super_admin, admin, manager, staff, user) with granular permissions defined in `backend/lib/permissions.ts`.

5. **API Structure**: RESTful API with consistent naming:
   - `/api/auth/*` - Authentication endpoints
   - `/api/admin/*` - Admin-only endpoints
   - `/api/*` - General endpoints

### Database Schema
MongoDB collections include: users, patients, products, transactions, appointments, blendtemplates, categories, brands, suppliers, refunds, and auditlogs.

### Security Considerations
- JWT authentication with refresh tokens
- API rate limiting configured
- Webhook signature validation for external integrations
- Permission-based access control on all endpoints
- Password hashing with bcrypt

### External Integrations
The system integrates with Fluent Forms Pro via webhooks. See `backend/docs/webhook-integration-guide.md` for implementation details.

### Development Tips
- Both backend and frontend use TypeScript strict mode
- Path aliases are configured: `@backend/*`, `@models/*` (backend) and `@/*` (frontend)
- Environment variables are loaded from `.env` files
- The frontend uses Shadcn/ui components built on Radix UI
- Forms use React Hook Form with Zod validation