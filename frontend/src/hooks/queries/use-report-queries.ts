import { useQuery } from '@tanstack/react-query';
import { fetchAPI, queryKeys } from '@/lib/query-client';

export function useRevenueReport(dateRange?: { startDate: Date; endDate: Date } | null, period?: string) {
  const params = new URLSearchParams();
  
  if (dateRange) {
    params.set('startDate', dateRange.startDate.toISOString());
    params.set('endDate', dateRange.endDate.toISOString());
  } else if (period) {
    params.set('period', period);
  }
  
  const queryString = params.toString();
  const url = `/reports/revenue-analysis${queryString ? `?${queryString}` : ''}`;
  
  return useQuery({
    queryKey: queryKeys.revenueReport({ dateRange, period }),
    queryFn: () => fetchAPI(url),
    enabled: dateRange !== null || !!period, // Only run query if dateRange is not null or period is provided
  });
}

export function useSalesTrendsReport(dateRange?: { startDate: Date; endDate: Date } | null) {
  const params = new URLSearchParams();
  
  if (dateRange) {
    params.set('startDate', dateRange.startDate.toISOString());
    params.set('endDate', dateRange.endDate.toISOString());
  }
  
  const queryString = params.toString();
  const url = `/reports/sales-trends${queryString ? `?${queryString}` : ''}`;
  
  return useQuery({
    queryKey: queryKeys.salesTrendsReport(dateRange),
    queryFn: () => fetchAPI(url),
    enabled: dateRange !== null, // Only run query if dateRange is not null
  });
}

export function useInventoryReport() {
  return useQuery({
    queryKey: queryKeys.inventoryReport(),
    queryFn: () => fetchAPI('/reports/inventory-analysis'),
  });
}

export function useItemSalesReport() {
  return useQuery({
    queryKey: queryKeys.itemSalesReport(),
    queryFn: () => fetchAPI('/reports/item-sales'),
  });
}

export function useInventoryCostReport(filters?: { 
  dateRange?: { startDate: Date; endDate: Date } | null;
  stockStatus?: string;
}) {
  const params = new URLSearchParams();
  
  if (filters?.dateRange) {
    params.set('startDate', filters.dateRange.startDate.toISOString());
    params.set('endDate', filters.dateRange.endDate.toISOString());
  }
  
  if (filters?.stockStatus && filters.stockStatus !== 'all') {
    params.set('stockStatus', filters.stockStatus);
  }
  
  const queryString = params.toString();
  const url = `/reports/inventory-cost${queryString ? `?${queryString}` : ''}`;
  
  return useQuery({
    queryKey: queryKeys.inventoryCostReport(filters),
    queryFn: () => fetchAPI(url),
  });
}