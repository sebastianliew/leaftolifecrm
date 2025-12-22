export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, _details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests', _retryAfter?: number) {
    super(message, 429, 'TOO_MANY_REQUESTS');
    this.name = 'TooManyRequestsError';
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
    this.name = 'InternalServerError';
  }
}

// User-specific errors
export class UserNotFoundError extends NotFoundError {
  constructor(identifier?: string) {
    const message = identifier 
      ? `User with identifier '${identifier}' not found`
      : 'User not found';
    super(message);
    this.code = 'USER_NOT_FOUND';
  }
}

export class UserAlreadyExistsError extends ConflictError {
  constructor(field: string, value: string) {
    super(`User with ${field} '${value}' already exists`);
    this.code = 'USER_ALREADY_EXISTS';
  }
}

export class InvalidCredentialsError extends AuthenticationError {
  constructor() {
    super('Invalid email or password');
    this.code = 'INVALID_CREDENTIALS';
  }
}

export class AccountLockedError extends AuthenticationError {
  lockoutEnd?: Date;

  constructor(lockoutEnd?: Date) {
    super('Account is temporarily locked due to too many failed login attempts');
    this.code = 'ACCOUNT_LOCKED';
    this.lockoutEnd = lockoutEnd;
  }
}

export class AccountDeactivatedError extends AuthenticationError {
  constructor() {
    super('Account is deactivated');
    this.code = 'ACCOUNT_DEACTIVATED';
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(tokenType: string = 'token') {
    super(`Invalid or expired ${tokenType}`);
    this.code = 'INVALID_TOKEN';
  }
}

export class PermissionDeniedError extends AuthorizationError {
  constructor(resource: string, action: string) {
    super(`Permission denied for ${action} on ${resource}`);
    this.code = 'PERMISSION_DENIED';
  }
}

export class DiscountLimitExceededError extends AuthorizationError {
  constructor(limit: string, attempted: string) {
    super(`Discount limit exceeded. Maximum allowed: ${limit}, attempted: ${attempted}`);
    this.code = 'DISCOUNT_LIMIT_EXCEEDED';
  }
}

export class WeakPasswordError extends ValidationError {
  constructor() {
    super('Password does not meet security requirements');
    this.code = 'WEAK_PASSWORD';
  }
}

export class PasswordReusedError extends ValidationError {
  constructor() {
    super('New password cannot be the same as the current password');
    this.code = 'PASSWORD_REUSED';
  }
}

// Error handler utility
export const handleError = (error: unknown) => {
  if (error instanceof AppError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      isOperational: error.isOperational
    };
  }

  // Handle Mongoose validation errors
  if (error && typeof error === 'object' && 'name' in error && error.name === 'ValidationError' && 'errors' in error) {
    const mongooseError = error as unknown as { errors: Record<string, { message: string }> };
    const messages = Object.values(mongooseError.errors).map((err) => err.message);
    return {
      message: `Validation failed: ${messages.join(', ')}`,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      isOperational: true
    };
  }

  // Handle Mongoose duplicate key errors
  if (error && typeof error === 'object' && 'code' in error && error.code === 11000 && 'keyValue' in error) {
    const duplicateError = error as unknown as { keyValue: Record<string, unknown> };
    const field = Object.keys(duplicateError.keyValue)[0];
    const value = duplicateError.keyValue[field];
    return {
      message: `${field} '${value}' already exists`,
      statusCode: 409,
      code: 'DUPLICATE_KEY_ERROR',
      isOperational: true
    };
  }

  // Handle JWT errors
  if (error && typeof error === 'object' && 'name' in error && error.name === 'JsonWebTokenError') {
    return {
      message: 'Invalid token',
      statusCode: 401,
      code: 'INVALID_TOKEN',
      isOperational: true
    };
  }

  if (error && typeof error === 'object' && 'name' in error && error.name === 'TokenExpiredError') {
    return {
      message: 'Token expired',
      statusCode: 401,
      code: 'TOKEN_EXPIRED',
      isOperational: true
    };
  }

  // Default error
  console.error('Unhandled error:', error);
  return {
    message: 'An unexpected error occurred',
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    isOperational: false
  };
};

// Error response utility for API routes
export const errorResponse = (error: unknown) => {
  const handled = handleError(error);
  
  return {
    error: {
      message: handled.message,
      code: handled.code,
      ...(process.env.NODE_ENV === 'development' && !handled.isOperational && error instanceof Error && {
        stack: error.stack
      })
    }
  };
};