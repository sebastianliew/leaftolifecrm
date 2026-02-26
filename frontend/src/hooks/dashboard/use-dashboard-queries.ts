import { useQuery } from '@tanstack/react-query';
import { fetchAPI, queryKeys } from '@/lib/query-client';

interface RecentTransaction {
  _id: string;
  transactionNumber: string;
  customerName: string;
  totalAmount: number;
  createdAt: string;
}

interface TopSellingProduct {
  _id: string;
  name: string;
  totalSold: number;
  revenue: number;
}

interface PatientGrowthData {
  month: string;
  count: number;
}

interface MonthlyRevenueData {
  month: string;
  revenue: number;
}

interface DashboardStats {
  totalPatients: number;
  totalRevenue: number;
  totalTransactions: number;
  lowStockItems: number;
  recentTransactions: RecentTransaction[];
  topSellingProducts: TopSellingProduct[];
  patientGrowth: PatientGrowthData[];
  monthlyRevenue: MonthlyRevenueData[];
}

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: () => fetchAPI<DashboardStats>('/api/dashboard/stats'),
    staleTime: 0, // 5 minutes
    gcTime: 0, // 10 minutes
  });
}