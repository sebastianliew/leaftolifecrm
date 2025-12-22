// Load environment variables BEFORE any other imports
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ES modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from backend directory FIRST
dotenv.config({ path: join(__dirname, '.env.local') });

import express, { Express, Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { AddressInfo } from 'net';

// Import routes AFTER loading environment variables
import authRoutes from './routes/auth.routes.js';
import brandsRoutes from './routes/brands.routes.js';
import containerTypesRoutes from './routes/container-types.routes.js';
import refundsRoutes from './routes/refunds.routes.js';
import transactionsRoutes from './routes/transactions.routes.js';
import blendTemplatesRoutes from './routes/blend-templates.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import suppliersRoutes from './routes/suppliers.routes.js';
import bundlesRoutes from './routes/bundles.routes.js';
import appointmentsRoutes from './routes/appointments.routes.js';
import patientsRoutes from './routes/patients.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import invoicesRoutes from './routes/invoices.routes.js';
import webhooksRoutes from './routes/webhooks.routes.js';
import usersRoutes from './routes/users.routes.js';

// Import services to initialize at startup
import { emailService } from './services/EmailService.js';

// Debug environment variables
console.log('JWT_SECRET loaded:', process.env.JWT_SECRET ? 'Yes' : 'No');
console.log('MONGODB_URI loaded:', process.env.MONGODB_URI ? 'Yes' : 'No');
console.log('Environment file path:', join(__dirname, '.env.local'));

// Initialize email service (triggers constructor and logs configuration)
emailService.isEnabled();

// Type for environment variables
declare global {
  interface ProcessEnv {
    BACKEND_PORT?: string;
    MONGODB_URI?: string;
    FRONTEND_URL?: string;
    readonly NODE_ENV: 'development' | 'production' | 'test';
    JWT_SECRET?: string;
    REFRESH_TOKEN_SECRET?: string;
  }
}

const app: Express = express();
// Use dynamic port allocation with fallback
const PORT: number = parseInt(process.env.BACKEND_PORT || process.env.PORT || '5000', 10);

// Database connection - use MongoDB Atlas URI from environment
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  process.exit(1);
}

const mongoUri: string = process.env.MONGODB_URI;

// MongoDB connection options
const mongoOptions = {
  serverSelectionTimeoutMS: 30000, // 30 seconds
  socketTimeoutMS: 45000, // 45 seconds
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  connectTimeoutMS: 30000,
  heartbeatFrequencyMS: 2000,
};

mongoose.connect(mongoUri, mongoOptions)
  .then(() => console.log('✅ MongoDB Atlas connected successfully'))
  .catch((err: Error) => console.error('❌ MongoDB connection error:', err));

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from MongoDB Atlas');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🔐 MongoDB Atlas connection closed through app termination');
  process.exit(0);
});

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses

// CORS configuration
interface CorsCallback {
  (err: Error | null, allow?: boolean): void;
}

const corsOptions: cors.CorsOptions = {
  origin: function (origin: string | undefined, callback: CorsCallback) {
    const allowedOrigins: string[] = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      process.env.FRONTEND_URL,
      'https://crm.leaftolife.com.sg',
      'https://leaftolife.com.sg',
    ].filter((origin): origin is string => Boolean(origin));
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - increased for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for dev)
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', limiter);

// Root endpoint
app.get('/', (_req: Request, res: Response): void => {
  res.status(200).json({
    message: 'API and backend server is running'
  });
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'L2L Backend API',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/brands', brandsRoutes);
app.use('/api/container-types', containerTypesRoutes);
app.use('/api/refunds', refundsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/blend-templates', blendTemplatesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/bundles', bundlesRoutes);
app.use('/api', appointmentsRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/webhooks', webhooksRoutes);

// 404 handler
app.use((_req: Request, res: Response): void => {
  res.status(404).json({ error: 'Not found' });
});

// Custom error interface
interface CustomError extends Error {
  status?: number;
  errors?: Record<string, unknown>;
}

// Global error handler
const errorHandler: ErrorRequestHandler = (
  err: CustomError, 
  _req: Request, 
  res: Response, 
  _next: NextFunction
): void => {
  console.error(err.stack);
  
  // Handle specific errors
  if (err.name === 'ValidationError') {
    res.status(400).json({ 
      error: 'Validation Error', 
      details: err.errors 
    });
    return;
  }
  
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ 
      error: 'Unauthorized' 
    });
    return;
  }
  
  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

app.use(errorHandler);

// Start server with dynamic port allocation
const server = createServer(app);

server.listen(PORT, () => {
  const address = server.address() as AddressInfo;
  const actualPort = address.port;
  
  // JSON status message for deployment verification
  const serverStatus = {
    status: 'SUCCESS',
    message: 'L2L Backend API Server started successfully',
    port: actualPort,
    environment: process.env.NODE_ENV || 'development',
    baseUrl: `http://localhost:${actualPort}/api`,
    healthCheck: `http://localhost:${actualPort}/health`,
    timestamp: new Date().toISOString()
  };
  
  console.log(JSON.stringify(serverStatus, null, 2));
  
  console.log(`🚀 Backend server is running on http://localhost:${actualPort}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: http://localhost:${actualPort}/api`);
  console.log(`❤️  Health Check: http://localhost:${actualPort}/health`);
  
  // If port is different from requested, suggest updating frontend config
  if (actualPort !== PORT) {
    console.log(`⚠️  Server started on port ${actualPort} instead of ${PORT}`);
    console.log(`💡 Update NEXT_PUBLIC_API_URL to: http://localhost:${actualPort}/api`);
  }
});

export default app;