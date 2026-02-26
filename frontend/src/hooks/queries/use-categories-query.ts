"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { categoriesService } from "@/services/api/categories.service"
import type { 
  CreateCategoryRequest, 
  UpdateCategoryRequest,
  CategoryFilters,
  CategorySort 
} from "@/types/inventory/category.types"

// Cache timing — categories rarely change, mutations invalidate automatically
const STALE_TIME = 5 * 60 * 1000   // 5 minutes
const GC_TIME = 10 * 60 * 1000     // 10 minutes

// Query hooks
export function useCategoriesQuery(filters?: CategoryFilters, sort?: CategorySort) {
  return useQuery({
    queryKey: ['inventory', 'categories', filters, sort],
    queryFn: () => categoriesService.getCategories(filters, sort),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 3,
  })
}

export function useCategoryQuery(id: string) {
  return useQuery({
    queryKey: ['inventory', 'categories', id],
    queryFn: () => categoriesService.getCategoryById(id),
    enabled: !!id,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 3,
  })
}

export function useRootCategoriesQuery() {
  return useQuery({
    queryKey: ['inventory', 'categories', 'root'],
    queryFn: () => categoriesService.getRootCategories(),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 3,
  })
}

// Mutation hooks
export function useCreateCategoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCategoryRequest) => categoriesService.createCategory(data),
    onSuccess: () => {
      // Invalidate triggers automatic refetch - no need for removeQueries or manual refetch
      queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] })
    },
    onError: (error) => {
      console.error('Create category mutation error:', error)
    },
  })
}

export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: UpdateCategoryRequest) => categoriesService.updateCategory(data),
    onSuccess: (data) => {
      // Update specific category in cache
      queryClient.setQueryData(['inventory', 'categories', data.id], data)
      // Invalidate all category queries
      queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] })
    },
    onError: (error) => {
      console.error('Update category mutation error:', error)
    },
  })
}

export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => categoriesService.deleteCategory(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: ['inventory', 'categories', deletedId] })
      // Invalidate all category queries
      queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] })
    },
    onError: (error) => {
      console.error('Delete category mutation error:', error)
    },
  })
}