import { useState, useCallback } from 'react';
import { DEFAULT_FILTERS } from '@/constants/blend-templates';
import type { TemplateFilters } from '@/types/blend';

export function useTemplateFilters(initialFilters = DEFAULT_FILTERS) {
  const [filters, setFilters] = useState<TemplateFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);

  const updateFilter = useCallback((key: keyof TemplateFilters, value: boolean | string | number | undefined) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateFilters = useCallback((newFilters: Partial<TemplateFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const toggleFilters = useCallback(() => {
    setShowFilters(prev => !prev);
  }, []);

  return {
    filters,
    showFilters,
    setShowFilters,
    updateFilter,
    updateFilters,
    resetFilters,
    toggleFilters
  };
}