import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type {
  Bundle,
  BundleFormData,
  BundleFilters,
  BundleAvailability,
  BundlePricingCalculation,
  BundleStats,
  BundleProduct
} from '@/types/bundle';

interface UseBundlesReturn {
  bundles: Bundle[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
  categories: string[];
  popularBundles: Bundle[];
  promotedBundles: Bundle[];
  stats: BundleStats | null;
  
  // Methods
  getBundles: (filters?: BundleFilters, page?: number, limit?: number) => Promise<void>;
  getAllBundles: (filters?: BundleFilters) => Promise<void>;
  getBundleById: (id: string) => Promise<Bundle | null>;
  createBundle: (data: BundleFormData) => Promise<Bundle | null>;
  updateBundle: (id: string, data: Partial<BundleFormData>) => Promise<Bundle | null>;
  deleteBundle: (id: string) => Promise<boolean>;
  checkAvailability: (bundleId: string, quantity?: number) => Promise<BundleAvailability | null>;
  calculatePricing: (bundleProducts: BundleProduct[], bundlePrice: number) => Promise<BundlePricingCalculation | null>;
  getCategories: () => Promise<void>;
  getPopularBundles: (limit?: number) => Promise<void>;
  getPromotedBundles: () => Promise<void>;
  getStats: () => Promise<void>;
  refreshBundles: () => Promise<void>;
}

export function useBundles(skipInitialLoad?: boolean): UseBundlesReturn {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [popularBundles, setPopularBundles] = useState<Bundle[]>([]);
  const [promotedBundles, setPromotedBundles] = useState<Bundle[]>([]);
  const [stats, setStats] = useState<BundleStats | null>(null);

  // Get bundles with filters and pagination
  const getBundles = useCallback(async (filters: BundleFilters = {}, pageNum = 1, limit = 20) => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {
        page: pageNum.toString(),
        limit: limit.toString()
      };

      // Add filters to params
      if (filters.category) params.category = filters.category;
      if (filters.isActive !== undefined) params.isActive = filters.isActive.toString();
      if (filters.isPromoted !== undefined) params.isPromoted = filters.isPromoted.toString();
      if (filters.minPrice !== undefined) params.minPrice = filters.minPrice.toString();
      if (filters.maxPrice !== undefined) params.maxPrice = filters.maxPrice.toString();
      if (filters.minSavings !== undefined) params.minSavings = filters.minSavings.toString();
      if (filters.search) params.search = filters.search;
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;
      if (filters.tags && filters.tags.length > 0) params.tags = filters.tags.join(',');

      const response = await apiClient.get('/bundles', params);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch bundles');
      }

      const data = response.data as { bundles?: Bundle[]; pagination?: { total: number; page: number; pages: number } };

      setBundles(data.bundles || []);
      setTotal(data.pagination?.total || 0);
      setPage(data.pagination?.page || 1);
      setTotalPages(data.pagination?.pages || 0);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch bundles';
      setError(errorMessage);
      console.error('Error fetching bundles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get all bundles without pagination (for transaction creation)
  const getAllBundles = useCallback(async (filters: BundleFilters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {
        getAllBundles: 'true'
      };

      // Add filters to params
      if (filters.category) params.category = filters.category;
      if (filters.isActive !== undefined) params.isActive = filters.isActive.toString();
      if (filters.isPromoted !== undefined) params.isPromoted = filters.isPromoted.toString();
      if (filters.minPrice !== undefined) params.minPrice = filters.minPrice.toString();
      if (filters.maxPrice !== undefined) params.maxPrice = filters.maxPrice.toString();
      if (filters.minSavings !== undefined) params.minSavings = filters.minSavings.toString();
      if (filters.search) params.search = filters.search;
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;
      if (filters.tags && filters.tags.length > 0) params.tags = filters.tags.join(',');

      const response = await apiClient.get('/bundles', params);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch bundles');
      }

      const data = response.data as { bundles?: Bundle[]; pagination?: { total: number; page: number; pages: number } };

      setBundles(data.bundles || []);
      setTotal(data.pagination?.total || 0);
      setPage(1);
      setTotalPages(1);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch bundles';
      setError(errorMessage);
      console.error('Error fetching all bundles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get bundle by ID
  const getBundleById = useCallback(async (id: string): Promise<Bundle | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/bundles/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(response.error || 'Failed to fetch bundle');
      }

      return response.data as Bundle;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch bundle';
      setError(errorMessage);
      console.error('Error fetching bundle:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create bundle
  const createBundle = useCallback(async (data: BundleFormData): Promise<Bundle | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/bundles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create bundle: ${response.statusText}`);
      }
      
      const bundle = await response.json();
      
      // Refresh bundles list
      await getBundles();
      
      return bundle;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create bundle';
      setError(errorMessage);
      console.error('Error creating bundle:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getBundles]);

  // Update bundle
  const updateBundle = useCallback(async (id: string, data: Partial<BundleFormData>): Promise<Bundle | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/bundles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update bundle: ${response.statusText}`);
      }
      
      const bundle = await response.json();
      
      // Refresh bundles list
      await getBundles();
      
      return bundle;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update bundle';
      setError(errorMessage);
      console.error('Error updating bundle:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getBundles]);

  // Delete bundle
  const deleteBundle = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/bundles/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete bundle: ${response.statusText}`);
      }
      
      // Refresh bundles list
      await getBundles();
      
      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete bundle';
      setError(errorMessage);
      console.error('Error deleting bundle:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [getBundles]);

  // Check bundle availability
  const checkAvailability = useCallback(async (bundleId: string, quantity = 1): Promise<BundleAvailability | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/bundles/${bundleId}/availability`, { quantity: quantity.toString() });

      if (!response.ok) {
        throw new Error(response.error || 'Failed to check availability');
      }

      return response.data as BundleAvailability;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check availability';
      setError(errorMessage);
      console.error('Error checking availability:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate bundle pricing
  const calculatePricing = useCallback(async (bundleProducts: BundleProduct[], bundlePrice: number): Promise<BundlePricingCalculation | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/bundles/calculate-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bundleProducts, bundlePrice }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to calculate pricing: ${response.statusText}`);
      }
      
      const pricing = await response.json();
      return pricing;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to calculate pricing';
      setError(errorMessage);
      console.error('Error calculating pricing:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get bundle categories
  const getCategories = useCallback(async () => {
    try {
      const response = await apiClient.get('/bundles/categories');

      if (response.ok) {
        setCategories((response.data as { categories?: string[] }).categories || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  // Get popular bundles
  const getPopularBundles = useCallback(async (limit = 10) => {
    try {
      const response = await fetch(`/api/bundles/popular?limit=${limit}`);
      
      if (response.ok) {
        const data = await response.json();
        setPopularBundles(data.bundles || []);
      }
    } catch (err) {
      console.error('Error fetching popular bundles:', err);
    }
  }, []);

  // Get promoted bundles
  const getPromotedBundles = useCallback(async () => {
    try {
      const response = await fetch('/api/bundles/promoted');
      
      if (response.ok) {
        const data = await response.json();
        setPromotedBundles(data.bundles || []);
      }
    } catch (err) {
      console.error('Error fetching promoted bundles:', err);
    }
  }, []);

  // Get bundle statistics
  const getStats = useCallback(async () => {
    try {
      const response = await fetch('/api/bundles/stats');
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error('Error fetching bundle stats:', err);
    }
  }, []);

  // Refresh bundles (reloads current page with current filters)
  const refreshBundles = useCallback(async () => {
    await getBundles();
  }, [getBundles]);

  // Load initial data
  useEffect(() => {
    if (!skipInitialLoad) {
      getBundles();
      getCategories();
      getPopularBundles();
      getPromotedBundles();
      getStats();
    }
  }, [skipInitialLoad, getBundles, getCategories, getPopularBundles, getPromotedBundles, getStats]);

  return {
    bundles,
    loading,
    error,
    total,
    page,
    totalPages,
    categories,
    popularBundles,
    promotedBundles,
    stats,
    getBundles,
    getAllBundles,
    getBundleById,
    createBundle,
    updateBundle,
    deleteBundle,
    checkAvailability,
    calculatePricing,
    getCategories,
    getPopularBundles,
    getPromotedBundles,
    getStats,
    refreshBundles,
  };
} 