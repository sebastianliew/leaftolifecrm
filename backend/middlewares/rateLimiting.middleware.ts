import rateLimit from 'express-rate-limit';

/**
 * Authentication rate limiting middleware
 * Strict limits for login and authentication-related endpoints
 * Prevents brute force attacks on credentials
 */
export const authRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // 5 attempts per minute
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

/**
 * Password reset rate limiting middleware
 * Very strict limits to prevent user enumeration and abuse
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 3, // 3 attempts per hour
  message: {
    error: 'Too many password reset requests',
    message: 'Please try again later',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

/**
 * Sensitive operation rate limiting middleware
 * For financial operations like transactions and refunds
 */
export const sensitiveOperationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 30, // 30 operations per hour
  message: {
    error: 'Rate limit exceeded for this operation',
    message: 'Please try again later',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

/**
 * Bulk operation rate limiting middleware
 * Very limited for mass delete/update operations
 */
export const bulkOperationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // 5 bulk operations per hour
  message: {
    error: 'Bulk operation rate limit exceeded',
    message: 'Please try again later',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

/**
 * Email sending rate limiting middleware
 * Prevents email spam attacks
 */
export const emailRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // 5 emails per hour
  message: {
    error: 'Email rate limit exceeded',
    message: 'Please try again later',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

/**
 * File generation rate limiting middleware
 * Prevents disk exhaustion from invoice/report generation
 */
export const fileGenerationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10, // 10 file generations per hour
  message: {
    error: 'File generation rate limit exceeded',
    message: 'Please try again later',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

/**
 * Token refresh rate limiting middleware
 * Balanced limit for token refresh operations
 */
export const tokenRefreshRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // 30 refreshes per minute
  message: {
    error: 'Too many token refresh requests',
    message: 'Please try again later',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Skip successful refreshes
});
