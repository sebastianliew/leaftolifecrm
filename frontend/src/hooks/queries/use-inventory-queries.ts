import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI, queryKeys } from '@/lib/query-client';
import { Product } from '@/types/inventory/product.types';

interface InventoryItem {
  _id: string;
  name: string;
  brandId?: string;
  brandName?: string;
  category?: string;
  sku?: string;
  stock: number;
  currentStock?: number; // Backend field
  price: number;
  sellingPrice?: number; // Backend field
  reorderLevel?: number;
  reorderPoint?: number; // Backend field
  maxStock?: number;
  unitOfMeasure?: string;
  supplierId?: string;
  supplierName?: string;
  location?: string;
  batchNumber?: string;
  expiryDate?: string;
  description?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function useInventory(includeInactive = false) {
  return useQuery({
    queryKey: [...queryKeys.inventory, { includeInactive }],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '1000',
        ...(includeInactive && { includeInactive: 'true' })
      });
      
      const data = await fetchAPI<{ products: Product[] }>(`/inventory/products?${params}`);
      const rawProducts = data.products || data || [];

      // Simple transformation - map backend field names to frontend
      return rawProducts.map((product: Product) => ({
        ...product,
        stock: product.currentStock || 0,
        price: product.sellingPrice || 0,
        reorderLevel: product.reorderPoint || 0,
        unitOfMeasure: product.unitOfMeasurement?.name || '',
        brandName: product.brand?.name || '',
        category: product.category?.name || (typeof product.category === 'string' ? product.category : ''),
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes (was cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: (failureCount, error: Error & { status?: number }) => {
      // Don't retry on 429 (rate limit) errors
      if (error?.status === 429 || error?.message?.includes('too many requests')) {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<InventoryItem>) => {
      // Transform frontend field names to backend API format
      const backendData = {
        ...data,
        // Map frontend fields to backend fields
        currentStock: data.stock || data.currentStock || 0,
        sellingPrice: data.price || data.sellingPrice || 0,
        reorderPoint: data.reorderLevel || data.reorderPoint || 10,
      };

      return fetchAPI('/inventory/products', {
        method: 'POST',
        body: JSON.stringify(backendData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
    },
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InventoryItem> }) => {
      const backendData = {
        ...data,
        currentStock: data.stock ?? data.currentStock,
        sellingPrice: data.price ?? data.sellingPrice,
        reorderPoint: data.reorderLevel ?? data.reorderPoint,
      };
      return fetchAPI(`/inventory/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(backendData),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItem(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
    },
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return fetchAPI(`/inventory/products/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      // Invalidate triggers automatic refetch - simpler and more efficient
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
    },
    onError: (error) => {
      console.error('Delete product error:', error);
    },
  });
}

export function useBulkDeleteInventoryItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productIds: string[]) => {
      return fetchAPI('/inventory/products/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ productIds }),
      });
    },
    onSuccess: () => {
      // Invalidate triggers automatic refetch - simpler and more efficient
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
    },
    onError: (error) => {
      console.error('Bulk delete error:', error);
    },
  });
}