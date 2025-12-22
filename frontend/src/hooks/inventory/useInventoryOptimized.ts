import { useState, useCallback, useRef, useEffect } from 'react';
import { debounce } from '@/utils/debounce';
import type { Product } from '@/types/inventory';

interface UseInventoryOptions {
  enableCache?: boolean;
  cacheTime?: number; // in milliseconds
  searchDebounce?: number;
  initialLimit?: number;
  context?: 'blends' | 'inventory'; // Add context for API optimization
}

const CACHE_KEY = 'inventory_products_cache';
const DEFAULT_CACHE_TIME = 5 * 60 * 1000; // 5 minutes
const DEFAULT_SEARCH_DEBOUNCE = 300;
const DEFAULT_LIMIT = 50;

interface CacheData {
  products: Product[];
  timestamp: number;
  query?: string;
}

export function useInventoryOptimized(options: UseInventoryOptions = {}) {
  const {
    enableCache = true,
    cacheTime = DEFAULT_CACHE_TIME,
    searchDebounce = DEFAULT_SEARCH_DEBOUNCE,
    initialLimit = DEFAULT_LIMIT,
    context = 'inventory'
  } = options;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load from cache if available
  useEffect(() => {
    if (enableCache && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const cacheData: CacheData = JSON.parse(cached);
          if (Date.now() - cacheData.timestamp < cacheTime) {
            setProducts(cacheData.products);
          }
        }
      } catch (error) {
        console.error('Error loading cache:', error);
      }
    }
  }, [enableCache, cacheTime]);

  // Save to cache
  const saveToCache = useCallback((products: Product[], query?: string) => {
    if (enableCache && typeof window !== 'undefined') {
      try {
        const cacheData: CacheData = {
          products,
          timestamp: Date.now(),
          query
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      } catch (error) {
        console.error('Error saving cache:', error);
      }
    }
  }, [enableCache]);

  // Fetch products with pagination and search
  const fetchProducts = useCallback(async (
    search: string = '',
    pageNum: number = 1,
    limit: number = initialLimit,
    append: boolean = false
  ) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        page: pageNum.toString(),
        ...(search && { search }),
        ...(context && { context }) // Add context for API optimization
      });

      const response = await fetch(`/api/inventory/products?${params}`, {
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();
      
      if (append) {
        setProducts(prev => [...prev, ...data.products]);
      } else {
        setProducts(data.products);
      }

      setHasMore(data.products.length === limit);
      setPage(pageNum);

      // Cache the results
      if (!search && pageNum === 1) {
        saveToCache(data.products);
      }

      return data.products;
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setError(error.message);
        throw error;
      }
    } finally {
      setLoading(false);
    }
  }, [initialLimit, saveToCache, context]);

  // Get all products (with caching)
  const getProducts = useCallback(async () => {
    return fetchProducts('', 1, 1000); // Still fetch all for compatibility
  }, [fetchProducts]);

  // Get products with pagination
  const getProductsPaginated = useCallback(async (pageNum: number = 1) => {
    return fetchProducts(searchTerm, pageNum, initialLimit, false);
  }, [fetchProducts, searchTerm, initialLimit]);

  // Load more products
  const loadMore = useCallback(async () => {
    if (!loading && hasMore) {
      return fetchProducts(searchTerm, page + 1, initialLimit, true);
    }
  }, [fetchProducts, searchTerm, page, initialLimit, loading, hasMore]);

  // Search products (debounced)
  const searchProductsDebounced = useRef(
    debounce(((search: string) => {
      fetchProducts(search, 1, initialLimit, false);
    }) as (...args: unknown[]) => unknown, searchDebounce)
  ).current;

  const searchProducts = useCallback((search: string) => {
    setSearchTerm(search);
    if (search.length > 2) {
      searchProductsDebounced(search);
    } else if (search.length === 0) {
      // Reset to initial state
      fetchProducts('', 1, initialLimit, false);
    }
  }, [searchProductsDebounced, fetchProducts, initialLimit]);

  // Clear cache
  const clearCache = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_KEY);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    products,
    loading,
    error,
    hasMore,
    page,
    searchTerm,
    getProducts,
    getProductsPaginated,
    loadMore,
    searchProducts,
    clearCache,
    refreshProducts: () => fetchProducts(searchTerm, 1, initialLimit, false)
  };
}