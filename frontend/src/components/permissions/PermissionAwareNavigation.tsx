import React from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions, FeaturePermissions } from '@/hooks/usePermissions';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Users, 
  Package, 
  FileText, 
  Shield,
  BarChart3,
  UserPlus,
  Calendar,
  ShoppingCart,
  TrendingUp,
  Database,
  Eye,
  EyeOff,
  Lock
} from 'lucide-react';

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  requiredPermission?: {
    category: string;
    permission: string;
  };
  requiredRole?: string | string[];
  requiredAccessLevel?: 'read' | 'write' | 'admin' | 'super';
  requiredRoute?: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  children?: NavigationItem[];
}

const navigationItems: NavigationItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: BarChart3,
    description: 'Overview and analytics'
  },
  {
    label: 'Transactions',
    href: '/transactions',
    icon: ShoppingCart,
    description: 'Sales and transaction management',
    requiredPermission: {
      category: 'transactions',
      permission: 'canCreateTransactions'
    }
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: Package,
    description: 'Product and stock management',
    requiredPermission: {
      category: 'inventory',
      permission: 'canAddProducts'
    },
    children: [
      {
        label: 'Products',
        href: '/inventory',
        icon: Package,
        requiredPermission: {
          category: 'inventory',
          permission: 'canAddProducts'
        }
      },
      {
        label: 'Restock',
        href: '/inventory/restock',
        icon: TrendingUp,
        requiredPermission: {
          category: 'inventory',
          permission: 'canCreateRestockOrders'
        }
      },
      {
        label: 'Categories',
        href: '/inventory/category',
        icon: FileText,
        requiredPermission: {
          category: 'inventory',
          permission: 'canEditProducts'
        }
      }
    ]
  },
  {
    label: 'Patients',
    href: '/patients',
    icon: Users,
    description: 'Patient records and management',
    requiredPermission: {
      category: 'patients',
      permission: 'canAccessAllPatients'
    }
  },
  {
    label: 'Bundles',
    href: '/bundles',
    icon: Package,
    description: 'Product bundles and packages',
    requiredPermission: {
      category: 'bundles',
      permission: 'canViewBundleStats'
    }
  },
  {
    label: 'Appointments',
    href: '/appointments',
    icon: Calendar,
    description: 'Appointment scheduling',
    requiredPermission: {
      category: 'appointments',
      permission: 'canManageSchedules'
    }
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: FileText,
    description: 'Analytics and reporting',
    requiredPermission: {
      category: 'reports',
      permission: 'canViewInventoryReports'
    },
    children: [
      {
        label: 'Item Sales',
        href: '/reports/item-sales',
        icon: BarChart3,
        requiredPermission: {
          category: 'reports',
          permission: 'canViewFinancialReports'
        }
      }
    ]
  },
  {
    label: 'User Management',
    href: '/users',
    icon: UserPlus,
    description: 'User accounts and roles',
    requiredPermission: {
      category: 'userManagement',
      permission: 'canCreateUsers'
    }
  },
  {
    label: 'Admin Panel',
    href: '/admin',
    icon: Shield,
    description: 'Administrative tools',
    requiredRole: ['admin', 'super_admin'],
    badge: 'Admin',
    badgeVariant: 'destructive',
    children: [
      {
        label: 'Security',
        href: '/admin/security',
        icon: Lock,
        requiredPermission: {
          category: 'security',
          permission: 'canViewSecurityLogs'
        }
      },
      {
        label: 'Database',
        href: '/admin/database',
        icon: Database,
        requiredPermission: {
          category: 'settings',
          permission: 'canConfigureSystem'
        }
      }
    ]
  }
];

interface PermissionAwareNavigationProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  showIcons?: boolean;
  showDescriptions?: boolean;
  showRestrictedItems?: boolean;
  onNavigate?: (href: string) => void;
}

export const PermissionAwareNavigation: React.FC<PermissionAwareNavigationProps> = ({
  className,
  orientation = 'vertical',
  showIcons = true,
  showDescriptions = false,
  showRestrictedItems = false,
  onNavigate
}) => {
  const router = useRouter();
  const { hasPermission, user } = usePermissions();
  
  // Local implementations of missing methods
  const hasAccessLevel = (level: 'read' | 'write' | 'admin' | 'super'): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    
    // Simple role-based access levels
    const roleLevels = {
      'user': ['read'],
      'staff': ['read', 'write'],
      'manager': ['read', 'write'],
      'admin': ['read', 'write', 'admin'],
      'super_admin': ['read', 'write', 'admin', 'super']
    };
    
    return roleLevels[user.role as keyof typeof roleLevels]?.includes(level) || false;
  };
  
  const canAccessRoute = (route: string): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    
    // Basic route access based on common patterns
    const adminRoutes = ['/admin', '/users'];
    if (adminRoutes.some(adminRoute => route.startsWith(adminRoute))) {
      return user.role === 'admin' || user.role === 'super_admin';
    }
    
    return true; // Allow access to other routes by default
  };

  const checkItemAccess = (item: NavigationItem): boolean => {
    if (!user) return false;

    // Super Admin has access to everything
    if (user.role === 'super_admin') return true;

    // Check role requirement
    if (item.requiredRole) {
      const roles = Array.isArray(item.requiredRole) ? item.requiredRole : [item.requiredRole];
      if (!roles.includes(user.role)) return false;
    }

    // Check permission requirement
    if (item.requiredPermission) {
      const { category, permission } = item.requiredPermission;
      if (!hasPermission(category as keyof FeaturePermissions, permission)) return false;
    }

    // Check access level requirement
    if (item.requiredAccessLevel) {
      if (!hasAccessLevel(item.requiredAccessLevel)) return false;
    }

    // Check route access
    if (item.requiredRoute) {
      if (!canAccessRoute(item.requiredRoute)) return false;
    }

    return true;
  };

  const handleItemClick = (item: NavigationItem) => {
    if (onNavigate) {
      onNavigate(item.href);
    } else {
      router.push(item.href);
    }
  };

  const renderNavigationItem = (item: NavigationItem, depth = 0) => {
    const hasAccess = checkItemAccess(item);
    const Icon = item.icon;

    // Don't render restricted items unless specifically requested
    if (!hasAccess && !showRestrictedItems) {
      return null;
    }

    const itemClassName = cn(
      "flex items-center space-x-2 p-2 rounded-lg transition-colors",
      orientation === 'horizontal' ? "flex-row" : "flex-col sm:flex-row",
      hasAccess 
        ? "hover:bg-gray-100 cursor-pointer text-gray-900" 
        : "text-gray-400 cursor-not-allowed opacity-50",
      depth > 0 && "ml-4",
      className
    );

    const content = (
      <>
        {showIcons && <Icon className={cn("h-4 w-4", !hasAccess && "opacity-50")} />}
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className={cn("font-medium", orientation === 'horizontal' && "text-sm")}>
              {item.label}
            </span>
            {item.badge && (
              <Badge variant={item.badgeVariant || 'default'} className="text-xs">
                {item.badge}
              </Badge>
            )}
            {!hasAccess && showRestrictedItems && (
              <EyeOff className="h-3 w-3 text-gray-400" />
            )}
          </div>
          {showDescriptions && item.description && (
            <p className="text-xs text-gray-500 mt-1">{item.description}</p>
          )}
        </div>
      </>
    );

    return (
      <div key={item.href}>
        {hasAccess ? (
          <div 
            className={itemClassName}
            onClick={() => handleItemClick(item)}
          >
            {content}
          </div>
        ) : showRestrictedItems ? (
          <div className={itemClassName} title="Access restricted">
            {content}
          </div>
        ) : null}
        
        {/* Render children */}
        {item.children && (
          <div className={cn("mt-1", depth === 0 && "ml-2")}>
            {item.children.map(child => renderNavigationItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center p-4 text-gray-500">
        <Lock className="h-4 w-4 mr-2" />
        <span>Please log in to access navigation</span>
      </div>
    );
  }

  return (
    <nav className={cn(
      "space-y-1",
      orientation === 'horizontal' && "flex space-y-0 space-x-2",
      className
    )}>
      {navigationItems.map(item => renderNavigationItem(item))}
    </nav>
  );
};

// Simplified version for breadcrumbs or specific route checking
interface RouteAccessIndicatorProps {
  route: string;
  children: React.ReactNode;
  showIcon?: boolean;
}

export const RouteAccessIndicator: React.FC<RouteAccessIndicatorProps> = ({
  route,
  children,
  showIcon = true
}) => {
  const { user } = usePermissions();
  
  const canAccessRoute = (route: string): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    
    // Basic route access based on common patterns
    const adminRoutes = ['/admin', '/users'];
    if (adminRoutes.some(adminRoute => route.startsWith(adminRoute))) {
      return user.role === 'admin' || user.role === 'super_admin';
    }
    
    return true; // Allow access to other routes by default
  };
  
  const hasAccess = canAccessRoute(route);

  return (
    <div className={cn(
      "flex items-center space-x-2",
      !hasAccess && "opacity-50"
    )}>
      {showIcon && (
        hasAccess ? (
          <Eye className="h-3 w-3 text-green-600" />
        ) : (
          <EyeOff className="h-3 w-3 text-red-600" />
        )
      )}
      <span className={!hasAccess ? "text-gray-400" : ""}>
        {children}
      </span>
    </div>
  );
};

// Permission summary for user
export const UserPermissionSummary: React.FC = () => {
  const { user, permissions } = usePermissions();

  if (!user) return null;

  // Local implementation of getPermissionSummary
  const getPermissionSummary = () => {
    if (!permissions) return [];
    
    return Object.entries(permissions).map(([category, perms]) => ({
      category,
      permissions: Object.entries(perms).filter(([_, value]) => value === true).map(([key]) => key)
    }));
  };
  
  // Local implementation of getAccessLevel
  const getAccessLevel = (): string => {
    if (!user) return 'none';
    
    const levelMap = {
      'user': 'read',
      'staff': 'write', 
      'manager': 'write',
      'admin': 'admin',
      'super_admin': 'super'
    };
    
    return levelMap[user.role as keyof typeof levelMap] || 'read';
  };

  const summary = getPermissionSummary();
  const accessLevel = getAccessLevel();

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Your Permissions</h3>
        <Badge variant="outline">
          {accessLevel.toUpperCase()} ACCESS
        </Badge>
      </div>
      
      <div className="space-y-2">
        {summary.map((category, idx) => (
          <div key={idx}>
            <div className="font-medium text-sm text-gray-700">
              {category.category}
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {category.permissions.slice(0, 3).map((perm, permIdx) => (
                <Badge key={permIdx} variant="outline" className="text-xs">
                  {perm.replace(/^can/, '').replace(/([A-Z])/g, ' $1').trim()}
                </Badge>
              ))}
              {category.permissions.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{category.permissions.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PermissionAwareNavigation;