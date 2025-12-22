"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { ContainerType } from "@/types/container"

const fetchContainerTypes = async (): Promise<ContainerType[]> => {
  const response = await api.get("/container-types")
  if (!response.ok) {
    throw new Error(response.error || "Failed to fetch container types")
  }
  return response.data as ContainerType[]
}

const createContainerType = async (data: Partial<ContainerType>): Promise<ContainerType> => {
  const response = await api.post("/container-types", data)
  if (!response.ok) {
    throw new Error(response.error || "Failed to create container type")
  }
  return response.data as ContainerType
}

const updateContainerType = async ({ id, data }: { id: string; data: Partial<ContainerType> }): Promise<ContainerType> => {
  const response = await api.put(`/container-types/${id}`, data)
  if (!response.ok) {
    throw new Error(response.error || "Failed to update container type")
  }
  return response.data as ContainerType
}

const deleteContainerType = async (id: string): Promise<void> => {
  const response = await api.delete(`/container-types/${id}`)
  if (!response.ok) {
    throw new Error(response.error || "Failed to delete container type")
  }
}

export function useContainerTypesQuery() {
  return useQuery({
    queryKey: ["container-types"],
    queryFn: fetchContainerTypes,
  })
}

export function useCreateContainerTypeMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createContainerType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["container-types"] })
    },
  })
}

export function useUpdateContainerTypeMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateContainerType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["container-types"] })
    },
  })
}

export function useDeleteContainerTypeMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteContainerType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["container-types"] })
    },
  })
}