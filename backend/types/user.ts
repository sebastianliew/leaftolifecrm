export interface DiscountPermissions {
  canApplyDiscounts: boolean;
  maxDiscountPercent: number;
  maxDiscountAmount: number;
  unlimitedDiscounts: boolean;
  canApplyProductDiscounts: boolean;
  canApplyBillDiscounts: boolean;
}

export interface FeaturePermissions {
  discounts?: {
    canApplyProductDiscounts?: boolean;
    canApplyBillDiscounts?: boolean;
    maxDiscountPercent?: number;
    maxDiscountAmount?: number;
    unlimitedDiscounts?: boolean;
  };
  inventory?: {
    canManageProducts?: boolean;
    canViewReports?: boolean;
    canManageCategories?: boolean;
  };
  transactions?: {
    canProcessRefunds?: boolean;
    canViewAllTransactions?: boolean;
    canModifyTransactions?: boolean;
  };
  users?: {
    canManageUsers?: boolean;
    canViewAuditLogs?: boolean;
    canUpdatePasswords?: boolean;
  };
}

export type UserRole = 'admin' | 'manager' | 'staff' | 'super_admin';

export interface User {
  _id: string;
  username: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  discountPermissions: DiscountPermissions;
  featurePermissions?: FeaturePermissions;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateUserData = Omit<User, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateUserData = Partial<User>;

export interface UserFormData {
  username: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  discountPermissions: DiscountPermissions;
  featurePermissions?: Partial<FeaturePermissions>;
  isActive: boolean;
  password?: string;
}

export interface UserFilters {
  searchTerm?: string;
  role?: UserRole | 'all';
  status?: 'active' | 'inactive' | 'all';
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  staffUsers: number;
}