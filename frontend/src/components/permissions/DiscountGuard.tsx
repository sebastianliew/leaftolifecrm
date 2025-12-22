import React, { useState, useCallback } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionCheck } from '@/lib/permissions/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { DollarSign, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface DiscountGuardProps {
  children: React.ReactNode;
  discountPercent?: number;
  discountAmount?: number;
  discountType?: 'product' | 'bill';
  onDiscountChange?: (percent: number, amount: number) => void;
  onDiscountApproved?: (percent: number, amount: number) => void;
  fallback?: React.ReactNode;
  showControls?: boolean;
  autoCheck?: boolean;
}

export const DiscountGuard: React.FC<DiscountGuardProps> = ({
  children,
  discountPercent = 0,
  discountAmount = 0,
  discountType = 'bill',
  onDiscountChange,
  onDiscountApproved,
  fallback,
  showControls = false,
  autoCheck = true
}) => {
  const { user, permissions, hasPermission } = usePermissions();
  
  // Local implementation of checkDiscountPermission
  const checkDiscountPermission = useCallback((percent: number, amount: number, type: 'product' | 'bill'): PermissionCheck => {
    if (!user || !permissions) {
      return { allowed: false, reason: 'User not authenticated' };
    }

    // Super admin has unlimited permissions
    if (user.role === 'super_admin') {
      return { allowed: true };
    }

    const discountPerms = permissions.discounts;
    if (!discountPerms) {
      return { allowed: false, reason: 'No discount permissions found' };
    }

    // Check if user can apply this type of discount
    const canApplyType = type === 'product' 
      ? hasPermission('discounts', 'canApplyProductDiscounts')
      : hasPermission('discounts', 'canApplyBillDiscounts');
    
    if (!canApplyType) {
      return { allowed: false, reason: `Cannot apply ${type} discounts` };
    }

    // Check limits
    const maxPercent = discountPerms.maxDiscountPercent || 0;
    const maxAmount = discountPerms.maxDiscountAmount || 0;

    if (percent > maxPercent) {
      return { allowed: false, reason: `Discount percent ${percent}% exceeds limit of ${maxPercent}%` };
    }

    if (amount > maxAmount) {
      return { allowed: false, reason: `Discount amount $${amount} exceeds limit of $${maxAmount}` };
    }

    return { allowed: true };
  }, [user, permissions, hasPermission]);
  const [localPercent, setLocalPercent] = useState(discountPercent);
  const [localAmount, setLocalAmount] = useState(discountAmount);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [permissionCheck, setPermissionCheck] = useState<PermissionCheck>({ allowed: true });

  // Check permissions when values change
  React.useEffect(() => {
    if (autoCheck) {
      const check = checkDiscountPermission(localPercent, localAmount, discountType);
      setPermissionCheck(check);
    }
  }, [localPercent, localAmount, discountType, autoCheck, checkDiscountPermission]);

  const handleDiscountChange = (percent: number, amount: number) => {
    setLocalPercent(percent);
    setLocalAmount(amount);
    
    const check = checkDiscountPermission(percent, amount, discountType);
    setPermissionCheck(check);
    
    if (onDiscountChange) {
      onDiscountChange(percent, amount);
    }
  };

  const handleApproveDiscount = () => {
    if (onDiscountApproved) {
      onDiscountApproved(localPercent, localAmount);
    }
    setShowApprovalDialog(false);
  };

  const requestApproval = () => {
    setShowApprovalDialog(true);
  };

  if (!user) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          Please log in to apply discounts.
        </AlertDescription>
      </Alert>
    );
  }

  const discountPerms = permissions?.discounts;
  const maxPercent = discountPerms?.maxDiscountPercent || 0;
  const maxAmount = discountPerms?.maxDiscountAmount || 0;
  const canApplyType = discountType === 'product' 
    ? discountPerms?.canApplyProductDiscounts 
    : discountPerms?.canApplyBillDiscounts;

  // Check if user can apply this type of discount at all
  if (!canApplyType && user.role !== 'super_admin') {
    return fallback || (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          You don&apos;t have permission to apply {discountType} discounts.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Permission Status Display */}
      <div className="flex items-center space-x-2">
        {permissionCheck.allowed ? (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Discount Approved
          </Badge>
        ) : (
          <Badge variant="outline" className="text-red-600 border-red-600">
            <XCircle className="h-3 w-3 mr-1" />
            {permissionCheck.reason}
          </Badge>
        )}
        
        {user.role !== 'super_admin' && (
          <Badge variant="outline">
            Limit: {maxPercent}% / ${maxAmount}
          </Badge>
        )}
      </div>

      {/* Discount Controls */}
      {showControls && (
        <div className="p-4 border rounded-lg space-y-4">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4" />
            <Label className="font-medium">
              {discountType === 'product' ? 'Product' : 'Bill'} Discount
            </Label>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discount-percent">Discount Percent (%)</Label>
              <Input
                id="discount-percent"
                type="number"
                min="0"
                max={user.role === 'super_admin' ? 100 : maxPercent}
                value={localPercent}
                onChange={(e) => handleDiscountChange(
                  parseFloat(e.target.value) || 0, 
                  localAmount
                )}
                className={!permissionCheck.allowed ? 'border-red-500' : ''}
              />
              {user.role !== 'super_admin' && (
                <p className="text-xs text-gray-500 mt-1">
                  Max: {maxPercent}%
                </p>
              )}
            </div>
            
            <div>
              <Label htmlFor="discount-amount">Discount Amount ($)</Label>
              <Input
                id="discount-amount"
                type="number"
                min="0"
                max={user.role === 'super_admin' ? undefined : maxAmount}
                value={localAmount}
                onChange={(e) => handleDiscountChange(
                  localPercent, 
                  parseFloat(e.target.value) || 0
                )}
                className={!permissionCheck.allowed ? 'border-red-500' : ''}
              />
              {user.role !== 'super_admin' && (
                <p className="text-xs text-gray-500 mt-1">
                  Max: ${maxAmount}
                </p>
              )}
            </div>
          </div>

          {!permissionCheck.allowed && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {permissionCheck.reason}
                {(localPercent > maxPercent || localAmount > maxAmount) && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="ml-2"
                    onClick={requestApproval}
                  >
                    Request Approval
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Main content - only show if permission check passes */}
      {permissionCheck.allowed ? children : (
        fallback || (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {permissionCheck.reason}
            </AlertDescription>
          </Alert>
        )
      )}

      {/* Approval Request Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discount Approval Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              You are requesting approval for a discount that exceeds your limits:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Requested:</span>
                  <div>{localPercent}% / ${localAmount}</div>
                </div>
                <div>
                  <span className="font-medium">Your Limit:</span>
                  <div>{maxPercent}% / ${maxAmount}</div>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowApprovalDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleApproveDiscount}>
                Request Approval
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Simpler version for quick permission checks
interface QuickDiscountCheckProps {
  children: React.ReactNode;
  percent?: number;
  amount?: number;
  type?: 'product' | 'bill';
  fallback?: React.ReactNode;
}

export const QuickDiscountCheck: React.FC<QuickDiscountCheckProps> = ({
  children,
  percent = 0,
  amount = 0,
  type = 'bill',
  fallback
}) => {
  const { user, permissions, hasPermission } = usePermissions();
  
  // Local implementation of checkDiscountPermission
  const checkDiscountPermission = (percent: number, amount: number, type: 'product' | 'bill'): PermissionCheck => {
    if (!user || !permissions) {
      return { allowed: false, reason: 'User not authenticated' };
    }

    // Super admin has unlimited permissions
    if (user.role === 'super_admin') {
      return { allowed: true };
    }

    const discountPerms = permissions.discounts;
    if (!discountPerms) {
      return { allowed: false, reason: 'No discount permissions found' };
    }

    // Check if user can apply this type of discount
    const canApplyType = type === 'product' 
      ? hasPermission('discounts', 'canApplyProductDiscounts')
      : hasPermission('discounts', 'canApplyBillDiscounts');
    
    if (!canApplyType) {
      return { allowed: false, reason: `Cannot apply ${type} discounts` };
    }

    // Check limits
    const maxPercent = discountPerms.maxDiscountPercent || 0;
    const maxAmount = discountPerms.maxDiscountAmount || 0;

    if (percent > maxPercent) {
      return { allowed: false, reason: `Discount percent ${percent}% exceeds limit of ${maxPercent}%` };
    }

    if (amount > maxAmount) {
      return { allowed: false, reason: `Discount amount $${amount} exceeds limit of $${maxAmount}` };
    }

    return { allowed: true };
  };
  
  const check = checkDiscountPermission(percent, amount, type);

  if (check.allowed) {
    return <>{children}</>;
  }

  return fallback || (
    <Alert variant="destructive">
      <XCircle className="h-4 w-4" />
      <AlertDescription>
        {check.reason}
      </AlertDescription>
    </Alert>
  );
};

export default DiscountGuard;