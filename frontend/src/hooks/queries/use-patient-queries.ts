import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  address?: string;
  medicalHistory?: string;
  allergies?: string;
  currentMedications?: string;
  emergencyContact?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function usePatients() {
  return useQuery({
    queryKey: queryKeys.patients,
    queryFn: async () => {
      const response = await api.get('/patients', {
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch patients');
      }
      const data = response.data as { patients?: Patient[] } | Patient[];
      return Array.isArray(data) ? data : (data?.patients || []);
    },
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: queryKeys.patient(id),
    queryFn: async () => {
      const response = await api.get(`/patients/${id}`);
      if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch patient');
      }
      return response.data as Patient;
    },
    enabled: !!id,
  });
}

export function usePatientSearch(search: string) {
  return useQuery({
    queryKey: queryKeys.patientSearch(search),
    queryFn: async () => {
      const response = await api.get('/patients', { search });
      if (!response.ok) {
        throw new Error(response.error || 'Failed to search patients');
      }
      const data = response.data as { patients?: Patient[] } | Patient[];
      return Array.isArray(data) ? data : (data?.patients || []);
    },
    enabled: search.length > 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useRecentPatients() {
  return useQuery({
    queryKey: queryKeys.recentPatients,
    queryFn: async () => {
      const response = await api.get('/patients/recent');
      if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch recent patients');
      }
      const data = response.data as { patients?: Patient[] } | Patient[];
      return Array.isArray(data) ? data : (data?.patients || []);
    },
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<Patient>) => {
      const response = await api.post('/patients', data);
      if (!response.ok) {
        throw new Error(response.error || 'Failed to create patient');
      }
      return response.data as Patient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentPatients });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Patient> }) => {
      const response = await api.put(`/patients/${id}`, data);
      if (!response.ok) {
        throw new Error(response.error || 'Failed to update patient');
      }
      return response.data as Patient;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patient(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
    },
  });
}

export function useDeletePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/patients/${id}`);
      if (!response.ok) {
        throw new Error(response.error || 'Failed to delete patient');
      }
      return response.data as void;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
    },
  });
}