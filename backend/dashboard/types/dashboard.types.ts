export interface DashboardStats {
  totalProducts: number;
  activePatients: number;
  oversoldProducts: number;
  expiredProducts: number;
  expiringSoonProducts: number;
  totalValue: number;
  productGrowth: number;
  patientGrowth: number;
}

export interface DashboardStatsService {
  getDashboardStats(): Promise<DashboardStats>;
}