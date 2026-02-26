import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAPI, queryKeys } from '@/lib/query-client';

// Units
interface Unit {
  _id: string;
  name: string;
  abbreviation: string;
  category?: string;
  conversionFactor?: number;
  baseUnit?: string;
}

export function useUnits() {
  return useQuery({
    queryKey: queryKeys.units,
    queryFn: () => fetchAPI<Unit[]>('/units'),
    staleTime: 0, // 10 minutes
  });
}

// Brands
interface Brand {
  _id: string;
  name: string;
  description?: string;
  active: boolean;
}

export function useBrands() {
  return useQuery({
    queryKey: queryKeys.brands,
    queryFn: async () => {
      const response = await fetchAPI<{brands: Brand[], pagination: { total: number, page: number, pages: number }}>('/brands?limit=100');
      return response.brands;
    },
    staleTime: 0,   // 5 minutes
    gcTime: 0,     // 10 minutes cache
    retry: 3,
  });
}

// Suppliers
interface Supplier {
  _id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  active: boolean;
}

export function useSuppliers() {
  return useQuery({
    queryKey: queryKeys.suppliers,
    queryFn: () => fetchAPI<Supplier[]>('/suppliers'),
    staleTime: 0, // 10 minutes
  });
}

// Container Types
interface ContainerType {
  _id: string;
  name: string;
  volume: number;
  unit: string;
  active: boolean;
}

export function useContainerTypes() {
  return useQuery({
    queryKey: queryKeys.containerTypes,
    queryFn: () => fetchAPI<ContainerType[]>('/container-types'),
    staleTime: 0, // 10 minutes
  });
}

// Dosage Forms
interface DosageForm {
  _id: string;
  name: string;
  description?: string;
  active: boolean;
}

export function useDosageForms() {
  return useQuery({
    queryKey: queryKeys.dosageForms,
    queryFn: () => fetchAPI<DosageForm[]>('/dosage-forms'),
    staleTime: 0, // 10 minutes
  });
}

// Users
interface UserPermissions {
  [key: string]: boolean | string | number | UserPermissions;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  permissions?: UserPermissions;
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: () => fetchAPI<User[]>('/users'),
  });
}

// Mutation hooks for common entities
export function useCreateBrand() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Brand>) => 
      fetchAPI<Brand>('/brands', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brands });
    },
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Brand> }) => 
      fetchAPI<Brand>(`/brands/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brands });
    },
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => 
      fetchAPI(`/brands/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brands });
    },
  });
}