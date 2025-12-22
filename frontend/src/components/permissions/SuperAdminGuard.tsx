'use client';

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

interface SuperAdminGuardProps {
  children: React.ReactNode;
  feature: 'cost_price_edit' | 'package_pricing' | 'discounts' | 'inventory_management' | 
           'product_management' | 'reports' | 'supplier_management' | 'fixed_blends';
  fallback?: React.ReactNode;
  showMessage?: boolean;
  className?: string;
}

interface FeaturePermissionMap {
  [key: string]: {
    category: string;
    permission: string;
    displayName: string;
  };
}

const FEATURE_PERMISSION_MAP: FeaturePermissionMap = {
  cost_price_edit: {
    category: 'inventory',
    permission: 'canEditCostPrices',
    displayName: 'Cost Price Editing'
  },
  package_pricing: {
    category: 'bundles',
    permission: 'canManageBundlePricing',
    displayName: 'Package Price Setup'
  },
  discounts: {
    category: 'discounts',
    permission: 'canApplyProductDiscounts',
    displayName: 'Discount Management'
  },
  inventory_management: {
    category: 'inventory',
    permission: 'canManageStock',
    displayName: 'Inventory Updates & Adjustments'
  },
  product_management: {
    category: 'inventory',
    permission: 'canAddProducts',
    displayName: 'Product Setup & Deletion'
  },
  reports: {
    category: 'reports',
    permission: 'canViewFinancialReports',
    displayName: 'All Reports Access'
  },
  supplier_management: {
    category: 'suppliers',
    permission: 'canAddSuppliers',
    displayName: 'Supplier Management'
  },
  fixed_blends: {
    category: 'blends',
    permission: 'canCreateFixedBlends',
    displayName: 'Fixed Blend Management'
  }
};

/**
 * SuperAdminGuard Component
 * 
 * Protects specific features to be accessible only by Super Admin or when
 * Super Admin has delegated permissions to other users.
 * 
 * @param children - Content to render when user has permission
 * @param feature - The feature being protected (maps to specific permissions)
 * @param fallback - Optional custom content to show when access is denied
 * @param showMessage - Whether to show an access denied message (default: true)
 * @param className - Additional CSS classes
 */
export function SuperAdminGuard({ 
  children, 
  feature, 
  fallback, 
  showMessage = true,
  className = '' 
}: SuperAdminGuardProps) {
  const { user, hasPermission, loading } = usePermissions();

  // Show loading state while checking permissions
  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-100 rounded ${className}`}>
        <div className="h-8 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // If no user, deny access
  if (!user) {
    return showMessage ? (
      <Alert className="border-red-200 bg-red-50">
        <Lock className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          Authentication required to access this feature.
        </AlertDescription>
      </Alert>
    ) : null;
  }

  const featureConfig = FEATURE_PERMISSION_MAP[feature];
  if (!featureConfig) {
    console.error(`Unknown feature: ${feature}`);
    return null;
  }

  // Super Admin always has access
  if (user.role === 'super_admin') {
    return <>{children}</>;
  }

  // Check if Super Admin has delegated this permission
  const validCategories = ['discounts', 'reports', 'inventory', 'userManagement', 'patients', 'transactions', 'bundles'] as const;
  type ValidCategory = typeof validCategories[number];
  
  const category = validCategories.includes(featureConfig.category as ValidCategory) 
    ? (featureConfig.category as ValidCategory)
    : 'discounts';
  const hasAccess = hasPermission(category, featureConfig.permission);

  if (hasAccess) {
    return <>{children}</>;
  }

  // Access denied - show fallback or message
  if (fallback) {
    return <>{fallback}</>;
  }

  if (showMessage) {
    return (
      <Alert className="border-amber-200 bg-amber-50">
        <Shield className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>{featureConfig.displayName}</strong> is restricted to Super Admin access only.
          {user.role === 'admin' || user.role === 'manager' ? 
            ' Contact your Super Admin to delegate access to this feature.' : 
            ' Please contact your administrator for access.'
          }
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

/**
 * Hook to check Super Admin feature access
 * Useful for conditional logic in components
 */
export function useSuperAdminAccess(feature: SuperAdminGuardProps['feature']) {
  const { user, hasPermission, loading } = usePermissions();

  if (loading || !user) {
    return { hasAccess: false, loading, user };
  }

  // Super Admin always has access
  if (user.role === 'super_admin') {
    return { hasAccess: true, loading: false, user };
  }

  const featureConfig = FEATURE_PERMISSION_MAP[feature];
  if (!featureConfig) {
    return { hasAccess: false, loading: false, user };
  }

  // Check delegated permission
  const validCategories = ['discounts', 'reports', 'inventory', 'userManagement', 'patients', 'transactions', 'bundles'] as const;
  type ValidCategory = typeof validCategories[number];
  
  const category = validCategories.includes(featureConfig.category as ValidCategory) 
    ? (featureConfig.category as ValidCategory)
    : 'discounts';
  const hasAccess = hasPermission(category, featureConfig.permission);
  
  return { hasAccess, loading: false, user };
}

/**
 * Quick component to show Super Admin only badge
 */
export function SuperAdminBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 ${className}`}>
      <Shield className="w-3 h-3 mr-1" />
      Super Admin Only
    </span>
  );
}

/**
 * Component to wrap buttons/actions that require Super Admin access
 * Automatically disables and shows tooltip when access is denied
 */
interface SuperAdminActionProps extends SuperAdminGuardProps {
  disabled?: boolean;
  onUnauthorizedClick?: () => void;
}

export function SuperAdminAction({ 
  children, 
  feature, 
  disabled: _disabled = false,
  onUnauthorizedClick,
  className = ''
}: SuperAdminActionProps) {
  const { hasAccess } = useSuperAdminAccess(feature);

  const handleClick = (e: React.MouseEvent) => {
    if (!hasAccess && onUnauthorizedClick) {
      e.preventDefault();
      e.stopPropagation();
      onUnauthorizedClick();
    }
  };

  return (
    <div 
      className={`${!hasAccess ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      onClick={handleClick}
      title={!hasAccess ? 'Super Admin access required' : undefined}
    >
      {React.cloneElement(children as React.ReactElement, {
        ...(hasAccess ? {} : { style: { pointerEvents: 'none' as const } })
      })}
    </div>
  );
}

export default SuperAdminGuard;