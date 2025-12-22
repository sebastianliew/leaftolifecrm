import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/query-client';

// Analytics
export function useUserAnalytics(timeRange: string = '30d') {
  return useQuery({
    queryKey: ['admin', 'analytics', timeRange],
    queryFn: () => fetchAPI(`/admin/analytics?timeRange=${timeRange}`),
  });
}

export function useSystemMetrics(timeRange: string = '30d') {
  return useQuery({
    queryKey: ['admin', 'system-metrics', timeRange],
    queryFn: () => fetchAPI(`/admin/analytics/system?timeRange=${timeRange}`),
  });
}

interface AuditLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// Audit logs
export function useAuditLogs(filters?: AuditLogFilters) {
  const queryString = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
  
  return useQuery({
    queryKey: ['admin', 'audit-logs', filters],
    queryFn: () => fetchAPI(`/admin/audit-logs${queryString}`),
  });
}

export function useAuditStats() {
  return useQuery({
    queryKey: ['admin', 'audit-stats'],
    queryFn: () => fetchAPI('/admin/audit-logs/stats'),
  });
}

// Database operations
export function useSlowQueries() {
  return useQuery({
    queryKey: ['admin', 'slow-queries'],
    queryFn: () => fetchAPI('/admin/database/slow-queries'),
  });
}

// Permissions
export function useUserPermissions(userId: string) {
  return useQuery({
    queryKey: ['admin', 'permissions', userId],
    queryFn: () => fetchAPI(`/admin/permissions/${userId}`),
    enabled: !!userId,
  });
}

interface UserPermissions {
  [key: string]: boolean | string | number | UserPermissions;
}

export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, permissions }: { userId: string; permissions: UserPermissions }) => 
      fetchAPI(`/admin/permissions/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'permissions', variables.userId] });
    },
  });
}

// Security
export function useSecurityAudit() {
  return useQuery({
    queryKey: ['admin', 'security-audit'],
    queryFn: () => fetchAPI('/admin/security/audit'),
  });
}

export function useSecuritySettings() {
  return useQuery({
    queryKey: ['admin', 'security-settings'],
    queryFn: () => fetchAPI('/admin/security/settings'),
  });
}

interface SecuritySettings {
  [key: string]: boolean | string | number | object;
}

export function useUpdateSecuritySettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (settings: SecuritySettings) => 
      fetchAPI('/admin/security/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'security-settings'] });
    },
  });
}