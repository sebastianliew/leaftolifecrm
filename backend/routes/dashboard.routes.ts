import express, { Request, Response, NextFunction, type IRouter } from 'express';
import { DashboardStatsService } from '../services/DashboardStatsService.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';

const router: IRouter = express.Router();
const dashboardStatsService = new DashboardStatsService();

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', authenticateToken, requirePermission('reports', 'canViewInventoryReports'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await dashboardStatsService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    next(error);
  }
});

export default router;