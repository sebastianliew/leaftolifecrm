import { useState, useCallback } from 'react';
import { RestockOperation, BulkRestockRequest } from '../lib/validations/restock';
import { api } from '@/lib/api-client';

export interface RestockResult {
  productId: string;
  previousStock: number;
  newStock: number;
  quantityAdded: number;
  movementId: string;
  success: boolean;
  error?: string;
}

export interface BulkRestockResult {
  batchId: string;
  totalOperations: number;
  successCount: number;
  failureCount: number;
  results: RestockResult[];
  batch: {
    batchId: string;
    totalOperations: number;
    successCount: number;
    failureCount: number;
  };
}

export interface RestockSuggestion {
  product: {
    _id: string;
    name: string;
    currentStock: number;
    reorderPoint: number;
  };
  currentStock: number;
  reorderPoint: number;
  suggestedQuantity: number;
  daysUntilStockout?: number;
  priority: 'high' | 'medium' | 'low';
}

export interface UseRestockReturn {
  restockProduct: (operation: RestockOperation) => Promise<RestockResult>;
  bulkRestock: (request: BulkRestockRequest) => Promise<BulkRestockResult>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export interface UseRestockSuggestionsReturn {
  suggestions: RestockSuggestion[];
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  } | null;
  isLoading: boolean;
  error: string | null;
  fetchSuggestions: (options?: {
    threshold?: number;
    category?: string;
    supplier?: string;
  }) => Promise<void>;
  refreshSuggestions: () => Promise<void>;
}

export function useRestock(): UseRestockReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const restockProduct = useCallback(async (operation: RestockOperation): Promise<RestockResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/inventory/restock', operation);

      if (!response.ok) {
        throw new Error(response.error || 'Restock failed');
      }

      // Backend returns { success: true, data: {...} }
      const responseData = response.data as { data?: RestockResult } | RestockResult;
      return (responseData as { data: RestockResult }).data || (responseData as RestockResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const bulkRestock = useCallback(async (request: BulkRestockRequest): Promise<BulkRestockResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/inventory/restock/bulk', request);

      if (!response.ok) {
        throw new Error(response.error || 'Bulk restock failed');
      }

      // Backend returns { success: true, data: {...} }
      const responseData = response.data as { data?: BulkRestockResult } | BulkRestockResult;
      return (responseData as { data: BulkRestockResult }).data || (responseData as BulkRestockResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    restockProduct,
    bulkRestock,
    isLoading,
    error,
    clearError,
  };
}

export function useRestockSuggestions(): UseRestockSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<RestockSuggestion[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    high: number;
    medium: number;
    low: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async (options: {
    threshold?: number;
    category?: string;
    supplier?: string;
  } = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const params: Record<string, string | number> = {};
      if (options.threshold !== undefined) params.threshold = options.threshold;
      if (options.category) params.category = options.category;
      if (options.supplier) params.supplier = options.supplier;

      const response = await api.get('/inventory/restock/suggestions', params);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch suggestions');
      }

      // Backend returns { success: true, data: { suggestions, summary } }
      // API client wraps it as { data: {...}, ok: true, ... }
      const responseData = response.data as { data?: { suggestions: RestockSuggestion[]; summary: { total: number; high: number; medium: number; low: number } } } | { suggestions: RestockSuggestion[]; summary: { total: number; high: number; medium: number; low: number } };
      const finalData = (responseData as { data: { suggestions: RestockSuggestion[]; summary: { total: number; high: number; medium: number; low: number } } }).data || (responseData as { suggestions: RestockSuggestion[]; summary: { total: number; high: number; medium: number; low: number } });
      setSuggestions(finalData.suggestions || []);
      setSummary(finalData.summary || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setSuggestions([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSuggestions = useCallback(async () => {
    await fetchSuggestions();
  }, [fetchSuggestions]);

  return {
    suggestions,
    summary,
    isLoading,
    error,
    fetchSuggestions,
    refreshSuggestions,
  };
}

export interface UseRestockCartItem extends RestockOperation {
  id: string;
  productName: string;
  currentStock: number;
  estimatedCost?: number;
}

export interface UseRestockCartReturn {
  items: UseRestockCartItem[];
  addItem: (item: Omit<UseRestockCartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<UseRestockCartItem>) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalCost: () => number;
  processCart: (options?: {
    batchReference?: string;
    notes?: string;
    purchaseOrderRef?: string;
  }) => Promise<BulkRestockResult>;
  isProcessing: boolean;
  error: string | null;
}

export function useRestockCart(): UseRestockCartReturn {
  const [items, setItems] = useState<UseRestockCartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { bulkRestock } = useRestock();

  const addItem = useCallback((item: Omit<UseRestockCartItem, 'id'>) => {
    const newItem: UseRestockCartItem = {
      ...item,
      id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setItems(prev => [...prev, newItem]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<UseRestockCartItem>) => {
    setItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setError(null);
  }, []);

  const getTotalItems = useCallback(() => {
    return items.length;
  }, [items]);

  const getTotalCost = useCallback(() => {
    return items.reduce((total, item) => {
      const cost = (item.unitCost || 0) * item.quantity;
      return total + cost;
    }, 0);
  }, [items]);

  const processCart = useCallback(async (options: {
    batchReference?: string;
    notes?: string;
    purchaseOrderRef?: string;
  } = {}): Promise<BulkRestockResult> => {
    if (items.length === 0) {
      throw new Error('Cart is empty');
    }

    setIsProcessing(true);
    setError(null);

    try {
      const operations: RestockOperation[] = items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        supplier: item.supplier,
        notes: item.notes,
        reference: item.reference,
        unitCost: item.unitCost,
        containerSize: item.containerSize,
        expiryDate: item.expiryDate,
      }));

      const request: BulkRestockRequest = {
        operations,
        batchReference: options.batchReference,
        notes: options.notes,
        purchaseOrderRef: options.purchaseOrderRef,
      };

      const result = await bulkRestock(request);
      
      if (result.successCount > 0) {
        clearCart();
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process cart';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [items, bulkRestock, clearCart]);

  return {
    items,
    addItem,
    removeItem,
    updateItem,
    clearCart,
    getTotalItems,
    getTotalCost,
    processCart,
    isProcessing,
    error,
  };
}