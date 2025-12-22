# L2L Backend API Server

This is the standalone Node.js/Express backend server for the L2L application.

## Architecture

This backend is designed to be deployed separately from the frontend Next.js application, allowing for:
- Independent scaling
- Separate deployment cycles
- Better separation of concerns
- Easier microservices migration

## Directory Structure

- **auth/** - Authentication logic and utilities
  - `auth-config.ts` - NextAuth configuration
  - `jwt.ts` - JWT token handling
  - `getCurrentUser.ts` - Server-side user retrieval
  
- **models/** - Database models (Mongoose schemas)
  - `User.ts` - User model and schema
  - `Product.ts` - Product model
  - `UnitOfMeasurement.ts` - Units model
  - Other database models
  
- **api/** - Next.js API route handlers (to be converted to Express)
  - `auth/` - Authentication endpoints
  - `inventory/` - Inventory management
  - Other API endpoints

- **routes/** - Express route definitions
  - Route handlers for different API endpoints

- **controllers/** - Express controller functions
  - Business logic for handling requests

- **middlewares/** - Express middleware
  - Authentication, validation, error handling
  
- **lib/** - Core backend libraries
  - `mongodb.ts` - Database connection
  - `mongoose.ts` - Mongoose configuration
  
- **services/** - Business logic services
  - Reusable business logic
  
- **utils/** - Utility functions

## Setup

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Variables:**
   The backend uses the `.env.local` file from the root directory. Make sure you have set:
   - `MONGODB_URI` - MongoDB connection string
   - `JWT_SECRET` - Secret for JWT tokens
   - `BACKEND_PORT` - Port for the backend server (default: 5000)

3. **Run the server:**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## API Structure

- `/api/auth/*` - Authentication endpoints
- `/api/inventory/*` - Inventory management
- `/api/products/*` - Product management
- `/api/brands/*` - Brand management
- `/api/suppliers/*` - Supplier management
- `/api/blend-templates/*` - Blend template management
- `/api/bundles/*` - Bundle management
- `/api/custom-blends/*` - Custom blend management

## Converting Next.js API Routes

To convert Next.js API routes to Express routes:

1. Next.js route handler → Express controller function
2. `req.body` works the same
3. `req.query` works the same
4. Replace `return NextResponse.json()` with `res.json()`
5. Add middleware for authentication

Example conversion:
```javascript
// Next.js API Route
export async function GET(req) {
  const data = await Model.find();
  return NextResponse.json(data);
}

// Express Route
export const getItems = async (req, res) => {
  const data = await Model.find();
  res.json(data);
};
```

## Authentication Flow

1. User submits credentials via login page (frontend)
2. Credentials are sent to backend `/api/auth/login` endpoint
3. Backend validates credentials using the User model
4. JWT token is generated and sent back to frontend
5. Frontend stores token and includes it in subsequent requests
6. Backend validates JWT token on protected routes

## Deployment

The backend can be deployed to:
- Heroku
- AWS EC2
- DigitalOcean
- Google Cloud Run
- Any VPS with Node.js support

Make sure to set the `NEXT_PUBLIC_API_URL` in the frontend to point to your deployed backend URL.