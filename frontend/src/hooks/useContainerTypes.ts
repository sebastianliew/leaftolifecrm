"use client"

import { useState, useCallback } from "react"
import { apiClient } from "@/lib/api-client"
import type { ContainerType } from "@/types/container"

export function useContainerTypes() {
  const [containerTypes, setContainerTypes] = useState<ContainerType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getContainerTypes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get("/container-types")
      if (!response.ok) {
        throw new Error(response.error || "Failed to fetch container types")
      }
      setContainerTypes(response.data as ContainerType[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [])

  const createContainerType = useCallback(async (data: Partial<ContainerType>) => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.post("/container-types", data)
      if (!response.ok) {
        throw new Error(response.error || "Failed to create container type")
      }
      const newContainerType = response.data as ContainerType
      setContainerTypes((prev) => [...prev, newContainerType])
      return newContainerType
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateContainerType = useCallback(async (id: string, data: Partial<ContainerType>) => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.put(`/container-types/${id}`, data)
      if (!response.ok) {
        throw new Error(response.error || "Failed to update container type")
      }
      const updatedContainerType = response.data as ContainerType
      setContainerTypes((prev) =>
        prev.map((type) => (type.id === id ? updatedContainerType : type))
      )
      return updatedContainerType
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])



  const deleteContainerType = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.delete(`/container-types/${id}`)
      if (!response.ok) {
        throw new Error(response.error || "Failed to delete container type")
      }
      setContainerTypes((prev) => prev.filter((type) => type.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    containerTypes,
    loading,
    error,
    getContainerTypes,
    createContainerType,
    updateContainerType,
    deleteContainerType,
  }
} 