import { useState, useCallback } from 'react';
import { UserApiService, UserUtilsService } from '@/services/UserApiService';
import { User, CreateUserData, UpdateUserData, UserFilters, UserStats } from '@/types/user';

export interface UseUserManagementState {
  users: User[];
  loading: boolean;
  error: string | null;
  stats: UserStats;
}

export interface UseUserManagementActions {
  fetchUsers: (filters?: UserFilters) => Promise<void>;
  createUser: (userData: CreateUserData) => Promise<User>;
  updateUser: (id: string, userData: UpdateUserData) => Promise<User>;
  deleteUser: (id: string) => Promise<void>;
  updatePassword: (id: string, password: string) => Promise<void>;
  toggleUserStatus: (id: string, isActive: boolean) => Promise<User>;
  refreshUsers: () => Promise<void>;
}

export function useUserManagement(): UseUserManagementState & UseUserManagementActions {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async (filters?: UserFilters) => {
    setLoading(true);
    setError(null);
    
    try {
      const fetchedUsers = await UserApiService.getUsers(filters);
      setUsers(fetchedUsers);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch users';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(async (userData: CreateUserData): Promise<User> => {
    try {
      const newUser = await UserApiService.createUser(userData);
      setUsers(prev => [...prev, newUser]);
      return newUser;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create user';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const updateUser = useCallback(async (id: string, userData: UpdateUserData): Promise<User> => {
    try {
      const updatedUser = await UserApiService.updateUser(id, userData);
      setUsers(prev => prev.map(user => user._id === id ? updatedUser : user));
      return updatedUser;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const deleteUser = useCallback(async (id: string): Promise<void> => {
    try {
      await UserApiService.deleteUser(id);
      setUsers(prev => prev.filter(user => user._id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete user';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const updatePassword = useCallback(async (id: string, password: string): Promise<void> => {
    try {
      await UserApiService.updateUserPassword(id, password);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update password';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const toggleUserStatus = useCallback(async (id: string, isActive: boolean): Promise<User> => {
    try {
      const updatedUser = await UserApiService.toggleUserStatus(id, isActive);
      setUsers(prev => prev.map(user => user._id === id ? updatedUser : user));
      return updatedUser;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle user status';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const refreshUsers = useCallback(async () => {
    await fetchUsers();
  }, [fetchUsers]);

  const stats = UserUtilsService.calculateUserStats(users || []);

  return {
    users,
    loading,
    error,
    stats,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    updatePassword,
    toggleUserStatus,
    refreshUsers,
  };
}