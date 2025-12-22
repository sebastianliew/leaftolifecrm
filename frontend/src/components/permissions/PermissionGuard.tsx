import React from 'react';
import { usePermissions, type FeaturePermissions } from '@/hooks/usePermissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock } from 'lucide-react';

interface PermissionGuardProps {
  children: React.ReactNode;
  category?: keyof FeaturePermissions;
  permission?: string;
  resource?: string;
  action?: string;
  role?: string | string[];
  accessLevel?: 'read' | 'write' | 'admin' | 'super';
  route?: string;
  fallback?: React.ReactNode;
  showMessage?: boolean;
  messageVariant?: 'default' | 'destructive';
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  category,
  permission,
  resource,
  action,
  role,
  accessLevel,
  route,
  fallback,
  showMessage = true,
  messageVariant = 'default'
}) => {
  const { 
    user, 
    hasPermission, 
    canPerformAction, 
    hasAccessLevel, 
    canAccessRoute, 
    loading 
  } = usePermissions();

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-sm text-gray-600">Checking permissions...</span>
      </div>
    );
  }

  // Check if user is authenticated
  if (!user) {
    return showMessage ? (
      <Alert variant={messageVariant}>
        <Lock className="h-4 w-4" />
        <AlertDescription>
          Please log in to access this feature.
        </AlertDescription>
      </Alert>
    ) : (fallback || null);
  }

  let hasAccess = false;
  let denialReason = 'Access denied';

  // Check different permission types
  if (category && permission) {
    hasAccess = hasPermission(category, permission);
    denialReason = `Missing ${category}.${permission} permission`;
  } else if (resource && action) {
    hasAccess = canPerformAction(resource, action);
    denialReason = `Cannot ${action} ${resource}`;
  } else if (role) {
    const roles = Array.isArray(role) ? role : [role];
    hasAccess = roles.includes(user.role);
    denialReason = `Requires role: ${Array.isArray(role) ? role.join(' or ') : role}`;
  } else if (accessLevel) {
    hasAccess = hasAccessLevel(accessLevel);
    denialReason = `Requires ${accessLevel} access level or higher`;
  } else if (route) {
    hasAccess = canAccessRoute(route);
    denialReason = `No access to ${route}`;
  } else {
    // If no specific permission is specified, default to allowing access
    hasAccess = true;
  }

  // Grant access
  if (hasAccess) {
    return <>{children}</>;
  }

  // Access denied - show fallback or message
  if (fallback) {
    return <>{fallback}</>;
  }

  if (showMessage) {
    return (
      <Alert variant={messageVariant}>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          {denialReason}. Contact your administrator if you need access.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

// Specialized permission guards for common use cases

interface RoleGuardProps {
  children: React.ReactNode;
  roles: string | string[];
  fallback?: React.ReactNode;
  showMessage?: boolean;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ 
  children, 
  roles, 
  fallback, 
  showMessage = true 
}) => (
  <PermissionGuard 
    role={roles} 
    fallback={fallback} 
    showMessage={showMessage}
  >
    {children}
  </PermissionGuard>
);

interface AdminGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showMessage?: boolean;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ 
  children, 
  fallback, 
  showMessage = true 
}) => (
  <RoleGuard 
    roles={['admin', 'super_admin']} 
    fallback={fallback} 
    showMessage={showMessage}
  >
    {children}
  </RoleGuard>
);

interface FeatureGuardProps {
  children: React.ReactNode;
  category: keyof FeaturePermissions;
  permission: string;
  fallback?: React.ReactNode;
  showMessage?: boolean;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ 
  children, 
  category, 
  permission, 
  fallback, 
  showMessage = true 
}) => (
  <PermissionGuard 
    category={category} 
    permission={permission} 
    fallback={fallback} 
    showMessage={showMessage}
  >
    {children}
  </PermissionGuard>
);

interface RouteGuardProps {
  children: React.ReactNode;
  route: string;
  fallback?: React.ReactNode;
  showMessage?: boolean;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ 
  children, 
  route, 
  fallback, 
  showMessage = true 
}) => (
  <PermissionGuard 
    route={route} 
    fallback={fallback} 
    showMessage={showMessage}
  >
    {children}
  </PermissionGuard>
);

// Conditional rendering based on permissions
interface ConditionalRenderProps {
  condition: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ConditionalRender: React.FC<ConditionalRenderProps> = ({ 
  condition, 
  children, 
  fallback 
}) => {
  return condition ? <>{children}</> : <>{fallback}</>;
};

export default PermissionGuard;