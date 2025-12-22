import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware.js';
import { PermissionService } from '../lib/permissions/PermissionService.js';
import type { FeaturePermissions } from '../lib/permissions/types.js';

const permissionService = PermissionService.getInstance();

/**
 * Middleware to check if user has a specific permission
 * @param category - The permission category (e.g., 'inventory', 'transactions', 'patients')
 * @param permission - The specific permission to check (e.g., 'canViewInventory', 'canCreateTransactions')
 */
export const requirePermission = (category: keyof FeaturePermissions, permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const hasPermission = permissionService.hasPermission(user, category, permission);

    // Debug logging for permission checks
    if (!hasPermission) {
      console.log('[Permission Debug]', {
        userId: user._id,
        username: user.username,
        role: user.role,
        category,
        permission,
        userFeaturePermissions: user.featurePermissions,
        categoryPermissions: user.featurePermissions?.[category],
        hasPermission
      });
    }

    if (!hasPermission) {
      res.status(403).json({
        error: 'Permission denied',
        required: { category, permission }
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check multiple permissions (user must have ALL specified permissions)
 * @param permissions - Array of { category, permission } objects
 */
export const requireAllPermissions = (permissions: Array<{ category: keyof FeaturePermissions; permission: string }>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const missingPermissions = permissions.filter(
      ({ category, permission }) => !permissionService.hasPermission(user, category, permission)
    );

    if (missingPermissions.length > 0) {
      res.status(403).json({
        error: 'Permission denied',
        required: permissions,
        missing: missingPermissions
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check multiple permissions (user must have at least ONE specified permission)
 * @param permissions - Array of { category, permission } objects
 */
export const requireAnyPermission = (permissions: Array<{ category: keyof FeaturePermissions; permission: string }>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const hasAnyPermission = permissions.some(
      ({ category, permission }) => permissionService.hasPermission(user, category, permission)
    );

    if (!hasAnyPermission) {
      res.status(403).json({
        error: 'Permission denied',
        required: 'At least one of the following permissions',
        options: permissions
      });
      return;
    }

    next();
  };
};
