import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { fetchAPI, queryKeys } from '@/lib/query-client';
import { Product } from '@/types/inventory/product.types';

// 🔧 Types 🔧

export interface InventoryFilters {
  search?: string;
  category?: string;
  brand?: string;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'owed';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface InventoryStats {
  totalProducts: number;
  activeProducts: number;
  outOfStock: number;
  /** Number of products with currentStock < 0 (owed inventory). */
  stockOwed: number;
  /** Sum of |currentStock| × costPrice across all owed products. */
  totalOwedValue: number;
  lowStock: number;
  expired: number;
  expiringSoon: number;
  totalValue: number;
}

interface PaginatedProducts {
  products: Product[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// 🔧 Queries 🔧

export function useInventory(filters: InventoryFilters = {}) {
  return useQuery({
    queryKey: [...queryKeys.inventory, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.category && filters.category !== 'all') params.set('category', filters.category);
      if (filters.brand && filters.brand !== 'all') params.set('brand', filters.brand);
      if (filters.stockStatus && filters.stockStatus !== ('all' as string)) params.set('stockStatus', filters.stockStatus);
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
      params.set('page', String(filters.page || 1));
      params.set('limit', String(filters.limit || 20));

      return fetchAPI<PaginatedProducts>(`/inventory/products?${params}`);
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData, // Keep showing old results while new search/filter loads
  });
}

export function useInventoryStats() {
  return useQuery({
    queryKey: [...queryKeys.inventory, 'stats'],
    queryFn: () => fetchAPI<InventoryStats>('/inventory/products/stats'),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

// 🔧 Mutations 🔧

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetchAPI('/inventory/products', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory, refetchType: 'all' });
    },
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetchAPI(`/inventory/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItem(variables.id), refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory, refetchType: 'all' });
    },
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchAPI(`/inventory/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory, refetchType: 'all' });
    },
  });
}

export function useDeactivateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchAPI(`/inventory/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'inactive' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory, refetchType: 'all' });
    },
  });
}

export function usePoolTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action, amount }: { id: string; action: "open" | "close"; amount: number }) =>
      fetchAPI(`/inventory/products/${id}/pool`, {
        method: 'POST',
        body: JSON.stringify({ action, amount }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory, refetchType: 'all' });
    },
  });
}

export function useBulkDeleteInventoryItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productIds: string[]) =>
      fetchAPI('/inventory/products/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ productIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory, refetchType: 'all' });
    },
  });
}
