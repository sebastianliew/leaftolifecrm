import { useState, useMemo } from 'react';
import { User, UserFilters, UserRole } from '@/types/user';
import { UserUtilsService } from '@/services/UserApiService';

export interface UseUserFiltersState {
  searchTerm: string;
  roleFilter: string;
  statusFilter: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface UseUserFiltersActions {
  setSearchTerm: (term: string) => void;
  setRoleFilter: (role: string) => void;
  setStatusFilter: (status: string) => void;
  setSortBy: (field: string) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  handleSort: (field: string) => void;
  resetFilters: () => void;
}

export interface UseUserFiltersResult extends UseUserFiltersState, UseUserFiltersActions {
  filteredUsers: User[];
  filters: UserFilters;
}

export function useUserFilters(users: User[]): UseUserFiltersResult {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('username');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filters: UserFilters = useMemo(() => ({
    searchTerm: searchTerm || undefined,
    role: roleFilter === 'all' ? undefined : roleFilter as UserRole,
    status: statusFilter === 'all' ? undefined : statusFilter as 'active' | 'inactive',
  }), [searchTerm, roleFilter, statusFilter]);

  const filteredUsers = useMemo(() => {
    if (!users || !Array.isArray(users)) {
      return [];
    }
    const filtered = UserUtilsService.filterUsers(users, filters);
    return UserUtilsService.sortUsers(filtered, sortBy, sortOrder);
  }, [users, filters, sortBy, sortOrder]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setStatusFilter('all');
    setSortBy('username');
    setSortOrder('asc');
  };

  return {
    searchTerm,
    roleFilter,
    statusFilter,
    sortBy,
    sortOrder,
    filteredUsers,
    filters,
    setSearchTerm,
    setRoleFilter,
    setStatusFilter,
    setSortBy,
    setSortOrder,
    handleSort,
    resetFilters,
  };
}