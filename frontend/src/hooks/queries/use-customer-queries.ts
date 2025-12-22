"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

interface ReorderSuggestion {
  itemId: string
  itemName: string
  itemType: string
  lastPurchaseDate: string
  suggestedQuantity?: number
  isFavorite: boolean
  urgency: 'high' | 'medium' | 'low'
  isOverdue: boolean
  daysOverdue?: number
  daysUntilDue?: number
  itemDetails?: {
    inventory?: { currentStock: number }
    pricing?: { sellingPrice: number }
  }
}

interface ReorderSuggestionsResponse {
  suggestions: ReorderSuggestion[]
  summary?: {
    total: number
  }
}

interface CustomerFavorites {
  products?: Array<{ 
    _id: string
    name: string
    purchaseCount?: number
    lastPurchaseDate?: string
    itemType?: string
  }>
  blends?: Array<{
    _id: string
    name: string
    purchaseCount?: number
    lastPurchaseDate?: string
    itemType?: string
  }>
  customBlends?: Array<{
    _id: string
    blendName: string
    purchaseCount?: number
    lastPurchaseDate?: string
    itemType?: string
  }>
  bundles?: Array<{
    _id: string
    name: string
    purchaseCount?: number
    lastPurchaseDate?: string
    itemType?: string
  }>
}

const fetchReorderSuggestions = async (customerId: string, limit: number = 10): Promise<ReorderSuggestionsResponse> => {
  const response = await fetch(`/api/customers/${customerId}/reorder-suggestions?limit=${limit}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch reorder suggestions')
  }
  
  return response.json()
}

const fetchCustomerFavorites = async (customerId: string): Promise<CustomerFavorites> => {
  const response = await fetch(`/api/customers/${customerId}/favorites`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch customer favorites')
  }
  
  return response.json()
}

// Additional types for purchase history
interface PurchasePattern {
  _id: string
  itemId: string
  itemName: string
  itemType: string
  purchaseCount: number
  lastPurchaseDate: string
  totalSpent: number
  isFavorite: boolean
  averagePurchaseInterval?: string
}

interface PurchaseInsights {
  favorites: Array<{
    _id: string
    itemId: string
    itemName: string
    itemType: string
    purchaseCount: number
    averageOrderValue?: number
    nextExpectedPurchase?: string
  }>
  insights: {
    totalOrders: number
    averagePurchaseFrequency: number
    churnRisk: number
    topCategories: string[]
  }
}

interface CustomerPreferences {
  preferredPaymentMethod?: string
  preferredDeliveryTime?: string
  notes?: string
}

interface UpcomingReminder {
  _id: string
  itemName: string
  reminderDate: string
  status: string
}

interface PurchaseHistoryResponse {
  patterns: PurchasePattern[]
  insights: PurchaseInsights
  preferences: CustomerPreferences | null
  upcomingReminders: UpcomingReminder[]
}

const fetchPurchaseHistory = async (customerId: string, includeInsights: boolean = true): Promise<PurchaseHistoryResponse> => {
  const response = await fetch(`/api/customers/${customerId}/purchase-history?includeInsights=${includeInsights}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch purchase history')
  }
  
  return response.json()
}

const toggleFavorite = async (customerId: string, itemId: string, itemType: string, action: 'add' | 'remove'): Promise<void> => {
  const response = await fetch(`/api/customers/${customerId}/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, itemType, action })
  })
  
  if (!response.ok) {
    throw new Error('Failed to update favorite')
  }
}

const createQuickReorder = async (transactionId: string, customerId: string, createDraft: boolean = true) => {
  const response = await fetch('/api/transactions/quick-reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionId, customerId, createDraft })
  })
  
  if (!response.ok) {
    throw new Error('Failed to create reorder')
  }
  
  return response.json()
}

// Query hooks
export function useReorderSuggestionsQuery(customerId: string | null, limit?: number) {
  return useQuery({
    queryKey: ['customers', customerId, 'reorder-suggestions', limit],
    queryFn: () => fetchReorderSuggestions(customerId!, limit),
    enabled: !!customerId,
  })
}

export function useCustomerFavoritesQuery(customerId: string | null) {
  return useQuery({
    queryKey: ['customers', customerId, 'favorites'],
    queryFn: () => fetchCustomerFavorites(customerId!),
    enabled: !!customerId,
  })
}

export function usePurchaseHistoryQuery(customerId: string | null, includeInsights?: boolean) {
  return useQuery({
    queryKey: ['customers', customerId, 'purchase-history', includeInsights],
    queryFn: () => fetchPurchaseHistory(customerId!, includeInsights),
    enabled: !!customerId,
  })
}

// Mutation hooks
export function useToggleFavoriteMutation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ customerId, itemId, itemType, action }: { 
      customerId: string
      itemId: string
      itemType: string
      action: 'add' | 'remove'
    }) => toggleFavorite(customerId, itemId, itemType, action),
    onSuccess: (_data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['customers', variables.customerId, 'purchase-history'] })
      queryClient.invalidateQueries({ queryKey: ['customers', variables.customerId, 'favorites'] })
    },
  })
}

export function useQuickReorderMutation() {
  return useMutation({
    mutationFn: ({ transactionId, customerId, createDraft }: {
      transactionId: string
      customerId: string
      createDraft?: boolean
    }) => createQuickReorder(transactionId, customerId, createDraft),
  })
}