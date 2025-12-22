"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

interface User {
  _id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'staff' | 'super_admin';
  firstName?: string;
  lastName?: string;
  displayName?: string;
  discountPermissions: {
    canApplyDiscounts: boolean;
    maxDiscountPercent: number;
    maxDiscountAmount: number;
    unlimitedDiscounts: boolean;
    canApplyProductDiscounts: boolean;
    canApplyBillDiscounts: boolean;
  };
  featurePermissions?: {
    discounts?: {
      canApplyProductDiscounts?: boolean;
      canApplyBillDiscounts?: boolean;
      maxDiscountPercent?: number;
      maxDiscountAmount?: number;
      unlimitedDiscounts?: boolean;
    };
    inventory?: {
      canManageProducts?: boolean;
      canAdjustStock?: boolean;
      canViewReports?: boolean;
    };
    customers?: {
      canViewCustomers?: boolean;
      canEditCustomers?: boolean;
      canDeleteCustomers?: boolean;
    };
    transactions?: {
      canCreateTransactions?: boolean;
      canEditTransactions?: boolean;
      canDeleteTransactions?: boolean;
      canIssueRefunds?: boolean;
    };
    reports?: {
      canViewReports?: boolean;
      canExportReports?: boolean;
    };
  };
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateUserData {
  username: string;
  email: string;
  password?: string;
  role: 'admin' | 'manager' | 'staff' | 'super_admin';
  firstName?: string;
  lastName?: string;
  displayName?: string;
  discountPermissions?: Partial<User['discountPermissions']>;
  featurePermissions?: {
    discounts?: {
      canApplyProductDiscounts?: boolean;
      canApplyBillDiscounts?: boolean;
      maxDiscountPercent?: number;
      maxDiscountAmount?: number;
      unlimitedDiscounts?: boolean;
    };
    inventory?: {
      canManageProducts?: boolean;
      canAdjustStock?: boolean;
      canViewReports?: boolean;
    };
    customers?: {
      canViewCustomers?: boolean;
      canEditCustomers?: boolean;
      canDeleteCustomers?: boolean;
    };
    transactions?: {
      canCreateTransactions?: boolean;
      canEditTransactions?: boolean;
      canDeleteTransactions?: boolean;
      canIssueRefunds?: boolean;
    };
    reports?: {
      canViewReports?: boolean;
      canExportReports?: boolean;
    };
  };
  isActive?: boolean;
}

interface UpdateUserData extends Partial<CreateUserData> {
  _id: string;
}

const fetchUsers = async (params?: { role?: string; active?: boolean }): Promise<User[]> => {
  const queryParams: Record<string, string> = {};
  
  if (params?.role) {
    queryParams.role = params.role;
  }
  if (params?.active !== undefined) {
    queryParams.active = params.active.toString();
  }

  const response = await api.get<{ users: User[] }>('/users', queryParams);

  if (!response.ok) {
    throw new Error(response.error || 'Failed to fetch users');
  }

  return response.data?.users || [];
}

const createUser = async (userData: CreateUserData): Promise<User> => {
  const response = await api.post<{ user: User }>('/users', userData);

  if (!response.ok) {
    // Use validation error message from API if available
    const errorMessage = response.error || 'Failed to create user';
    throw new Error(errorMessage);
  }

  return response.data?.user as User;
}

const updateUser = async (userData: UpdateUserData): Promise<User> => {
  const { _id, ...updateData } = userData;
  const response = await api.put<{ user: User }>(`/users/${_id}`, updateData);

  if (!response.ok) {
    throw new Error(response.error || 'Failed to update user');
  }

  return response.data?.user as User;
}

const deleteUser = async (userId: string): Promise<void> => {
  const response = await api.delete(`/users/${userId}`);

  if (!response.ok) {
    throw new Error(response.error || 'Failed to delete user');
  }
}

// Query hooks
export function useUsersQuery(params?: { role?: string; active?: boolean }, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => fetchUsers(params),
    enabled: options?.enabled !== false,
  })
}

export function useSuperAdminUserQuery() {
  return useQuery({
    queryKey: ['users', { role: 'super_admin' }],
    queryFn: () => fetchUsers({ role: 'super_admin' }),
    select: (users) => users.length > 0 ? users[0] : null,
  })
}

// Mutation hooks
export function useCreateUserMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// Utility functions
export function checkDiscountPermission(
  user: User | null,
  discountPercent: number = 0,
  discountAmount: number = 0
) {
  if (!user) {
    return { allowed: false, reason: 'No user selected' };
  }

  if (!user.discountPermissions?.canApplyDiscounts) {
    return { allowed: false, reason: 'No discount permissions' };
  }

  if (user.discountPermissions?.unlimitedDiscounts || user.role === 'super_admin') {
    return { allowed: true };
  }

  if (discountPercent > (user.discountPermissions?.maxDiscountPercent || 0)) {
    return { 
      allowed: false, 
      reason: `Discount percent exceeds limit of ${user.discountPermissions?.maxDiscountPercent || 0}%` 
    };
  }

  if (discountAmount > (user.discountPermissions?.maxDiscountAmount || 0)) {
    return { 
      allowed: false, 
      reason: `Discount amount exceeds limit of $${user.discountPermissions?.maxDiscountAmount || 0}` 
    };
  }

  return { allowed: true };
}