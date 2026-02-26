import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI, queryKeys } from '@/lib/query-client';
import type { Refund, RefundFilters, RefundListResponse } from '@/types/refund';

export function useRefunds(filters?: RefundFilters & { page?: number; limit?: number }) {
  // Clean filters - remove undefined/empty values
  const cleanFilters = filters ? Object.fromEntries(
    Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
  ) : {};
  
  const queryString = Object.keys(cleanFilters).length > 0 
    ? `?${new URLSearchParams(cleanFilters as Record<string, string>).toString()}` 
    : '';
  
  return useQuery({
    queryKey: queryKeys.refundHistory(cleanFilters),
    queryFn: async (): Promise<RefundListResponse> => {
      try {
        const response = await fetchAPI<RefundListResponse>(`/refunds${queryString}`);
        // Ensure we always return a consistent structure
        return {
          refunds: response?.refunds || [],
          pagination: response?.pagination || {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
          }
        };
      } catch {
        // Return empty structure on error so UI doesn't break
        return {
          refunds: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
          }
        };
      }
    },
    retry: 1,
    retryDelay: 1000,
  });
}

export function useRefund(id: string) {
  return useQuery({
    queryKey: queryKeys.refund(id),
    queryFn: () => fetchAPI<Refund>(`/refunds/${id}`),
    enabled: !!id,
  });
}

export function useRefundEligibility(transactionId: string) {
  return useQuery({
    queryKey: queryKeys.refundEligibility(transactionId),
    queryFn: () => fetchAPI(`/refunds/eligibility/${transactionId}`),
    enabled: !!transactionId,
  });
}

export function useTransactionRefunds(transactionId: string) {
  return useQuery({
    queryKey: queryKeys.transactionRefunds(transactionId),
    queryFn: () => fetchAPI<Refund[]>(`/refunds/transaction/${transactionId}`),
    enabled: !!transactionId,
  });
}

export function useRefundStatistics(filters?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: queryKeys.refundStatistics(filters),
    queryFn: () => fetchAPI(`/refunds/statistics${filters ? `?${new URLSearchParams(filters).toString()}` : ''}`),
  });
}

export function useCreateRefund() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Refund>) => 
      fetchAPI<Refund>('/refunds', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.refunds });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    },
  });
}

export function useApproveRefund() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, approvalNotes }: { id: string; approvalNotes?: string }) => 
      fetchAPI<Refund>(`/refunds/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ approvalNotes }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.refund(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.refunds });
    },
  });
}

export function useRejectRefund() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) => 
      fetchAPI<Refund>(`/refunds/${id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ rejectionReason }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.refund(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.refunds });
    },
  });
}

export function useProcessRefund() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => 
      fetchAPI<Refund>(`/refunds/${id}/process`, {
        method: 'PUT',
      }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.refund(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.refunds });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
    },
  });
}

export function useCompleteRefund() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, paymentDetails }: { id: string; paymentDetails?: Record<string, unknown> }) => 
      fetchAPI<Refund>(`/refunds/${id}/complete`, {
        method: 'PUT',
        body: JSON.stringify({ paymentDetails }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.refund(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.refunds });
    },
  });
}