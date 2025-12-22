/**
 * Security Logging Utility
 * Logs security-related events for monitoring and auditing
 */

import { NextRequest } from 'next/server';

export enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  
  // Authorization events
  ACCESS_DENIED = 'ACCESS_DENIED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // Rate limiting events
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Security violations
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  NOSQL_INJECTION_ATTEMPT = 'NOSQL_INJECTION_ATTEMPT',
  INVALID_INPUT = 'INVALID_INPUT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  
  // Password events
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  
  // Data access events
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',
  BULK_DATA_EXPORT = 'BULK_DATA_EXPORT',
  
  // API events
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  
  // System events
  SECURITY_CONFIG_CHANGE = 'SECURITY_CONFIG_CHANGE',
  AUDIT_LOG_ACCESS = 'AUDIT_LOG_ACCESS'
}

export enum SecurityEventSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export interface SecurityEvent {
  timestamp: Date;
  eventType: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  requestUrl: string;
  requestMethod: string;
  metadata?: Record<string, unknown>;
  message: string;
}

/**
 * Extract client information from request
 */
function extractClientInfo(request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const userId = request.headers.get('x-user-id') || undefined;
  const userEmail = request.headers.get('x-user-email') || undefined;
  
  return {
    ipAddress,
    userAgent,
    userId,
    userEmail,
    requestUrl: request.url,
    requestMethod: request.method
  };
}

/**
 * Security logger class
 */
export class SecurityLogger {
  private static instance: SecurityLogger;
  private logs: SecurityEvent[] = [];
  private maxLogsInMemory = 1000;

  private constructor() {}

  static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger();
    }
    return SecurityLogger.instance;
  }

  /**
   * Log a security event
   */
  log(
    eventType: SecurityEventType,
    severity: SecurityEventSeverity,
    message: string,
    request?: NextRequest,
    metadata?: Record<string, unknown>
  ): void {
    const event: SecurityEvent = {
      timestamp: new Date(),
      eventType,
      severity,
      message,
      metadata,
      ...(request ? extractClientInfo(request) : {
        ipAddress: 'system',
        userAgent: 'system',
        requestUrl: 'internal',
        requestMethod: 'internal'
      })
    };

    // Add to in-memory logs
    this.logs.push(event);
    
    // Trim logs if exceeding limit
    if (this.logs.length > this.maxLogsInMemory) {
      this.logs = this.logs.slice(-this.maxLogsInMemory);
    }

    // Log to console in development (disabled)
    // if (process.env.NODE_ENV === 'development') {
    //   // eslint-disable-next-line no-console
    //   console.log('[SECURITY]', JSON.stringify(event, null, 2));
    // }

    // In production, you would send this to a logging service
    // Example: this.sendToLoggingService(event);
  }

  /**
   * Log authentication success
   */
  logLoginSuccess(request: NextRequest, userId: string, email: string): void {
    this.log(
      SecurityEventType.LOGIN_SUCCESS,
      SecurityEventSeverity.INFO,
      `Successful login for user: ${email}`,
      request,
      { userId, email }
    );
  }

  /**
   * Log authentication failure
   */
  logLoginFailure(request: NextRequest, email: string, reason: string): void {
    this.log(
      SecurityEventType.LOGIN_FAILED,
      SecurityEventSeverity.WARNING,
      `Failed login attempt for: ${email} - ${reason}`,
      request,
      { email, reason }
    );
  }

  /**
   * Log rate limit exceeded
   */
  logRateLimitExceeded(request: NextRequest, endpoint: string): void {
    this.log(
      SecurityEventType.RATE_LIMIT_EXCEEDED,
      SecurityEventSeverity.WARNING,
      `Rate limit exceeded for endpoint: ${endpoint}`,
      request,
      { endpoint }
    );
  }

  /**
   * Log potential security threat
   */
  logSecurityThreat(
    request: NextRequest, 
    threatType: SecurityEventType, 
    details: string
  ): void {
    this.log(
      threatType,
      SecurityEventSeverity.CRITICAL,
      `Security threat detected: ${details}`,
      request,
      { threatDetails: details }
    );
  }

  /**
   * Log sensitive data access
   */
  logSensitiveDataAccess(
    request: NextRequest,
    dataType: string,
    recordIds: string[]
  ): void {
    this.log(
      SecurityEventType.SENSITIVE_DATA_ACCESS,
      SecurityEventSeverity.INFO,
      `Accessed sensitive data: ${dataType}`,
      request,
      { dataType, recordIds, count: recordIds.length }
    );
  }

  /**
   * Get recent security events
   */
  getRecentEvents(
    limit: number = 100,
    severity?: SecurityEventSeverity,
    eventType?: SecurityEventType
  ): SecurityEvent[] {
    let events = [...this.logs].reverse();
    
    if (severity) {
      events = events.filter(e => e.severity === severity);
    }
    
    if (eventType) {
      events = events.filter(e => e.eventType === eventType);
    }
    
    return events.slice(0, limit);
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(timeWindowMs: number = 3600000): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    topIPs: Array<{ ip: string; count: number }>;
    failedLogins: number;
    rateLimitHits: number;
  } {
    const cutoffTime = new Date(Date.now() - timeWindowMs);
    const recentEvents = this.logs.filter(e => e.timestamp > cutoffTime);
    
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    const ipCounts: Record<string, number> = {};
    
    let failedLogins = 0;
    let rateLimitHits = 0;
    
    recentEvents.forEach(event => {
      // Count by type
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      
      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      
      // Count by IP
      if (event.ipAddress !== 'system') {
        ipCounts[event.ipAddress] = (ipCounts[event.ipAddress] || 0) + 1;
      }
      
      // Count specific events
      if (event.eventType === SecurityEventType.LOGIN_FAILED) {
        failedLogins++;
      }
      if (event.eventType === SecurityEventType.RATE_LIMIT_EXCEEDED) {
        rateLimitHits++;
      }
    });
    
    // Get top IPs
    const topIPs = Object.entries(ipCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));
    
    return {
      totalEvents: recentEvents.length,
      eventsByType,
      eventsBySeverity,
      topIPs,
      failedLogins,
      rateLimitHits
    };
  }

  /**
   * Clear old logs
   */
  clearOldLogs(olderThanMs: number): void {
    const cutoffTime = new Date(Date.now() - olderThanMs);
    this.logs = this.logs.filter(log => log.timestamp > cutoffTime);
  }
}

// Export singleton instance
export const securityLogger = SecurityLogger.getInstance();