"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from '@/lib/api-client'
import type { 
  Bundle, 
  BundleFormData, 
  BundleFilters, 
  BundleAvailability,
  BundlePricingCalculation,
  BundleStats,
  BundleProduct
} from '@/types/bundle'
import type { PaginationResult } from '@/lib/pagination'

// Fetch functions
const fetchBundles = async (filters: BundleFilters = {}, page = 1, limit = 20): Promise<PaginationResult<Bundle>> => {
  const params: Record<string, string> = {}
  
  if (filters.category) params.category = filters.category
  if (filters.isActive !== undefined) params.isActive = filters.isActive.toString()
  if (filters.isPromoted !== undefined) params.isPromoted = filters.isPromoted.toString()
  if (filters.minPrice !== undefined) params.minPrice = filters.minPrice.toString()
  if (filters.maxPrice !== undefined) params.maxPrice = filters.maxPrice.toString()
  if (filters.minSavings !== undefined) params.minSavings = filters.minSavings.toString()
  if (filters.search) params.search = filters.search
  if (filters.sortBy) params.sortBy = filters.sortBy
  if (filters.sortOrder) params.sortOrder = filters.sortOrder
  if (filters.tags && filters.tags.length > 0) params.tags = filters.tags.join(',')
  
  params.page = page.toString()
  params.limit = limit.toString()
  
  const response = await api.get('/bundles', params)
  if (!response.ok) throw new Error(`Failed to fetch bundles: ${response.error}`)
  
  return response.data as PaginationResult<Bundle>
}

const fetchBundleById = async (id: string): Promise<Bundle> => {
  const response = await api.get(`/bundles/${id}`)
  if (!response.ok) {
    if (response.status === 404) throw new Error('Bundle not found')
    throw new Error(`Failed to fetch bundle: ${response.error}`)
  }
  return response.data as Bundle
}

const createBundle = async (data: BundleFormData): Promise<Bundle> => {
  const response = await api.post('/bundles', data)
  
  if (!response.ok) {
    throw new Error(response.error || 'Failed to create bundle')
  }
  
  return response.data as Bundle
}

const updateBundle = async ({ id, data }: { id: string; data: Partial<BundleFormData> }): Promise<Bundle> => {
  const response = await api.put(`/bundles/${id}`, data)
  
  if (!response.ok) {
    throw new Error(response.error || 'Failed to update bundle')
  }
  
  return response.data as Bundle
}

const deleteBundle = async (id: string): Promise<void> => {
  const response = await api.delete(`/bundles/${id}`)
  
  if (!response.ok) {
    throw new Error(response.error || 'Failed to delete bundle')
  }
}

const checkBundleAvailability = async (bundleId: string, quantity = 1): Promise<BundleAvailability> => {
  const response = await api.get(`/bundles/${bundleId}/availability`, { quantity: quantity.toString() })
  if (!response.ok) throw new Error(`Failed to check availability: ${response.error}`)
  return response.data as BundleAvailability
}

const calculateBundlePricing = async ({ bundleProducts, bundlePrice }: { bundleProducts: BundleProduct[]; bundlePrice: number }): Promise<BundlePricingCalculation> => {
  const response = await api.post('/bundles/calculate-pricing', { bundleProducts, bundlePrice })
  
  if (!response.ok) throw new Error(`Failed to calculate pricing: ${response.error}`)
  return response.data as BundlePricingCalculation
}

const fetchBundleCategories = async (): Promise<string[]> => {
  const response = await api.get('/bundles/categories')
  if (!response.ok) throw new Error('Failed to fetch categories')
  return (response.data as { categories?: string[] }).categories || []
}

const fetchPopularBundles = async (limit = 10): Promise<Bundle[]> => {
  const response = await api.get('/bundles/popular', { limit: limit.toString() })
  if (!response.ok) throw new Error('Failed to fetch popular bundles')
  return (response.data as { bundles?: Bundle[] }).bundles || []
}

const fetchPromotedBundles = async (): Promise<Bundle[]> => {
  const response = await api.get('/bundles/promoted')
  if (!response.ok) throw new Error('Failed to fetch promoted bundles')
  return (response.data as { bundles?: Bundle[] }).bundles || []
}

const fetchBundleStats = async (): Promise<BundleStats> => {
  const response = await api.get('/bundles/stats')
  if (!response.ok) throw new Error('Failed to fetch bundle stats')
  return (response.data as { stats: BundleStats }).stats
}

// Query hooks
export function useBundlesQuery(filters: BundleFilters = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['bundles', filters, page, limit],
    queryFn: () => fetchBundles(filters, page, limit),
  })
}

export function useBundleQuery(id: string) {
  return useQuery({
    queryKey: ['bundles', id],
    queryFn: () => fetchBundleById(id),
    enabled: !!id,
  })
}

export function useBundleCategoriesQuery() {
  return useQuery({
    queryKey: ['bundles', 'categories'],
    queryFn: fetchBundleCategories,
  })
}

export function usePopularBundlesQuery(limit = 10) {
  return useQuery({
    queryKey: ['bundles', 'popular', limit],
    queryFn: () => fetchPopularBundles(limit),
  })
}

export function usePromotedBundlesQuery() {
  return useQuery({
    queryKey: ['bundles', 'promoted'],
    queryFn: fetchPromotedBundles,
  })
}

export function useBundleStatsQuery() {
  return useQuery({
    queryKey: ['bundles', 'stats'],
    queryFn: fetchBundleStats,
  })
}

export function useBundleAvailabilityQuery(bundleId: string, quantity = 1) {
  return useQuery({
    queryKey: ['bundles', bundleId, 'availability', quantity],
    queryFn: () => checkBundleAvailability(bundleId, quantity),
    enabled: !!bundleId,
  })
}

// Mutation hooks
export function useCreateBundleMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createBundle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
    },
  })
}

export function useUpdateBundleMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateBundle,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
      queryClient.invalidateQueries({ queryKey: ['bundles', variables.id] })
    },
  })
}

export function useDeleteBundleMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteBundle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] })
    },
  })
}

export function useCalculateBundlePricingMutation() {
  return useMutation({
    mutationFn: calculateBundlePricing,
  })
}