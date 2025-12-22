"use client"

import { useState, useCallback } from 'react';

export interface CrudHookConfig<T> {
  endpoint: string
  resourceName: string
  // Optional ID field name if different from 'id' or '_id'
  idField?: string
  // Optional transform for API responses
  transformResponse?: (data: unknown) => T
  // Optional method to handle additional operations when fetching all items
  onGetAllSuccess?: (data: T[]) => void
  // Optional additional headers for requests
  getHeaders?: () => Record<string, string>
}

export interface CrudHookResult<T, TFormData> {
  items: T[]
  loading: boolean
  error: string | null
  getAll: () => Promise<T[]>
  getById: (id: string) => Promise<T>
  create: (data: TFormData) => Promise<T>
  update: (id: string, data: Partial<TFormData>) => Promise<T>
  remove: (id: string) => Promise<void>
  setItems: React.Dispatch<React.SetStateAction<T[]>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

export function useGenericCrud<T extends { id?: string; _id?: string }, TFormData = Partial<T>>({
  endpoint,
  resourceName,
  idField = 'id',
  transformResponse = (data: unknown) => data as T,
  onGetAllSuccess,
  getHeaders = () => ({ 'Content-Type': 'application/json' })
}: CrudHookConfig<T>): CrudHookResult<T, TFormData> {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Helper to get the ID from an item
  const getItemId = useCallback((item: T): string => {
    const id = item[idField as keyof T] || item._id || item.id
    return typeof id === 'object' ? String(id) : String(id)
  }, [idField])

  const getAll = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(endpoint, {
        headers: getHeaders()
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch ${resourceName}s`)
      }
      const data = await response.json()
      const transformedData = Array.isArray(data) 
        ? data.map(transformResponse)
        : [transformResponse(data)]
      
      setItems(transformedData)
      setError(null)
      
      // Call optional success handler
      if (onGetAllSuccess) {
        onGetAllSuccess(transformedData)
      }
      
      return transformedData
    } catch {
      const errorMessage = `Failed to fetch ${resourceName}s`
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [endpoint, resourceName, transformResponse, onGetAllSuccess, getHeaders])

  const getById = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const response = await fetch(`${endpoint}/${id}`, {
        headers: getHeaders()
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch ${resourceName}`)
      }
      const data = await response.json()
      const transformedData = transformResponse(data)
      setError(null)
      return transformedData
    } catch {
      const errorMessage = `Failed to fetch ${resourceName}`
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [endpoint, resourceName, transformResponse, getHeaders])

  const create = useCallback(async (data: TFormData) => {
    setLoading(true)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        throw new Error(`Failed to create ${resourceName}`)
      }
      const newItem = transformResponse(await response.json())
      setItems((prev) => [...prev, newItem])
      setError(null)
      return newItem
    } catch {
      const errorMessage = `Failed to create ${resourceName}`
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [endpoint, resourceName, transformResponse, getHeaders])

  const update = useCallback(async (id: string, data: Partial<TFormData>) => {
    setLoading(true)
    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        throw new Error(`Failed to update ${resourceName}`)
      }
      const updatedItem = transformResponse(await response.json())
      setItems((prev) => 
        prev.map((item) => getItemId(item) === id ? updatedItem : item)
      )
      setError(null)
      return updatedItem
    } catch {
      const errorMessage = `Failed to update ${resourceName}`
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [endpoint, resourceName, transformResponse, getHeaders, getItemId])

  const remove = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      })
      if (!response.ok) {
        throw new Error(`Failed to delete ${resourceName}`)
      }
      setItems((prev) => prev.filter((item) => getItemId(item) !== id))
      setError(null)
    } catch {
      const errorMessage = `Failed to delete ${resourceName}`
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [endpoint, resourceName, getHeaders, getItemId])

  return {
    items,
    loading,
    error,
    getAll,
    getById,
    create,
    update,
    remove,
    setItems,
    setError
  }
}