/**
 * Centralized error handling middleware.
 *
 * Usage:
 *   router.get('/products', asyncHandler(getProducts));
 *
 * Eliminates duplicate try-catch blocks across all controllers.
 * Supports typed error classes for clean HTTP status mapping.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

// ── Error Classes ──

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, id ? `${resource} with id ${id} not found` : `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Not authorized') {
    super(403, message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

// ── asyncHandler ──
// Wraps async route handlers so thrown errors go to the error middleware
// instead of crashing with unhandled promise rejection.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asyncHandler(
  fn: (req: any, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ── Central Error Handler Middleware ──
// Mount as the LAST middleware: app.use(errorHandler)

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Known application errors
  if (err instanceof AppError) {
    const body: Record<string, unknown> = { error: err.message };
    if (err.code) body.code = err.code;
    if (err.details) body.details = err.details;
    res.status(err.statusCode).json(body);
    return;
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({ error: err.message });
    return;
  }

  // Mongoose cast errors (invalid ObjectId etc.)
  if (err.name === 'CastError') {
    res.status(400).json({ error: 'Invalid ID format' });
    return;
  }

  // Mongoose duplicate key
  if ((err as { code?: number }).code === 11000) {
    res.status(409).json({ error: 'Duplicate entry', details: err.message });
    return;
  }

  // Unauthorized
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Unknown errors
  console.error('[ErrorHandler] Unhandled error:', err);
  res.status((err as { status?: number }).status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
