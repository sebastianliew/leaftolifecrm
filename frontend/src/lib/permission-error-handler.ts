/**
 * Permission Error Handler
 * Provides a global event system for permission denied errors
 */

type PermissionErrorListener = (error: PermissionError) => void;

export interface PermissionError {
  url: string;
  method: string;
  message: string;
  resource?: string;
  action?: string;
}

// Map URL patterns to human-readable resource names
const URL_RESOURCE_MAP: Record<string, { resource: string; action: string }> = {
  // Users
  'GET /users': { resource: 'Users', action: 'view' },
  'POST /users': { resource: 'User', action: 'create' },
  'PUT /users': { resource: 'User', action: 'update' },
  'DELETE /users': { resource: 'User', action: 'delete' },

  // Transactions
  'GET /transactions': { resource: 'Transactions', action: 'view' },
  'POST /transactions': { resource: 'Transaction', action: 'create' },
  'PUT /transactions': { resource: 'Transaction', action: 'update' },
  'DELETE /transactions': { resource: 'Transaction', action: 'delete' },

  // Inventory
  'GET /inventory': { resource: 'Inventory', action: 'view' },
  'POST /inventory': { resource: 'Product', action: 'add' },
  'PUT /inventory': { resource: 'Product', action: 'update' },
  'DELETE /inventory': { resource: 'Product', action: 'delete' },

  // Products
  'GET /products': { resource: 'Products', action: 'view' },
  'POST /products': { resource: 'Product', action: 'create' },
  'PUT /products': { resource: 'Product', action: 'update' },
  'DELETE /products': { resource: 'Product', action: 'delete' },

  // Patients
  'GET /patients': { resource: 'Patients', action: 'view' },
  'POST /patients': { resource: 'Patient', action: 'create' },
  'PUT /patients': { resource: 'Patient', action: 'update' },
  'DELETE /patients': { resource: 'Patient', action: 'delete' },

  // Bundles
  'GET /bundles': { resource: 'Bundles', action: 'view' },
  'POST /bundles': { resource: 'Bundle', action: 'create' },
  'PUT /bundles': { resource: 'Bundle', action: 'update' },
  'DELETE /bundles': { resource: 'Bundle', action: 'delete' },

  // Blend Templates
  'GET /blend-templates': { resource: 'Blend Templates', action: 'view' },
  'POST /blend-templates': { resource: 'Blend Template', action: 'create' },
  'PUT /blend-templates': { resource: 'Blend Template', action: 'update' },
  'DELETE /blend-templates': { resource: 'Blend Template', action: 'delete' },

  // Reports
  'GET /reports': { resource: 'Reports', action: 'view' },
  'GET /reports/revenue': { resource: 'Revenue Report', action: 'view' },
  'GET /reports/inventory': { resource: 'Inventory Report', action: 'view' },

  // Refunds
  'GET /refunds': { resource: 'Refunds', action: 'view' },
  'POST /refunds': { resource: 'Refund', action: 'create' },
  'PUT /refunds': { resource: 'Refund', action: 'process' },

  // Suppliers
  'GET /suppliers': { resource: 'Suppliers', action: 'view' },
  'POST /suppliers': { resource: 'Supplier', action: 'create' },
  'PUT /suppliers': { resource: 'Supplier', action: 'update' },
  'DELETE /suppliers': { resource: 'Supplier', action: 'delete' },

  // Brands
  'GET /brands': { resource: 'Brands', action: 'view' },
  'POST /brands': { resource: 'Brand', action: 'create' },
  'PUT /brands': { resource: 'Brand', action: 'update' },
  'DELETE /brands': { resource: 'Brand', action: 'delete' },

  // Appointments
  'GET /appointments': { resource: 'Appointments', action: 'view' },
  'POST /appointments': { resource: 'Appointment', action: 'create' },
  'PUT /appointments': { resource: 'Appointment', action: 'update' },
  'DELETE /appointments': { resource: 'Appointment', action: 'delete' },

  // Dashboard
  'GET /dashboard': { resource: 'Dashboard', action: 'view' },

  // Invoices
  'GET /invoices': { resource: 'Invoice', action: 'download' },
};

/**
 * Get human-readable resource and action from URL
 */
export function getResourceFromUrl(url: string, method: string): { resource: string; action: string } {
  // Normalize the URL (remove IDs and query params)
  const normalizedUrl = url
    .replace(/\/[a-f0-9]{24}/gi, '') // Remove MongoDB ObjectIds
    .replace(/\/\d+/g, '') // Remove numeric IDs
    .replace(/\?.*$/, '') // Remove query params
    .replace(/\/+$/, ''); // Remove trailing slashes

  const key = `${method.toUpperCase()} ${normalizedUrl}`;

  // Try exact match first
  if (URL_RESOURCE_MAP[key]) {
    return URL_RESOURCE_MAP[key];
  }

  // Try prefix match (for nested routes like /users/123/password)
  // Sort patterns by URL length (longest first) to match most specific patterns first
  const sortedPatterns = Object.entries(URL_RESOURCE_MAP)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [pattern, info] of sortedPatterns) {
    const [patternMethod, patternUrl] = pattern.split(' ');
    // Match if same method and URL starts with the pattern's URL
    if (method.toUpperCase() === patternMethod && normalizedUrl.startsWith(patternUrl)) {
      return info;
    }
  }

  // Default fallback
  const urlParts = normalizedUrl.split('/').filter(Boolean);
  const resource = urlParts[0] || 'Resource';
  const actionMap: Record<string, string> = {
    GET: 'view',
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  };

  return {
    resource: resource.charAt(0).toUpperCase() + resource.slice(1),
    action: actionMap[method.toUpperCase()] || 'access',
  };
}

class PermissionErrorHandler {
  private listeners: Set<PermissionErrorListener> = new Set();

  /**
   * Subscribe to permission errors
   */
  subscribe(listener: PermissionErrorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit a permission error event
   */
  emit(error: PermissionError): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error in permission error listener:', e);
      }
    });
  }

  /**
   * Create and emit a permission error from API response
   */
  handlePermissionDenied(url: string, method: string, errorMessage?: string): void {
    const { resource, action } = getResourceFromUrl(url, method);

    this.emit({
      url,
      method,
      message: errorMessage || 'Permission denied',
      resource,
      action,
    });
  }
}

// Singleton instance
export const permissionErrorHandler = new PermissionErrorHandler();
