import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

// Extended Request interface for webhook context
export interface WebhookRequest extends Request {
  webhookContext?: {
    verified: boolean;
    source: string;
    timestamp: Date;
    signature?: string;
  };
}

// Interface for webhook response bodies
interface WebhookErrorResponse {
  error: string;
  message?: string;
  retryAfter?: string;
}

/**
 * Webhook rate limiting middleware
 * Applies more restrictive rate limiting to webhook endpoints
 */
export const webhookRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs for webhooks
  message: {
    error: 'Too many webhook requests from this IP',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for successful requests to avoid penalizing legitimate webhooks
  skipSuccessfulRequests: false,
  // Custom key generator to include user agent in rate limiting
  keyGenerator: (req: Request) => {
    return `${req.ip}-${req.get('User-Agent')?.substring(0, 50) || 'unknown'}`;
  }
});

/**
 * Webhook security validation middleware
 * Validates webhook requests based on IP whitelist and basic security checks
 */
export const webhookSecurity = (options: {
  allowedIPs?: string[];
  requireUserAgent?: boolean;
  maxBodySize?: number;
} = {}) => {
  return (req: WebhookRequest, res: Response, next: NextFunction): void => {
    try {
      const {
        allowedIPs = [],
        requireUserAgent = true,
        maxBodySize = 1024 * 1024 // 1MB default
      } = options;

      // Initialize webhook context
      req.webhookContext = {
        verified: false,
        source: 'unknown',
        timestamp: new Date()
      };

      // Check IP whitelist if configured
      if (allowedIPs.length > 0) {
        const clientIP = req.ip || req.connection.remoteAddress || '';
        const isAllowed = allowedIPs.some(allowedIP => {
          // Support CIDR notation or exact IP match
          if (allowedIP.includes('/')) {
            // Simple CIDR check (can be enhanced with a proper library)
            const [network, mask] = allowedIP.split('/');
            return clientIP.startsWith(network.split('.').slice(0, parseInt(mask) / 8).join('.'));
          }
          return clientIP === allowedIP;
        });

        if (!isAllowed) {
          console.warn(`🚨 Webhook request from unauthorized IP: ${clientIP}`);
          res.status(403).json({
            error: 'Forbidden',
            message: 'IP address not authorized'
          });
          return;
        }
      }

      // Check User-Agent header
      if (requireUserAgent) {
        const userAgent = req.get('User-Agent');
        if (!userAgent || userAgent.trim().length === 0) {
          console.warn(`🚨 Webhook request without User-Agent from IP: ${req.ip}`);
          res.status(400).json({
            error: 'Bad Request',
            message: 'User-Agent header required'
          });
          return;
        }

        // Block suspicious user agents
        const suspiciousPatterns = [
          /bot/i,
          /crawler/i,
          /spider/i,
          /scanner/i,
          /curl/i // Can be removed if you expect legitimate curl requests
        ];

        if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
          console.warn(`🚨 Webhook request with suspicious User-Agent: ${userAgent} from IP: ${req.ip}`);
          res.status(403).json({
            error: 'Forbidden',
            message: 'Suspicious user agent'
          });
          return;
        }
      }

      // Check content length
      const contentLength = parseInt(req.get('content-length') || '0');
      if (contentLength > maxBodySize) {
        console.warn(`🚨 Webhook request body too large: ${contentLength} bytes from IP: ${req.ip}`);
        res.status(413).json({
          error: 'Payload Too Large',
          message: `Request body must be less than ${maxBodySize / 1024 / 1024}MB`
        });
        return;
      }

      // Check content type for POST requests
      if (req.method === 'POST') {
        const contentType = req.get('content-type');
        if (!contentType || (!contentType.includes('application/json') && !contentType.includes('application/x-www-form-urlencoded'))) {
          console.warn(`🚨 Webhook request with invalid content-type: ${contentType} from IP: ${req.ip}`);
          res.status(415).json({
            error: 'Unsupported Media Type',
            message: 'Content-Type must be application/json or application/x-www-form-urlencoded'
          });
          return;
        }
      }

      // Log successful security validation
      console.log(`🔐 Webhook security validation passed for IP: ${req.ip}, UA: ${req.get('User-Agent')?.substring(0, 50)}`);
      
      req.webhookContext.verified = true;
      req.webhookContext.source = 'validated';
      
      next();
    } catch (error) {
      console.error('❌ Webhook security middleware error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Security validation failed'
      });
      return;
    }
  };
};

/**
 * Fluent Forms signature validation middleware
 * Validates webhook signatures from Fluent Forms Pro (if configured)
 */
export const fluentFormsSignature = (secretKey?: string) => {
  return (req: WebhookRequest, res: Response, next: NextFunction): void => {
    try {
      // Skip signature validation if no secret key configured
      if (!secretKey) {
        console.log('⚠️  Fluent Forms webhook signature validation skipped (no secret key)');
        next();
        return;
      }

      const signature = req.get('x-fluent-signature') || req.get('x-signature');
      
      if (!signature) {
        console.warn(`🚨 Fluent Forms webhook missing signature from IP: ${req.ip}`);
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Webhook signature required'
        });
        return;
      }

      // Validate signature
      const bodyString = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(bodyString)
        .digest('hex');

      const receivedSignature = signature.replace('sha256=', '');

      if (!crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex')
      )) {
        console.warn(`🚨 Fluent Forms webhook signature mismatch from IP: ${req.ip}`);
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid webhook signature'
        });
        return;
      }

      console.log(`✅ Fluent Forms webhook signature validated for IP: ${req.ip}`);
      
      if (req.webhookContext) {
        req.webhookContext.signature = receivedSignature;
        req.webhookContext.verified = true;
      }

      next();
    } catch (error) {
      console.error('❌ Fluent Forms signature validation error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Signature validation failed'
      });
      return;
    }
  };
};

/**
 * Webhook timestamp validation middleware
 * Prevents replay attacks by checking request timestamps
 */
export const webhookTimestamp = (toleranceMinutes: number = 5) => {
  return (req: WebhookRequest, res: Response, next: NextFunction): void => {
    try {
      const timestampHeader = req.get('x-timestamp') || req.get('timestamp');
      
      if (!timestampHeader) {
        console.warn(`⚠️  Webhook timestamp header missing from IP: ${req.ip}`);
        // Don't fail if timestamp is missing, just log it
        next();
        return;
      }

      const requestTimestamp = new Date(timestampHeader);
      const now = new Date();
      const timeDifference = Math.abs(now.getTime() - requestTimestamp.getTime());
      const toleranceMs = toleranceMinutes * 60 * 1000;

      if (timeDifference > toleranceMs) {
        console.warn(`🚨 Webhook timestamp too old: ${timeDifference}ms difference from IP: ${req.ip}`);
        res.status(400).json({
          error: 'Bad Request',
          message: `Request timestamp too old. Max tolerance: ${toleranceMinutes} minutes`
        });
        return;
      }

      console.log(`⏰ Webhook timestamp validated (${timeDifference}ms difference) for IP: ${req.ip}`);
      next();
    } catch (error) {
      console.error('❌ Webhook timestamp validation error:', error);
      // Don't fail on timestamp validation errors, just log them
      next();
    }
  };
};

/**
 * Webhook request logging middleware
 * Logs webhook requests for monitoring and debugging
 */
export const webhookLogger = (req: WebhookRequest, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Log incoming request
  console.log(`📥 Webhook Request: ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    timestamp: new Date().toISOString()
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body: WebhookErrorResponse) {
    const duration = Date.now() - start;
    console.log(`📤 Webhook Response: ${res.statusCode}`, {
      duration: `${duration}ms`,
      success: res.statusCode < 400,
      path: req.path,
      ip: req.ip
    });
    return originalJson.call(this, body);
  };

  next();
};