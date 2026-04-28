import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

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
 * Global kill-switch for rate limiting.
 *
 * Set RATE_LIMITS_DISABLED=false to re-enable per-route limiters. Default is
 * `true`: clinic staff (non-technical) were repeatedly hitting limits during
 * normal workflow because the office IP is shared across the whole team and
 * shared per-IP budgets get exhausted very quickly. The decision was to err
 * toward "always let users through" and rely on application-layer guards
 * (auth, permissions, validation) for protection. Brute-force protection
 * for /auth/login is the main thing this gives up — accept that risk in
 * exchange for unblocking daily operations.
 *
 * To re-enable globally:
 *   export RATE_LIMITS_DISABLED=false
 *
 * To re-enable selectively, also flip individual `skip` functions back to
 * the per-route logic.
 */
const RATE_LIMITS_DISABLED: boolean =
  (process.env.RATE_LIMITS_DISABLED ?? 'true').toLowerCase() !== 'false';

/**
 * Whitelist of identities exempt from rate limiting.
 *
 * Configured via RATE_LIMIT_EXEMPT_IDENTITIES env var (comma-separated
 * substrings, case-insensitive). Default includes "sebastianliew" (client
 * owner) and "customerservice" (clinic's outgoing invoice sender — kept on
 * the list so re-enabling rate limits later doesn't immediately re-block
 * invoice emailing).
 *
 * Match is a case-insensitive substring on email OR username (so
 * "sebastianliew", "sebastianliew@example.com", and
 * "Sebastian.Liew@..." all match the entry "sebastianliew").
 */
const EXEMPT_IDENTITIES: string[] = (process.env.RATE_LIMIT_EXEMPT_IDENTITIES || 'sebastianliew,customerservice')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function matchesExemptIdentity(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false;
  const v = value.toLowerCase();
  return EXEMPT_IDENTITIES.some((needle) => v.includes(needle));
}

/**
 * Direct email/username check — for callers (e.g. the refresh handler)
 * that already have the user object loaded and don't have the identity
 * in req.user / req.body / auth header.
 */
export function isExemptIdentity(email?: unknown, username?: unknown): boolean {
  return matchesExemptIdentity(email) || matchesExemptIdentity(username);
}

/**
 * Returns true when this request belongs to a rate-limit-exempt identity.
 *
 * Order of checks:
 *   1. req.user (set by auth middleware on already-protected routes)
 *   2. req.body.email (login / password reset payloads)
 *   3. Decoded JWT payload from Authorization header — used for the global
 *      limiter, which runs BEFORE auth middleware so req.user is empty.
 *      We do NOT verify the signature here: a forged JWT only buys an
 *      attacker the right to skip rate limits, not to make any actual
 *      API call (the real auth middleware downstream still verifies).
 */
type RateLimitRequest = Pick<Request, 'headers'> & {
  body?: unknown;
  user?: unknown;
};

export function isExemptFromRateLimit(req: RateLimitRequest): boolean {
  // Global kill-switch — when rate limits are disabled, every request is
  // exempt. Lets the per-route `skip: isExemptFromRateLimit` wiring stay in
  // place so re-enabling is a single env-var flip.
  if (RATE_LIMITS_DISABLED) return true;

  const user = (req as { user?: { email?: string; username?: string } }).user;
  if (user && (matchesExemptIdentity(user.email) || matchesExemptIdentity(user.username))) {
    return true;
  }

  const bodyEmail = (req.body as { email?: unknown } | undefined)?.email;
  if (matchesExemptIdentity(bodyEmail)) return true;

  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.decode(token) as { email?: unknown; username?: unknown } | null;
      if (decoded && (matchesExemptIdentity(decoded.email) || matchesExemptIdentity(decoded.username))) {
        return true;
      }
    } catch {
      // Malformed token — fall through, the real auth middleware will reject it.
    }
  }

  return false;
}

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
  skipSuccessfulRequests: true, // Only count failed attempts
  skip: isExemptFromRateLimit
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
  skipSuccessfulRequests: false,
  skip: isExemptFromRateLimit
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
  skipSuccessfulRequests: true, // Only count failed attempts - legitimate usage is unlimited
  skip: isExemptFromRateLimit
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
  skipSuccessfulRequests: false,
  skip: isExemptFromRateLimit
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
  skipSuccessfulRequests: false,
  // Honors the global kill-switch via isExemptFromRateLimit; super_admin and
  // whitelisted identities (e.g. customerservice, sebastianliew) are always
  // exempt even when rate limits are re-enabled.
  skip: (req) =>
    isExemptFromRateLimit(req) ||
    (req as { user?: { role?: string } }).user?.role === 'super_admin'
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
  skipSuccessfulRequests: true, // Only count failed attempts - legitimate usage is unlimited
  skip: isExemptFromRateLimit
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
  skipSuccessfulRequests: true, // Skip successful refreshes
  skip: isExemptFromRateLimit
});
