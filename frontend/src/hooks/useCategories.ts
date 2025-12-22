"use client"

import { useState, useCallback } from "react"
import { api } from "@/lib/api-client"
import type { ProductCategory } from "@/types/inventory/category.types"

export function useCategories() {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getCategories = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get('/inventory/categories')
      if (!response.ok) {
        console.error('Failed to fetch categories:', response.error)
        setError(response.error || 'Failed to fetch categories')
        setCategories([])
        return []
      }
      const data = (response.data as ProductCategory[]) || []
      setCategories(data)
      setError(null)
      return data
    } catch (err) {
      console.error('Error in getCategories:', err)
      setError("Failed to fetch categories")
      setCategories([])
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    categories,
    loading,
    error,
    getCategories,
  }
} 