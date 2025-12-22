"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { DashboardAppointment, AppointmentStatus } from '@/types/appointments'

const fetchAppointments = async (status?: AppointmentStatus | 'all'): Promise<DashboardAppointment[]> => {
  const url = !status || status === 'all'
    ? '/api/dashboard/appointments'
    : `/api/dashboard/appointments?status=${status}`
  
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch appointments')
  }
  
  return response.json()
}

const deleteAppointment = async (id: string): Promise<void> => {
  const response = await fetch(`/api/dashboard/appointments/${id}`, {
    method: 'DELETE',
  })
  
  if (!response.ok) {
    throw new Error('Failed to delete appointment')
  }
}

const bulkDeleteAppointments = async (appointmentIds: string[]): Promise<{ deletedCount: number; message: string }> => {
  const response = await fetch('/api/appointments/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointmentIds })
  })
  
  if (!response.ok) {
    throw new Error('Failed to delete appointments')
  }
  
  return response.json()
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

