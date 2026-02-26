"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchAPI } from "@/lib/query-client"
import type { UnitOfMeasurement } from "@/types/inventory"

const fetchUnits = async (): Promise<UnitOfMeasurement[]> => {
  return fetchAPI<UnitOfMeasurement[]>("/inventory/units")
}

const createUnit = async (data: Partial<UnitOfMeasurement>): Promise<UnitOfMeasurement> => {
  return fetchAPI<UnitOfMeasurement>("/inventory/units", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

const updateUnit = async ({ id, data }: { id: string; data: Partial<UnitOfMeasurement> }): Promise<UnitOfMeasurement> => {
  return fetchAPI<UnitOfMeasurement>(`/inventory/units/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

const deleteUnit = async (id: string): Promise<void> => {
  await fetchAPI<void>(`/inventory/units/${id}`, {
    method: "DELETE",
  })
}

export function useUnitsQuery() {
  return useQuery({
    queryKey: ["inventory", "units"],
    queryFn: fetchUnits,
    staleTime: 0,   // 5 minutes
    gcTime: 0,     // 10 minutes cache
    retry: 3,
  })
}

export function useCreateUnitMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "units"] })
    },
  })
}

export function useUpdateUnitMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "units"] })
    },
  })
}

export function useDeleteUnitMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "units"] })
    },
  })
}