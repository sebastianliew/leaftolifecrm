import { useState, useCallback } from 'react';

interface BlendIngredient {
  productId: string;
  name: string;
  quantity: number;
  unitOfMeasurementId: string;
  unitName: string;
  costPerUnit: number;
  selectedContainers?: Array<{
    containerId: string;
    containerCode: string;
    quantityToConsume: number;
    batchNumber?: string;
    expiryDate?: Date;
  }>;
}

interface CustomBlendHistoryItem {
  _id: string;
  blendName: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  ingredients: BlendIngredient[];
  totalIngredientCost: number;
  sellingPrice: number;
  marginPercent: number;
  preparationNotes?: string;
  mixedBy: string;
  transactionNumber?: string;
  usageCount: number;
  lastUsed: Date;
  createdAt: Date;
}

interface CreateBlendHistoryData {
  blendName: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  ingredients: BlendIngredient[];
  totalIngredientCost: number;
  sellingPrice: number;
  marginPercent?: number;
  preparationNotes?: string;
  mixedBy: string;
  transactionId: string;
  transactionNumber?: string;
  createdBy?: string;
}

export function useCustomBlendHistory() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getBlendHistory = useCallback(async (params?: {
    customerId?: string;
    search?: string;
    limit?: number;
    popular?: boolean;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      
      if (params?.customerId) {
        searchParams.append('customerId', params.customerId);
      }
      if (params?.search) {
        searchParams.append('search', params.search);
      }
      if (params?.limit) {
        searchParams.append('limit', params.limit.toString());
      }
      if (params?.popular) {
        searchParams.append('popular', 'true');
      }

      const response = await fetch(`/api/custom-blends/history?${searchParams}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch blend history');
      }

      return data.data as CustomBlendHistoryItem[];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch blend history';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const getBlendById = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/custom-blends/history/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch blend');
      }

      return data.data as CustomBlendHistoryItem;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch blend';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const createBlendHistory = useCallback(async (blendData: CreateBlendHistoryData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/custom-blends/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(blendData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create blend history');
      }

      return data.data as CustomBlendHistoryItem;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create blend history';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const recordBlendUsage = useCallback(async (id: string) => {
    setError(null);

    try {
      const response = await fetch(`/api/custom-blends/history/${id}`, {
        method: 'PUT',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record blend usage');
      }

      return data.data as CustomBlendHistoryItem;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record blend usage';
      setError(errorMessage);
      console.error('Error recording blend usage:', err);
      // Don't throw error here as this is not critical for the main flow
    }
  }, []);

  const deleteBlendHistory = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/custom-blends/history/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete blend history');
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete blend history';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getBlendHistory,
    getBlendById,
    createBlendHistory,
    recordBlendUsage,
    deleteBlendHistory,
  };
} 