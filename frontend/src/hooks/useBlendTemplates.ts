import { useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import type { 
  BlendTemplate, 
  CreateBlendTemplateData, 
  UpdateBlendTemplateData, 
  TemplateFilters,
  ValidationResult,
  BlendIngredient
} from '@/types/blend';

export function useBlendTemplates() {
  const [templates, setTemplates] = useState<BlendTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  // Get all templates with filters
  const getTemplates = useCallback(async (filters?: TemplateFilters, page = 1, limit = 10) => {
    setLoading(true);
    setError(null);
    
    try {
      const params: Record<string, string> = {};
      if (filters?.isActive !== undefined) params.isActive = filters.isActive.toString();
      if (filters?.search) params.search = filters.search;
      params.page = page.toString();
      params.limit = limit.toString();
      
      const response = await api.get('/blend-templates', params);
      
      if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch templates');
      }
      
      const data = (response.data as BlendTemplate[]) || [];
      const total = (response.total as number) || data.length;
      
      setTemplates(data);
      setPagination({ page, limit, total });
      return data;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get single template
  const getTemplate = useCallback(async (id: string): Promise<BlendTemplate> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/blend-templates/${id}`);
      
      if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch template');
      }
      
      const data = response.data as BlendTemplate;
      return data;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new template
  const createTemplate = useCallback(async (templateData: CreateBlendTemplateData): Promise<BlendTemplate> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.post('/blend-templates', templateData);
      
      if (!response.ok) {
        throw new Error(response.error || 'Failed to create template');
      }
      
      const data = response.data as BlendTemplate;
      
      // Update local state
      setTemplates(prev => [...prev, data]);
      
      return data;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update existing template
  const updateTemplate = useCallback(async (id: string, templateData: UpdateBlendTemplateData): Promise<BlendTemplate> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.put(`/blend-templates/${id}`, templateData);
      
      if (!response.ok) {
        throw new Error(response.error || 'Failed to update template');
      }
      
      const data = response.data as BlendTemplate;
      
      // Update local state
      setTemplates(prev => prev.map(t => t._id === id ? data : t));
      
      return data;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete template
  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.delete(`/blend-templates/${id}`);
      
      if (!response.ok) {
        throw new Error(response.error || 'Failed to delete template');
      }
      
      // Update local state
      setTemplates(prev => prev.filter(t => t._id !== id));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get template categories
  const getCategories = useCallback(async (): Promise<string[]> => {
    try {
      const response = await fetch('/api/blend-templates/categories');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch categories');
      }
      
      return await response.json();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Validate ingredients
  const validateIngredients = useCallback(async (ingredients: BlendIngredient[], _multiplier = 1): Promise<ValidationResult> => {
    try {
      // TODO: Backend endpoint /api/blends/validate-ingredients doesn't exist yet
      // For now, return a stub validation result
      console.warn('Ingredient validation endpoint not implemented, skipping validation');

      return {
        valid: true,
        warnings: [],
        errors: []
      };

      // Original code (commented out until endpoint is implemented):
      // const response = await api.post('/blends/validate-ingredients', { ingredients, multiplier });
      //
      // if (!response.ok) {
      //   throw new Error(response.error || 'Failed to validate ingredients');
      // }
      //
      // return response.data;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      throw err;
    }
  }, []);


  // Pagination helpers
  const nextPage = useCallback(() => {
    if (pagination.page * pagination.limit < pagination.total) {
      getTemplates(undefined, pagination.page + 1, pagination.limit);
    }
  }, [pagination, getTemplates]);

  const prevPage = useCallback(() => {
    if (pagination.page > 1) {
      getTemplates(undefined, pagination.page - 1, pagination.limit);
    }
  }, [pagination, getTemplates]);

  const goToPage = useCallback((page: number) => {
    getTemplates(undefined, page, pagination.limit);
  }, [pagination.limit, getTemplates]);

  return {
    templates,
    loading,
    error,
    pagination,
    getTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getCategories,
    validateIngredients,
    setError,
    nextPage,
    prevPage,
    goToPage
  };
} 