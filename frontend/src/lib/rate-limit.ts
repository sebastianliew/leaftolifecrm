/**
 * Rate limiting implementation for Next.js API routes
 * Uses in-memory storage for development, can be extended to use Redis for production
 */

import { NextRequest } from 'next/server';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Error message when rate limit is exceeded
  keyGenerator?: (req: NextRequest) => string; // Function to generate rate limit key
  skipSuccessfulRequests?: boolean; // Skip counting successful requests
  skipFailedRequests?: boolean; // Skip counting failed requests
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (consider Redis for production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Default key generator - uses IP address
 */
const defaultKeyGenerator = (req: NextRequest): string => {
  const ip = req.headers.get('x-forwarded-for') || 
             req.headers.get('x-real-ip') || 
             'unknown';
  return `ratelimit:${ip}`;
};

/**
 * Create a rate limiter with specified configuration
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = config;

  return {
    /**
     * Check if request should be rate limited
     */
    check: async (req: NextRequest): Promise<{ 
      limited: boolean; 
      remaining: number; 
      reset: Date;
      limit: number;
    }> => {
      const key = keyGenerator(req);
      const now = Date.now();
      const resetTime = now + windowMs;

      let entry = rateLimitStore.get(key);

      // Initialize or reset if window expired
      if (!entry || entry.resetTime < now) {
        entry = { count: 0, resetTime };
        rateLimitStore.set(key, entry);
      }

      // Check if limit exceeded
      const limited = entry.count >= maxRequests;
      const remaining = Math.max(0, maxRequests - entry.count);
      const reset = new Date(entry.resetTime);

      return { 
        limited, 
        remaining, 
        reset,
        limit: maxRequests
      };
    },

    /**
     * Increment the counter for this request
     */
    increment: async (req: NextRequest, successful: boolean): Promise<void> => {
      if (skipSuccessfulRequests && successful) return;
      if (skipFailedRequests && !successful) return;

      const key = keyGenerator(req);
      const entry = rateLimitStore.get(key);
      
      if (entry) {
        entry.count++;
      }
    },

    /**
     * Get rate limit headers
     */
    getHeaders: (result: { remaining: number; reset: Date; limit: number }) => {
      return {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.toISOString(),
        'Retry-After': Math.ceil((result.reset.getTime() - Date.now()) / 1000).toString(),
      };
    },

    /**
     * Error response for rate limited requests
     */
    errorResponse: () => {
      return {
        error: {
          message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: windowMs / 1000,
        }
      };
    }
  };
}

/**
 * Pre-configured rate limiters for different endpoints
 */
export const rateLimiters = {
  // Strict limit for authentication endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 requests per 15 minutes
    message: 'Too many authentication attempts. Please try again later.',
  }),

  // Moderate limit for API endpoints
  api: createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    message: 'API rate limit exceeded. Please slow down your requests.',
  }),

  // Relaxed limit for read-only endpoints
  read: createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    skipFailedRequests: true,
  }),

  // Very strict limit for password reset
  passwordReset: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 requests per hour
    message: 'Too many password reset attempts. Please try again later.',
    keyGenerator: (req: NextRequest) => {
      // Rate limit by email instead of IP for password reset
      const body = req.body;
      const email = body && typeof body === 'object' && 'email' in body 
        ? String(body.email) 
        : 'unknown';
      return `ratelimit:passwordreset:${email}`;
    },
  }),

  // Limit for creating resources
  create: createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 20, // 20 creates per 5 minutes
    message: 'Too many create requests. Please try again later.',
  }),
};

/**
 * Rate limit middleware for Next.js API routes
 */
export async function withRateLimit(
  req: NextRequest,
  handler: () => Promise<Response>,
  rateLimiter = rateLimiters.api
): Promise<Response> {
  // Check rate limit
  const result = await rateLimiter.check(req);
  
  // If rate limited, return error
  if (result.limited) {
    return new Response(
      JSON.stringify(rateLimiter.errorResponse()),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...rateLimiter.getHeaders(result),
        },
      }
    );
  }

  // Process request
  try {
    const response = await handler();
    
    // Increment counter for successful request
    await rateLimiter.increment(req, response.ok);
    
    // Add rate limit headers to response
    const headers = new Headers(response.headers);
    Object.entries(rateLimiter.getHeaders(result)).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    // Increment counter for failed request
    await rateLimiter.increment(req, false);
    throw error;
  }
}

/**
 * IP-based rate limiting with different limits per IP range
 */
export function createIPRateLimiter(rules: Array<{
  pattern: RegExp;
  windowMs: number;
  maxRequests: number;
}>) {
  return createRateLimiter({
    windowMs: 60000, // Default 1 minute
    maxRequests: 60, // Default 60 requests
    keyGenerator: (req: NextRequest) => {
      const ip = req.headers.get('x-forwarded-for') || 
                 req.headers.get('x-real-ip') || 
                 'unknown';
      
      // Find matching rule for IP
      const rule = rules.find(r => r.pattern.test(ip));
      
      if (rule) {
        return `ratelimit:${ip}:${rule.maxRequests}:${rule.windowMs}`;
      }
      
      return `ratelimit:${ip}`;
    },
  });
}