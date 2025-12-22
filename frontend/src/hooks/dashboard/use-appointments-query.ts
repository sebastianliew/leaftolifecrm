"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { DashboardAppointment, AppointmentStatus } from '@/types/appointments'
import { api } from '@/lib/api-client'

const fetchAppointments = async (status?: AppointmentStatus | 'all'): Promise<DashboardAppointment[]> => {
  const params = status && status !== 'all' ? { status } : undefined
  const response = await api.get<DashboardAppointment[]>('/dashboard/appointments', params)
  
  if (!response.ok) {
    throw new Error(response.error || 'Failed to fetch appointments')
  }
  
  return response.data || []
}

const deleteAppointment = async (id: string): Promise<void> => {
  const response = await api.delete(`/dashboard/appointments/${id}`)
  
  if (!response.ok) {
    throw new Error(response.error || 'Failed to delete appointment')
  }
}

const bulkDeleteAppointments = async (appointmentIds: string[]): Promise<{ deletedCount: number; message: string }> => {
  const response = await api.post<{ deletedCount: number; message: string }>('/appointments/bulk-delete', { appointmentIds })
  
  if (!response.ok) {
    throw new Error(response.error || 'Failed to delete appointments')
  }
  
  return response.data || { deletedCount: 0, message: 'Failed' }
}


// Query hooks
export function useAppointmentsQuery(status?: AppointmentStatus | 'all') {
  return useQuery({
    queryKey: ['appointments', status],
    queryFn: () => fetchAppointments(status),
  })
}

export function useDeleteAppointmentMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}

export function useBulkDeleteAppointmentsMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: bulkDeleteAppointments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}

