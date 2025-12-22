import { useState, useMemo } from 'react';
import type { ProductCategory, CategoryFilters, CategorySort } from '@/types/inventory/category.types';

interface UseCategoryFiltersProps {
  categories: ProductCategory[];
}

interface UseCategoryFiltersReturn {
  filteredCategories: ProductCategory[];
  filters: CategoryFilters;
  sort: CategorySort;
  setSearch: (search: string) => void;
  setLevelFilter: (level?: number) => void;
  setActiveFilter: (isActive?: boolean) => void;
  setParentFilter: (parent?: string) => void;
  setSortField: (field: CategorySort['field']) => void;
  setSortOrder: (order: CategorySort['order']) => void;
  handleSort: (field: CategorySort['field']) => void;
  clearFilters: () => void;
  totalCount: number;
}

export function useCategoryFilters({ categories }: UseCategoryFiltersProps): UseCategoryFiltersReturn {
  const [filters, setFilters] = useState<CategoryFilters>({});
  const [sort, setSort] = useState<CategorySort>({
    field: 'name',
    order: 'asc'
  });

  // Filter and sort categories
  const filteredCategories = useMemo(() => {
    let result = [...categories];

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(category => 
        category.name.toLowerCase().includes(searchTerm) ||
        (category.description?.toLowerCase().includes(searchTerm) ?? false)
      );
    }

    // Apply level filter
    if (filters.level !== undefined) {
      result = result.filter(category => category.level === filters.level);
    }

    // Apply active status filter
    if (filters.isActive !== undefined) {
      result = result.filter(category => category.isActive === filters.isActive);
    }

    // Apply parent filter
    if (filters.parent !== undefined) {
      result = result.filter(category => category.parent === filters.parent);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      switch (sort.field) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'description':
          aValue = (a.description || '').toLowerCase();
          bValue = (b.description || '').toLowerCase();
          break;
        case 'level':
          aValue = a.level;
          bValue = b.level;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt);
          bValue = new Date(b.updatedAt);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sort.order === 'asc' ? -1 : 1;
      if (aValue > bValue) return sort.order === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [categories, filters, sort]);

  const setSearch = (search: string) => {
    setFilters(prev => ({ ...prev, search: search || undefined }));
  };

  const setLevelFilter = (level?: number) => {
    setFilters(prev => ({ ...prev, level }));
  };

  const setActiveFilter = (isActive?: boolean) => {
    setFilters(prev => ({ ...prev, isActive }));
  };

  const setParentFilter = (parent?: string) => {
    setFilters(prev => ({ ...prev, parent }));
  };

  const setSortField = (field: CategorySort['field']) => {
    setSort(prev => ({ ...prev, field }));
  };

  const setSortOrder = (order: CategorySort['order']) => {
    setSort(prev => ({ ...prev, order }));
  };

  const handleSort = (field: CategorySort['field']) => {
    if (sort.field === field) {
      setSortOrder(sort.order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort({ field, order: 'asc' });
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSort({ field: 'name', order: 'asc' });
  };

  return {
    filteredCategories,
    filters,
    sort,
    setSearch,
    setLevelFilter,
    setActiveFilter,
    setParentFilter,
    setSortField,
    setSortOrder,
    handleSort,
    clearFilters,
    totalCount: categories.length,
  };
}