import { useState, useCallback } from 'react';
import { UserApiService, UserUtilsService } from '@/services/UserApiService';
import { User, CreateUserData, UserFilters, UserRole } from '@/types/user';

export function useUsers() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getUsers = useCallback(async (params?: {
    role?: string;
    active?: boolean;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const filters: UserFilters = {};
      
      if (params?.role) {
        filters.role = params.role as UserRole;
      }
      if (params?.active !== undefined) {
        filters.status = params.active ? 'active' : 'inactive';
      }

      const users = await UserApiService.getUsers(filters);
      return users;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch users';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(async (userData: CreateUserData) => {
    setLoading(true);
    setError(null);

    try {
      const user = await UserApiService.createUser(userData);
      return user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create user';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const getSuperAdminUser = useCallback(async () => {
    try {
      const users = await getUsers({ role: 'super_admin' });
      return users.length > 0 ? users[0] : null;
    } catch (err) {
      console.error('Error fetching Super Admin user:', err);
      return null;
    }
  }, [getUsers]);

  const ensureSuperAdminUser = useCallback(async () => {
    try {
      let superAdminUser = await getSuperAdminUser();
      
      if (!superAdminUser) {
        superAdminUser = await createUser({
          username: 'super_admin',
          email: 'admin@leaftolife.com.sg',
          role: 'super_admin',
          firstName: 'Super',
          lastName: 'Admin',
          displayName: 'Super Admin',
          discountPermissions: {
            canApplyDiscounts: true,
            maxDiscountPercent: 100,
            maxDiscountAmount: 999999,
            unlimitedDiscounts: true,
            canApplyProductDiscounts: true,
            canApplyBillDiscounts: true
          },
          isActive: true
        });
      }
      
      return superAdminUser;
    } catch (err) {
      console.error('Error ensuring Super Admin user:', err);
      throw err;
    }
  }, [getSuperAdminUser, createUser]);

  const checkDiscountPermission = useCallback((
    user: User | null,
    discountPercent: number = 0,
    discountAmount: number = 0
  ) => {
    if (!user) {
      return { allowed: false, reason: 'No user selected' };
    }

    if (!UserUtilsService.hasDiscountPermissions(user)) {
      return { allowed: false, reason: 'No discount permissions' };
    }

    const { unlimited, maxPercent, maxAmount } = UserUtilsService.getMaxDiscountInfo(user);

    if (unlimited || user.role === 'super_admin') {
      return { allowed: true };
    }

    if (discountPercent > maxPercent) {
      return { 
        allowed: false, 
        reason: `Discount percent exceeds limit of ${maxPercent}%` 
      };
    }

    if (discountAmount > maxAmount) {
      return { 
        allowed: false, 
        reason: `Discount amount exceeds limit of $${maxAmount}` 
      };
    }

    return { allowed: true };
  }, []);

  return {
    loading,
    error,
    getUsers,
    createUser,
    getSuperAdminUser,
    ensureSuperAdminUser,
    checkDiscountPermission,
  };
}