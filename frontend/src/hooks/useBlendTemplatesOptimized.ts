import { useState, useCallback, useRef, useEffect } from 'react';
import type { 
  BlendTemplate, 
  CreateBlendTemplateData, 
  UpdateBlendTemplateData, 
  TemplateFilters
} from '@/types/blend';

interface UseBlendTemplatesOptimizedOptions {
  initialLimit?: number;
  enableCache?: boolean;
  searchDebounce?: number;
}

interface PaginationState {
  page: number;
  limit: number;
  hasMore: boolean;
  total: number;
}

export function useBlendTemplatesOptimized(options: UseBlendTemplatesOptimizedOptions = {}) {
  const {
    initialLimit = 10,
    enableCache = true,
    searchDebounce = 300
  } = options;

  const [templates, setTemplates] = useState<BlendTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: initialLimit,
    hasMore: true,
    total: 0
  });

  // Cache for templates
  const cache = useRef<Map<string, { data: BlendTemplate[], timestamp: number }>>(new Map());
  const cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // Abort controller for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce timer
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate cache key from filters and pagination
  const getCacheKey = (filters?: TemplateFilters, page?: number, limit?: number) => {
    return JSON.stringify({ filters, page, limit });
  };

  // Clear cache
  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  // Get templates with pagination
  const getTemplatesPaginated = useCallback(async (
    page: number = 1, 
    filters?: TemplateFilters,
    append: boolean = false
  ) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Check cache
    const cacheKey = getCacheKey(filters, page, pagination.limit);
    if (enableCache && cache.current.has(cacheKey)) {
      const cached = cache.current.get(cacheKey)!;
      if (Date.now() - cached.timestamp < cacheTimeout) {
        if (append) {
          setTemplates(prev => [...prev, ...cached.data]);
        } else {
          setTemplates(cached.data);
        }
        return cached.data;
      }
    }

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pagination.limit.toString());
      
      if (filters?.isActive !== undefined) params.append('isActive', filters.isActive.toString());
      if (filters?.search) params.append('search', filters.search);
      if (filters?.hasIngredients !== undefined) params.append('hasIngredients', filters.hasIngredients.toString());
      if (filters?.minCost !== undefined) params.append('minCost', filters.minCost.toString());
      if (filters?.maxCost !== undefined) params.append('maxCost', filters.maxCost.toString());

      const response = await fetch(`/api/blend-templates?${params}`, {
        signal: controller.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch templates');
      }

      const data = await response.json();
      
      // Update cache
      if (enableCache) {
        cache.current.set(cacheKey, { data: data.templates, timestamp: Date.now() });
      }

      // Update state
      if (append) {
        setTemplates(prev => [...prev, ...data.templates]);
      } else {
        setTemplates(data.templates);
      }

      setPagination({
        page,
        limit: pagination.limit,
        hasMore: data.hasMore,
        total: data.total
      });

      return data.templates;
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
        throw err;
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [pagination.limit, enableCache, cacheTimeout]);

  // Load more templates
  const loadMore = useCallback(async () => {
    if (!pagination.hasMore || loading) return;
    
    await getTemplatesPaginated(pagination.page + 1, undefined, true);
  }, [pagination.page, pagination.hasMore, loading, getTemplatesPaginated]);

  // Search templates with debounce
  const searchTemplates = useCallback((searchTerm: string) => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(() => {
      getTemplatesPaginated(1, { search: searchTerm });
    }, searchDebounce);
  }, [searchDebounce, getTemplatesPaginated]);

  // Create template
  const createTemplate = useCallback(async (templateData: CreateBlendTemplateData): Promise<BlendTemplate> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/blend-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create template');
      }
      
      const data = await response.json();
      
      // Clear cache and reload
      clearCache();
      getTemplatesPaginated(1);
      
      return data;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clearCache, getTemplatesPaginated]);

  // Update template
  const updateTemplate = useCallback(async (id: string, templateData: UpdateBlendTemplateData): Promise<BlendTemplate> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/blend-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update template');
      }
      
      const data = await response.json();
      
      // Update local state
      setTemplates(prev => prev.map(t => t._id === id ? data : t));
      
      // Clear cache
      clearCache();
      
      return data;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clearCache]);

  // Delete template
  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/blend-templates/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete template');
      }
      
      // Update local state
      setTemplates(prev => prev.filter(t => t._id !== id));
      
      // Clear cache
      clearCache();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clearCache]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  return {
    templates,
    loading,
    error,
    pagination,
    getTemplatesPaginated,
    loadMore,
    searchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    clearCache,
    hasMore: pagination.hasMore
  };
}