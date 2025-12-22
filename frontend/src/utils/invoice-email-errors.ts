/**
 * Invoice Email Error Handling Utilities
 * Provides standardized error handling for invoice email operations
 */

export enum InvoiceEmailErrorType {
  // Configuration errors
  SERVICE_DISABLED = 'SERVICE_DISABLED',
  INVALID_CONFIG = 'INVALID_CONFIG',
  
  // Data validation errors
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  INVALID_EMAIL = 'INVALID_EMAIL',
  MISSING_CUSTOMER_INFO = 'MISSING_CUSTOMER_INFO',
  
  // PDF generation errors
  PDF_GENERATION_FAILED = 'PDF_GENERATION_FAILED',
  PDF_NOT_FOUND = 'PDF_NOT_FOUND',
  PDF_ACCESS_DENIED = 'PDF_ACCESS_DENIED',
  
  // Email sending errors
  EMAIL_AUTH_FAILED = 'EMAIL_AUTH_FAILED',
  EMAIL_CONNECTION_TIMEOUT = 'EMAIL_CONNECTION_TIMEOUT',
  EMAIL_INVALID_RECIPIENT = 'EMAIL_INVALID_RECIPIENT',
  EMAIL_MESSAGE_TOO_LARGE = 'EMAIL_MESSAGE_TOO_LARGE',
  EMAIL_QUOTA_EXCEEDED = 'EMAIL_QUOTA_EXCEEDED',
  EMAIL_SERVER_ERROR = 'EMAIL_SERVER_ERROR',
  
  // System errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  FILESYSTEM_ERROR = 'FILESYSTEM_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  
  // Business logic errors
  ALREADY_SENT = 'ALREADY_SENT',
  TRANSACTION_NOT_COMPLETED = 'TRANSACTION_NOT_COMPLETED',
  
  // Unknown errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Context object for error tracking
interface ErrorContext {
  transactionId?: string;
  transactionNumber?: string;
  customerEmail?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface InvoiceEmailError {
  type: InvoiceEmailErrorType;
  message: string;
  originalError?: Error;
  retryable: boolean;
  context?: ErrorContext;
  suggestedAction?: string;
  timestamp: Date;
}

export class InvoiceEmailErrorHandler {
  
  /**
   * Categorize and handle different types of errors
   */
  static handleError(error: unknown, context?: ErrorContext): InvoiceEmailError {
    const timestamp = new Date();
    
    // Handle specific error types
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      // Email authentication errors
      if (errorMessage.includes('invalid login') || errorMessage.includes('authentication failed')) {
        return {
          type: InvoiceEmailErrorType.EMAIL_AUTH_FAILED,
          message: 'Email authentication failed. Please check SMTP credentials.',
          originalError: error,
          retryable: false,
          context,
          suggestedAction: 'Verify EMAIL_USER and EMAIL_PASS environment variables',
          timestamp
        };
      }
      
      // Email connection errors
      if (errorMessage.includes('connection timeout') || errorMessage.includes('etimedout')) {
        return {
          type: InvoiceEmailErrorType.EMAIL_CONNECTION_TIMEOUT,
          message: 'Email server connection timeout.',
          originalError: error,
          retryable: true,
          context,
          suggestedAction: 'Check SMTP_HOST and SMTP_PORT settings, or try again',
          timestamp
        };
      }
      
      // Invalid recipient errors
      if (errorMessage.includes('invalid recipient') || errorMessage.includes('invalid email')) {
        return {
          type: InvoiceEmailErrorType.EMAIL_INVALID_RECIPIENT,
          message: `Invalid recipient email address: ${context?.customerEmail || 'unknown'}`,
          originalError: error,
          retryable: false,
          context,
          suggestedAction: 'Update customer email address in transaction',
          timestamp
        };
      }
      
      // Message size errors
      if (errorMessage.includes('message too large') || errorMessage.includes('size limit')) {
        return {
          type: InvoiceEmailErrorType.EMAIL_MESSAGE_TOO_LARGE,
          message: 'Email message too large, likely due to PDF attachment size.',
          originalError: error,
          retryable: false,
          context,
          suggestedAction: 'Try sending without PDF attachment or reduce PDF size',
          timestamp
        };
      }
      
      // Quota exceeded errors
      if (errorMessage.includes('quota exceeded') || errorMessage.includes('rate limit')) {
        return {
          type: InvoiceEmailErrorType.EMAIL_QUOTA_EXCEEDED,
          message: 'Email quota or rate limit exceeded.',
          originalError: error,
          retryable: true,
          context,
          suggestedAction: 'Wait before retrying or check email service limits',
          timestamp
        };
      }
      
      // PDF generation errors
      if (errorMessage.includes('pdf') || errorMessage.includes('puppeteer')) {
        return {
          type: InvoiceEmailErrorType.PDF_GENERATION_FAILED,
          message: 'Failed to generate PDF invoice.',
          originalError: error,
          retryable: true,
          context,
          suggestedAction: 'Send HTML email as fallback or check PDF generation service',
          timestamp
        };
      }
      
      // File system errors
      if (errorMessage.includes('enoent') || errorMessage.includes('file not found')) {
        return {
          type: InvoiceEmailErrorType.PDF_NOT_FOUND,
          message: 'PDF invoice file not found.',
          originalError: error,
          retryable: true,
          context,
          suggestedAction: 'Regenerate PDF or send HTML email',
          timestamp
        };
      }
      
      // Permission errors
      if (errorMessage.includes('permission denied') || errorMessage.includes('eacces')) {
        return {
          type: InvoiceEmailErrorType.PDF_ACCESS_DENIED,
          message: 'Permission denied accessing PDF file.',
          originalError: error,
          retryable: false,
          context,
          suggestedAction: 'Check file permissions for PDF directory',
          timestamp
        };
      }
      
      // Database errors
      if (errorMessage.includes('mongodb') || errorMessage.includes('mongoose') || errorMessage.includes('database')) {
        return {
          type: InvoiceEmailErrorType.DATABASE_ERROR,
          message: 'Database operation failed.',
          originalError: error,
          retryable: true,
          context,
          suggestedAction: 'Check database connection and try again',
          timestamp
        };
      }
      
      // Network errors
      if (errorMessage.includes('network') || errorMessage.includes('enotfound') || errorMessage.includes('econnrefused')) {
        return {
          type: InvoiceEmailErrorType.NETWORK_ERROR,
          message: 'Network connection failed.',
          originalError: error,
          retryable: true,
          context,
          suggestedAction: 'Check network connectivity and try again',
          timestamp
        };
      }
      
      // Memory errors
      if (errorMessage.includes('out of memory') || errorMessage.includes('heap')) {
        return {
          type: InvoiceEmailErrorType.MEMORY_ERROR,
          message: 'Insufficient memory for operation.',
          originalError: error,
          retryable: false,
          context,
          suggestedAction: 'Reduce PDF size or restart the service',
          timestamp
        };
      }
    }
    
    // Handle string errors
    if (typeof error === 'string') {
      if (error.includes('Service is disabled')) {
        return {
          type: InvoiceEmailErrorType.SERVICE_DISABLED,
          message: 'Invoice email service is disabled.',
          retryable: false,
          context,
          suggestedAction: 'Enable invoice email service in configuration',
          timestamp
        };
      }
      
      if (error.includes('Transaction not found')) {
        return {
          type: InvoiceEmailErrorType.TRANSACTION_NOT_FOUND,
          message: 'Transaction not found.',
          retryable: false,
          context,
          suggestedAction: 'Verify transaction ID is correct',
          timestamp
        };
      }
      
      if (error.includes('already sent')) {
        return {
          type: InvoiceEmailErrorType.ALREADY_SENT,
          message: 'Invoice email already sent.',
          retryable: false,
          context,
          suggestedAction: 'Use force resend option if needed',
          timestamp
        };
      }
    }
    
    // Default to unknown error
    return {
      type: InvoiceEmailErrorType.UNKNOWN_ERROR,
      message: error instanceof Error ? error.message : String(error),
      originalError: error instanceof Error ? error : undefined,
      retryable: true,
      context,
      suggestedAction: 'Review error details and try again',
      timestamp
    };
  }
  
  /**
   * Determine if an error should trigger a retry
   */
  static shouldRetry(error: InvoiceEmailError, attemptNumber: number, maxAttempts: number): boolean {
    if (attemptNumber >= maxAttempts) {
      return false;
    }
    
    if (!error.retryable) {
      return false;
    }
    
    // Don't retry certain error types even if marked as retryable
    const noRetryTypes = [
      InvoiceEmailErrorType.EMAIL_AUTH_FAILED,
      InvoiceEmailErrorType.EMAIL_INVALID_RECIPIENT,
      InvoiceEmailErrorType.EMAIL_MESSAGE_TOO_LARGE,
      InvoiceEmailErrorType.INVALID_EMAIL,
      InvoiceEmailErrorType.TRANSACTION_NOT_FOUND,
      InvoiceEmailErrorType.SERVICE_DISABLED,
      InvoiceEmailErrorType.MEMORY_ERROR
    ];
    
    if (noRetryTypes.includes(error.type)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Calculate retry delay with exponential backoff
   */
  static getRetryDelay(attemptNumber: number, baseDelayMs: number = 5000): number {
    const maxDelay = 300000; // 5 minutes max
    const delay = baseDelayMs * Math.pow(2, attemptNumber - 1);
    return Math.min(delay, maxDelay);
  }
  
  /**
   * Get user-friendly error message
   */
  static getUserFriendlyMessage(error: InvoiceEmailError): string {
    switch (error.type) {
      case InvoiceEmailErrorType.EMAIL_AUTH_FAILED:
        return 'Email service authentication failed. Please contact system administrator.';
      
      case InvoiceEmailErrorType.EMAIL_INVALID_RECIPIENT:
        return 'Invalid email address. Please update customer email and try again.';
      
      case InvoiceEmailErrorType.EMAIL_MESSAGE_TOO_LARGE:
        return 'Invoice file is too large to email. Please download directly from the system.';
      
      case InvoiceEmailErrorType.PDF_GENERATION_FAILED:
        return 'Unable to generate PDF invoice. Email will be sent without attachment.';
      
      case InvoiceEmailErrorType.EMAIL_QUOTA_EXCEEDED:
        return 'Email service temporarily unavailable due to quota limits. Please try again later.';
      
      case InvoiceEmailErrorType.SERVICE_DISABLED:
        return 'Invoice email service is currently disabled.';
      
      case InvoiceEmailErrorType.ALREADY_SENT:
        return 'Invoice email has already been sent to this customer.';
      
      case InvoiceEmailErrorType.TRANSACTION_NOT_FOUND:
        return 'Transaction not found. Please refresh and try again.';
      
      default:
        return 'Failed to send invoice email. Please try again or contact support.';
    }
  }
  
  /**
   * Log error with appropriate level
   */
  static logError(error: InvoiceEmailError): void {
    const logContext = {
      type: error.type,
      message: error.message,
      retryable: error.retryable,
      context: error.context,
      suggestedAction: error.suggestedAction,
      timestamp: error.timestamp
    };
    
    // Log as error for non-retryable issues
    if (!error.retryable) {
      console.error('[InvoiceEmailError] Non-retryable error:', logContext);
    } else {
      console.warn('[InvoiceEmailError] Retryable error:', logContext);
    }
    
    // Log original error stack if available
    if (error.originalError && error.originalError.stack) {
      console.error('[InvoiceEmailError] Original error stack:', error.originalError.stack);
    }
  }
}