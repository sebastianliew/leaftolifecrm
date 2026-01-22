import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate Limiting Middleware
 *
 * PRODUCTION REQUIREMENTS:
 * - app.set('trust proxy', 1) must be configured in server.ts for correct
 *   client IP detection behind reverse proxies (Render.com, etc.)
 * - Without trust proxy, all requests appear from the same IP, making
 *   per-user rate limiting ineffective
 *
 * STORE: Uses in-memory store by default. For horizontally scaled deployments,
 * consider using rate-limit-redis for shared state across instances.
 */

/**
 * Creates a rate limit message function that includes the exact retry time
 *
 * Note: express-rate-limit v7.x with standardHeaders: 'draft-7' sends
 * RateLimit-Reset as seconds-until-reset, not a Unix timestamp
 */
const createRateLimitMessage = (errorText: string) => {
  return (_req: Request, res: Response) => {
    const resetTime = res.getHeader('RateLimit-Reset');
    let retryAt = 'later';

    if (resetTime) {
      // RateLimit-Reset is seconds until reset, not Unix timestamp
      const resetSeconds = Number(resetTime);
      const resetDate = new Date(Date.now() + resetSeconds * 1000);
      retryAt = resetDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }

    return {
      error: errorText,
      message: `Please try again at ${retryAt}`,
      retryAt
    };
  };
};

/**
 * Authentication rate limiting middleware
 * Limits failed login attempts to prevent brute force attacks
 * Successful logins don't count toward the limit
 */
export const authRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minute window
  max: 10, // 10 failed attempts per 5 minutes
  message: createRateLimitMessage('Too many authentication attempts'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true // Only count failed attempts
});

/**
 * Password reset rate limiting middleware
 * Very strict limits to prevent user enumeration and abuse
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minute window (was 1 hour)
  max: 5, // 5 attempts per 30 minutes (was 3 per hour)
  message: createRateLimitMessage('Too many password reset requests'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

/**
 * Sensitive operation rate limiting middleware
 * For financial operations like transactions and refunds
 *
 * Rate limit rationale:
 * - Increased from 30 to 100/hour to support batch transaction processing
 *   during end-of-month operations when users process many invoices
 * - skipSuccessfulRequests: true allows normal business operations while
 *   still rate-limiting abuse (only failed attempts count toward limit)
 */
export const sensitiveOperationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 100, // 100 failed operations per hour
  message: createRateLimitMessage('Rate limit exceeded for this operation'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true // Only count failed attempts - legitimate usage is unlimited
});

/**
 * Bulk operation rate limiting middleware
 * Very limited for mass delete/update operations
 */
export const bulkOperationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10, // 10 bulk operations per hour (was 5)
  message: createRateLimitMessage('Bulk operation rate limit exceeded'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

/**
 * Email sending rate limiting middleware
 * Prevents email spam attacks
 *
 * Rate limit rationale:
 * - Increased from 5 to 30/hour to support batch invoice emailing
 * - Users need to send multiple invoice emails during billing cycles
 */
export const emailRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 30, // 30 emails per hour
  message: createRateLimitMessage('Email rate limit exceeded'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

/**
 * File generation rate limiting middleware
 * Prevents disk exhaustion from invoice/report generation
 *
 * Rate limit rationale:
 * - Increased from 10 to 50/hour to support generating multiple invoices/reports
 * - skipSuccessfulRequests: true allows productive usage while limiting failed attempts
 */
export const fileGenerationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 50, // 50 failed file generations per hour
  message: createRateLimitMessage('File generation rate limit exceeded'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true // Only count failed attempts - legitimate usage is unlimited
});

/**
 * Token refresh rate limiting middleware
 * Balanced limit for token refresh operations
 */
export const tokenRefreshRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // 30 refreshes per minute
  message: createRateLimitMessage('Too many token refresh requests'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true // Skip successful refreshes
});
