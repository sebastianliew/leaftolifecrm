import { NextResponse } from 'next/server';
import { logger } from './logger';

export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly isOperational: boolean
  public readonly details?: unknown

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = isOperational
    this.details = details

    Object.setPrototypeOf(this, new.target.prototype)
    Error.captureStackTrace(this, this.constructor)
  }
}

// Predefined error types
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', true, details)
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR', true)
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR', true)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`
    super(message, 404, 'NOT_FOUND', true)
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'CONFLICT', true, details)
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true)
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE', false)
  }
}

// Error handler for API routes
export function handleApiError(error: unknown): NextResponse {
  const errorLogger = logger.child('ErrorHandler')

  // Handle known operational errors
  if (error instanceof AppError) {
    if (!error.isOperational) {
      errorLogger.error('Non-operational error occurred', error)
    } else {
      errorLogger.warn('Operational error', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details
      })
    }

    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      },
      { status: error.statusCode }
    )
  }

  // Handle Mongoose validation errors
  if (error instanceof Error && error.name === 'ValidationError') {
    const mongooseError = error as Error & {
      errors?: Record<string, { path: string; message: string }>
    }
    const validationErrors = Object.values(mongooseError.errors || {}).map(
      (err) => ({
        field: err.path,
        message: err.message
      })
    )

    return NextResponse.json(
      {
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors
        }
      },
      { status: 400 }
    )
  }

  // Handle unknown errors
  errorLogger.error('Unexpected error occurred', error)

  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : error instanceof Error ? error.message : 'Unknown error'

  return NextResponse.json(
    {
      error: {
        message,
        code: 'INTERNAL_ERROR'
      }
    },
    { status: 500 }
  )
}

// Async error wrapper for API routes
export function asyncHandler<T extends (...args: unknown[]) => Promise<unknown>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error)
    }
  }) as T
}

// Client-side error handler
export function handleClientError(error: unknown): void {
  const errorLogger = logger.child('ClientErrorHandler')

  if (error instanceof AppError) {
    errorLogger.warn('Client error', {
      message: error.message,
      code: error.code
    })
    
    // You can add toast notifications here
    // toast.error(error.message)
  } else if (error instanceof Error) {
    errorLogger.error('Unexpected client error', error)
    
    // Generic error message for unknown errors
    // toast.error('Something went wrong. Please try again.')
  } else {
    errorLogger.error('Unknown client error', { error })
  }
}

// Type guard for checking if error is an API error response
export interface ApiErrorResponse {
  error: {
    message: string
    code: string
    details?: unknown
  }
}

export function isApiErrorResponse(obj: unknown): obj is ApiErrorResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'error' in obj &&
    typeof (obj as Record<string, unknown>).error === 'object' &&
    (obj as Record<string, unknown>).error !== null &&
    'message' in ((obj as Record<string, unknown>).error as Record<string, unknown>) &&
    'code' in ((obj as Record<string, unknown>).error as Record<string, unknown>)
  )
}

// Convert various error types to AppError
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    return new AppError(error.message, 500, 'INTERNAL_ERROR', false)
  }

  if (typeof error === 'string') {
    return new AppError(error, 500, 'INTERNAL_ERROR', false)
  }

  return new AppError('An unknown error occurred', 500, 'UNKNOWN_ERROR', false)
}