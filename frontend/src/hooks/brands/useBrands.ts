"use client"

import { useState, useCallback } from "react"
import { api } from "@/lib/api-client"
import type { Brand, BrandFormData, BrandFilters } from "@/types/brands"

export function useBrands() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getCategories = useCallback(async () => {
    try {
      const response = await api.get('/categories')
      if (!response.ok) {
        console.error('Failed to fetch categories:', response.error)
        setError(response.error || 'Failed to fetch categories')
        setCategories([])
        return []
      }
      const data = (response.data as { id: string; name: string }[]) || []
      setCategories(data)
      return data
    } catch (err) {
      console.error('Error in getCategories:', err)
      setError('Failed to fetch categories')
      setCategories([])
      return []
    }
  }, [])

  const getBrands = useCallback(async (filters?: BrandFilters) => {
    console.log('🔵 getBrands called with filters:', filters)
    setLoading(true)
    try {
      // Add pagination params to show more results
      const params = { 
        ...filters,
        limit: 100, // Show up to 100 brands
        page: 1
      }
      const brandsResponse = await api.get('/brands', params)
      console.log('🔵 getBrands response:', brandsResponse)
      
      if (!brandsResponse.ok) {
        console.error('🔴 Failed to fetch brands:', brandsResponse.error)
        setError(brandsResponse.error || 'Failed to fetch brands')
        setBrands([])
        return []
      }

      // Backend returns { brands: [...], pagination: {...} }
      const rawData = (brandsResponse.data as { brands?: Brand[] }) || {};
      console.log('🔵 Raw brands data:', rawData)
      
      const brandsArray = rawData.brands || [];
      const brandsData = brandsArray.map((brand: Brand & { _id?: string }) => ({
        ...brand,
        id: brand._id || brand.id
      }))
      console.log('🟢 Processed brands data:', brandsData)
      
      setBrands(brandsData)
      setError(null)
      return brandsData
    } catch (err) {
      console.error('🔴 Error in getBrands:', err)
      setError('Failed to fetch brands')
      setBrands([])
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const getBrand = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const response = await api.get(`/brands/${id}`)
      if (!response.ok) {
        console.error('Failed to fetch brand:', response.error)
        setError(response.error || 'Failed to fetch brand')
        return null
      }
      setError(null)
      const brandData = response.data as Brand & { _id?: string }
      return {
        ...brandData,
        id: brandData._id || brandData.id
      }
    } catch (err) {
      console.error('Error in getBrand:', err)
      setError('Failed to fetch brand')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const createBrand = useCallback(async (data: BrandFormData) => {
    console.log('🔵 createBrand called with data:', data)
    setLoading(true)
    try {
      console.log('🔵 Sending POST request to /brands...')
      const response = await api.post('/brands', data)
      console.log('🔵 API response:', response)
      
      if (!response.ok) {
        console.error('🔴 API response not ok:', response.error)
        throw new Error(response.error || 'Failed to create brand')
      }
      
      const brandData = response.data as Brand & { _id?: string }
      const newBrand = {
        ...brandData,
        id: brandData._id || brandData.id
      }
      console.log('🟢 Created brand successfully:', newBrand)
      setBrands((prev) => [...prev, newBrand])
      setError(null)
      return newBrand
    } catch (error) {
      console.error('🔴 Error in createBrand:', error)
      const message = error instanceof Error ? error.message : 'Failed to create brand'
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateBrand = useCallback(async (id: string, data: Partial<BrandFormData>) => {
    setLoading(true)
    try {
      const response = await api.put(`/brands/${id}`, data)
      if (!response.ok) {
        throw new Error(response.error || 'Failed to update brand')
      }
      const brandData = response.data as Brand & { _id?: string }
      const updatedBrand = {
        ...brandData,
        id: brandData._id || brandData.id
      }
      setBrands((prev) => prev.map((brand) => brand.id === id ? updatedBrand : brand))
      setError(null)
      return updatedBrand
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update brand'
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteBrand = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const response = await api.delete(`/brands/${id}`)
      if (!response.ok) {
        throw new Error(response.error || 'Failed to delete brand')
      }
      setBrands((prev) => prev.filter((brand) => brand.id !== id))
      setError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete brand'
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    brands,
    categories,
    loading,
    error,
    getBrands,
    getBrand,
    createBrand,
    updateBrand,
    deleteBrand,
    getCategories,
  }
}