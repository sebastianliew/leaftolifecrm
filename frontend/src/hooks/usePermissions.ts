import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { PermissionService } from '@/lib/permissions/PermissionService.client';

export interface FeaturePermissions {
  inventory: {
    canViewInventory: boolean;
    canAddProducts: boolean;
    canEditProducts: boolean;
    canDeleteProducts: boolean;
    canManageStock: boolean;
    canCreateRestockOrders: boolean;
    canBulkOperations: boolean;
    canEditCostPrices: boolean;
  };
  transactions: {
    canViewTransactions: boolean;
    canCreateTransactions: boolean;
    canEditTransactions: boolean;
    canDeleteTransactions: boolean;
    canApplyDiscounts: boolean;
    canRefundTransactions: boolean;
    canViewFinancialDetails: boolean;
  };
  patients: {
    canCreatePatients: boolean;
    canEditPatients: boolean;
    canDeletePatients: boolean;
    canViewMedicalHistory: boolean;
    canManagePrescriptions: boolean;
    canAccessAllPatients: boolean;
  };
  reports: {
    canViewFinancialReports: boolean;
    canViewInventoryReports: boolean;
    canViewUserReports: boolean;
    canViewSecurityMetrics: boolean;
    canExportReports: boolean;
  };
  userManagement: {
    canViewUsers: boolean;
    canCreateUsers: boolean;
    canEditUsers: boolean;
    canDeleteUsers: boolean;
    canAssignRoles: boolean;
    canChangeRoles: boolean;
    canManagePermissions: boolean;
    canResetPasswords: boolean;
    canViewSecurityLogs: boolean;
    canViewAuditLogs: boolean;
  };
  bundles: {
    canViewBundles: boolean;
    canCreateBundles: boolean;
    canEditBundles: boolean;
    canDeleteBundles: boolean;
    canSetPricing: boolean;
  };
  blends: {
    canViewFixedBlends: boolean;
    canCreateFixedBlends: boolean;
    canEditFixedBlends: boolean;
    canDeleteFixedBlends: boolean;
    canCreateCustomBlends: boolean;
  };
  suppliers: {
    canManageSuppliers: boolean;
    canCreateSuppliers: boolean;
    canEditSuppliers: boolean;
    canDeleteSuppliers: boolean;
  };
  brands: {
    canManageBrands: boolean;
    canCreateBrands: boolean;
    canEditBrands: boolean;
    canDeleteBrands: boolean;
  };
  containers: {
    canManageContainerTypes: boolean;
    canCreateTypes: boolean;
    canEditTypes: boolean;
    canDeleteTypes: boolean;
  };
  appointments: {
    canViewAllAppointments: boolean;
    canCreateAppointments: boolean;
    canEditAppointments: boolean;
    canDeleteAppointments: boolean;
    canManageSchedules: boolean;
    canOverrideBookings: boolean;
  };
  discounts: {
    canApplyProductDiscounts: boolean;
    canApplyBillDiscounts: boolean;
    unlimitedDiscounts: boolean;
    maxDiscountPercent: number;
    maxDiscountAmount: number;
  };
  settings: {
    canViewSettings: boolean;
    canEditSettings: boolean;
    canManageIntegrations: boolean;
    canConfigureSystem: boolean;
  };
}

export const usePermissions = () => {
  const { user, loading: authLoading } = useAuth();

  // Get effective permissions by merging role defaults with user-specific overrides
  const permissions = useMemo(() => {
    if (!user) return null;

    // Get role defaults from PermissionService
    const permissionService = PermissionService.getInstance();
    const roleDefaults = permissionService.getRoleDefaults(user.role);

    // Merge role defaults with user-specific featurePermissions
    // User-specific permissions override role defaults
    const userPermissions = user.featurePermissions || {};

    const merged: Record<string, Record<string, boolean | number>> = {};

    // Start with role defaults
    for (const [category, perms] of Object.entries(roleDefaults)) {
      merged[category] = { ...(perms as Record<string, boolean | number>) };
    }

    // Override with user-specific permissions
    for (const [category, perms] of Object.entries(userPermissions)) {
      if (!merged[category]) {
        merged[category] = {};
      }
      for (const [perm, value] of Object.entries(perms as Record<string, boolean | number>)) {
        // Only override if the user has an explicit value set
        if (value !== undefined) {
          merged[category][perm] = value;
        }
      }
    }

    return merged as unknown as FeaturePermissions;
  }, [user]);

  // Check if user has a specific permission
  const hasPermission = <K extends keyof FeaturePermissions>(
    category: K,
    permission: keyof FeaturePermissions[K] | string
  ): boolean => {
    if (!user) return false;

    // Super admin has unlimited access
    if (user.role === 'super_admin') return true;

    // Check merged permissions
    if (permissions && permissions[category]) {
      const categoryPerms = permissions[category];
      const value = categoryPerms[permission as keyof typeof categoryPerms];
      return value === true;
    }

    return false;
  };

  // Check if user can perform a specific action on a resource
  const canPerformAction = (resource: string, action: string): boolean => {
    if (!user) return false;

    // Super admin has unlimited access
    if (user.role === 'super_admin') return true;

    // Map resource/action to permission categories
    const resourcePermissionMap: Record<string, keyof FeaturePermissions> = {
      'products': 'inventory',
      'inventory': 'inventory',
      'transactions': 'transactions',
      'patients': 'patients',
      'users': 'userManagement',
      'reports': 'reports',
      'bundles': 'bundles',
      'blends': 'blends',
      'suppliers': 'suppliers',
      'brands': 'brands',
      'containers': 'containers',
      'appointments': 'appointments',
      'discounts': 'discounts'
    };

    const category = resourcePermissionMap[resource];
    if (!category) return false;

    // Map actions to specific permissions
    const actionMap: Record<string, string> = {
      'create': 'canCreate',
      'edit': 'canEdit',
      'delete': 'canDelete',
      'view': 'canView',
      'manage': 'canManage',
      'add': 'canAdd',
      'process': 'canProcess'
    };

    const permissionSuffix = actionMap[action] || action;
    const permission = `${permissionSuffix}${resource.charAt(0).toUpperCase() + resource.slice(1)}`;

    return hasPermission(category, permission);
  };

  // Check if user has a specific access level
  const hasAccessLevel = (level: 'read' | 'write' | 'admin' | 'super'): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;

    // Define role hierarchy
    const roleLevels = {
      'user': ['read'],
      'staff': ['read', 'write'],
      'manager': ['read', 'write'],
      'admin': ['read', 'write', 'admin'],
      'super_admin': ['read', 'write', 'admin', 'super']
    };

    const userLevels = roleLevels[user.role as keyof typeof roleLevels] || ['read'];
    return userLevels.includes(level);
  };

  // Check if user can access a specific route
  const canAccessRoute = (route: string): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;

    // Define route access patterns
    const adminRoutes = ['/admin', '/users', '/security'];
    const managerRoutes = ['/reports', '/analytics'];
    const staffRoutes = ['/inventory', '/transactions', '/patients'];

    // Check admin routes
    if (adminRoutes.some(adminRoute => route.startsWith(adminRoute))) {
      return user.role === 'admin' || user.role === 'super_admin';
    }

    // Check manager routes
    if (managerRoutes.some(managerRoute => route.startsWith(managerRoute))) {
      return ['manager', 'admin', 'super_admin'].includes(user.role);
    }

    // Check staff routes
    if (staffRoutes.some(staffRoute => route.startsWith(staffRoute))) {
      return ['staff', 'manager', 'admin', 'super_admin'].includes(user.role);
    }

    // Default allow for other routes
    return true;
  };

  return {
    user,
    permissions,
    loading: authLoading,
    hasPermission,
    canPerformAction,
    hasAccessLevel,
    canAccessRoute,
  };
};
