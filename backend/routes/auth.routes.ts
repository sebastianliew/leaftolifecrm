import express, { Request, type IRouter } from 'express';
import { PermissionService } from '../lib/permissions/PermissionService.js';
import {
  login,
  logout,
  refreshToken,
  createAdmin,
  createTempUser,
  resetPassword,
  confirmPasswordReset,
  forceLogout,
  switchUser,
  debug
} from '../controllers/auth.controller.js';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware.js';
import { IUser } from '../models/User.js';
import {
  authRateLimit,
  passwordResetRateLimit,
  tokenRefreshRateLimit
} from '../middlewares/rateLimiting.middleware.js';

// Extended request interface for authenticated routes
interface AuthenticatedRequest extends Request {
  user?: IUser;
}

const router: IRouter = express.Router();

// Public routes with rate limiting
router.post('/login', authRateLimit, login);
router.post('/logout', logout);
router.post('/refresh', tokenRefreshRateLimit, refreshToken);
router.post('/password-reset', passwordResetRateLimit, resetPassword);
router.post('/password-reset/confirm', passwordResetRateLimit, confirmPasswordReset);

// Protected routes
router.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) { res.status(401).json({ error: 'Not authenticated' }); return; }

  // Return user with backend-computed effective permissions (role defaults + user overrides)
  const permissionService = PermissionService.getInstance();
  const effectivePermissions = permissionService.getEffectivePermissions(user);

  res.json({
    user: {
      ...user,
      effectivePermissions
    }
  });
});
// Admin creation endpoint - disabled by default for security
// Set ALLOW_ADMIN_CREATION=true in environment to enable (for initial setup only)
router.post('/create-admin', authRateLimit, (req, res, next): void => {
  if (process.env.ALLOW_ADMIN_CREATION !== 'true') {
    res.status(403).json({
      error: 'Admin creation is disabled',
      message: 'Set ALLOW_ADMIN_CREATION=true in environment variables to enable this endpoint'
    });
    return;
  }
  next();
}, createAdmin);
router.post('/create-temp-user', authenticateToken, requireRole('admin'), createTempUser);
router.post('/force-logout', authenticateToken, forceLogout);
router.post('/switch-user', authenticateToken, requireRole(['admin', 'super_admin']), switchUser);

// Debug route (development only)
router.get('/debug', authenticateToken, debug);

export default router;