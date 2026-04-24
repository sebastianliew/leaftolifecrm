"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { containerTypesService } from "@/services/api/container-types.service"
import type {
  CreateContainerTypeRequest,
  UpdateContainerTypeRequest,
  ContainerTypeFilters,
} from "@/types/inventory/container-type.types"

const STALE_TIME = 5 * 60 * 1000
const GC_TIME = 10 * 60 * 1000

export function useContainerTypesQuery(filters?: ContainerTypeFilters) {
  return useQuery({
    queryKey: ['inventory', 'containerTypes', filters],
    queryFn: () => containerTypesService.getContainerTypes(filters),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 3,
  })
}

export function useContainerTypeQuery(id: string) {
  return useQuery({
    queryKey: ['inventory', 'containerTypes', id],
    queryFn: () => containerTypesService.getContainerTypeById(id),
    enabled: !!id,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 3,
  })
}

export function useCreateContainerTypeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateContainerTypeRequest) => containerTypesService.createContainerType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'containerTypes'] })
    },
    onError: (error) => {
      console.error('Create container type mutation error:', error)
    },
  })
}

export function useUpdateContainerTypeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateContainerTypeRequest) => containerTypesService.updateContainerType(data),
    onSuccess: (data) => {
      queryClient.setQueryData(['inventory', 'containerTypes', data.id], data)
      queryClient.invalidateQueries({ queryKey: ['inventory', 'containerTypes'] })
    },
    onError: (error) => {
      console.error('Update container type mutation error:', error)
    },
  })
}

export function useDeleteContainerTypeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => containerTypesService.deleteContainerType(id),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: ['inventory', 'containerTypes', deletedId] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'containerTypes'] })
    },
    onError: (error) => {
      console.error('Delete container type mutation error:', error)
    },
  })
}
