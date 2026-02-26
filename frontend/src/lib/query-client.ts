import { permissionErrorHandler } from './permission-error-handler';

export async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  // Use environment variable for backend API URL with dynamic port fallback
  const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
  const fullURL = endpoint.startsWith('http')
    ? endpoint
    : `${baseURL}${endpoint}`;

  // Get auth token from localStorage or cookies
  let authToken: string | null = null;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('authToken');
    if (!authToken) {
      // Try to get from cookies as fallback
      const cookies = document.cookie.split(';');
      const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('authToken='));
      if (tokenCookie) {
        authToken = tokenCookie.split('=')[1];
      }
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(fullURL, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));

    // Handle 403 Forbidden - trigger permission error toast
    if (response.status === 403) {
      const method = options?.method || 'GET';
      permissionErrorHandler.handlePermissionDenied(
        endpoint,
        method,
        error.message || error.error || 'Permission denied'
      );
    }

    throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const queryKeys = {
  // Dashboard
  dashboardStats: ['dashboard', 'stats'] as const,
  
  // Patients
  patients: ['patients'] as const,
  patient: (id: string) => ['patients', id] as const,
  patientSearch: (search: string) => ['patients', 'search', search] as const,
  recentPatients: ['patients', 'recent'] as const,
  
  // Inventory
  inventory: ['inventory'] as const,
  inventoryItem: (id: string) => ['inventory', id] as const,
  inventoryCategories: ['inventory', 'categories'] as const,
  
  // Transactions
  transactions: ['transactions'] as const,
  transaction: (id: string) => ['transactions', id] as const,
  transactionHistory: (filters?: unknown) => ['transactions', 'history', filters] as const,
  
  // Units
  units: ['units'] as const,
  
  // Brands
  brands: ['brands'] as const,
  
  // Suppliers
  suppliers: ['suppliers'] as const,
  
  // Users
  users: ['users'] as const,
  user: (id: string) => ['users', id] as const,
  currentUser: ['users', 'current'] as const,
  
  // Bundles
  bundles: ['bundles'] as const,
  bundle: (id: string) => ['bundles', id] as const,
  
  // Blend Templates
  blendTemplates: ['blendTemplates'] as const,
  blendTemplate: (id: string) => ['blendTemplates', id] as const,
  
  // Prescriptions
  prescriptions: ['prescriptions'] as const,
  prescription: (id: string) => ['prescriptions', id] as const,
  patientPrescriptions: (patientId: string) => ['prescriptions', 'patient', patientId] as const,
  
  // Reports
  revenueReport: (filters?: unknown) => ['reports', 'revenue', filters] as const,
  salesTrendsReport: (filters?: unknown) => ['reports', 'sales-trends', filters] as const,
  inventoryReport: (filters?: unknown) => ['reports', 'inventory', filters] as const,
  inventoryCostReport: (filters?: unknown) => ['reports', 'inventory-cost', filters] as const,
  itemSalesReport: (filters?: unknown) => ['reports', 'item-sales', filters] as const,
  
  // Settings
  settings: ['settings'] as const,
  consultationSettings: ['settings', 'consultation'] as const,
  
  // Permissions
  permissions: ['permissions'] as const,
  userPermissions: (userId: string) => ['permissions', userId] as const,
  
  // Audit Logs
  auditLogs: (filters?: unknown) => ['audit-logs', filters] as const,
  
  // Dosage Forms
  dosageForms: ['dosage-forms'] as const,
  
  // Refunds
  refunds: ['refunds'] as const,
  refund: (id: string) => ['refunds', id] as const,
  refundHistory: (filters?: unknown) => ['refunds', 'history', filters] as const,
  refundEligibility: (transactionId: string) => ['refunds', 'eligibility', transactionId] as const,
  transactionRefunds: (transactionId: string) => ['refunds', 'transaction', transactionId] as const,
  refundStatistics: (filters?: unknown) => ['refunds', 'statistics', filters] as const,
};