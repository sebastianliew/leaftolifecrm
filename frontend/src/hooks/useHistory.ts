import { useState, useCallback } from 'react';

export interface HistoryItem {
  id: string;
  type: 'custom_blend' | 'transaction';
  date: Date;
  customerName: string;
  totalAmount: number;
  description: string;
  status?: string;
  
  // Custom blend specific fields
  blendName?: string;
  ingredientCount?: number;
  usageCount?: number;
  
  // Transaction specific fields
  transactionNumber?: string;
  itemCount?: number;
  paymentStatus?: string;
  
  // Common fields
  createdAt: Date;
  transactionId?: string;
}

interface HistoryFilters {
  customerId?: string;
  search?: string;
  limit?: number;
  type?: 'custom_blends' | 'transactions' | 'all';
  page?: number;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  const getHistory = useCallback(async (filters?: HistoryFilters) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      
      if (filters?.customerId) {
        searchParams.append('customerId', filters.customerId);
      }
      if (filters?.search) {
        searchParams.append('search', filters.search);
      }
      if (filters?.limit) {
        searchParams.append('limit', filters.limit.toString());
      }
      if (filters?.type) {
        searchParams.append('type', filters.type);
      }
      if (filters?.page) {
        searchParams.append('page', filters.page.toString());
      }

      const response = await fetch(`/api/history?${searchParams}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch history');
      }

      setHistory(data.data);
      setPagination(data.pagination || null);
      setError(null);
      return data.data as HistoryItem[];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch history';
      setError(errorMessage);
      setHistory([]);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(async (filters?: HistoryFilters) => {
    await getHistory(filters);
  }, [getHistory]);

  return {
    history,
    loading,
    error,
    pagination,
    getHistory,
    refreshHistory
  };
} 