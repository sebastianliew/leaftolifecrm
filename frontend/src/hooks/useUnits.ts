"use client"

import { useState, useCallback } from "react"
import { api } from '@/lib/api-client'
import type { UnitOfMeasurement } from "@/types/inventory"

export function useUnits() {
  const [units, setUnits] = useState<UnitOfMeasurement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getUnits = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get("/inventory/units")
      if (!response.ok) {
        throw new Error(response.error || "Failed to fetch units")
      }
      setUnits((response.data as UnitOfMeasurement[]) || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [])

  const createUnit = useCallback(async (data: Partial<UnitOfMeasurement>) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post("/inventory/units", data)
      if (!response.ok) {
        throw new Error(response.error || "Failed to create unit")
      }
      const newUnit = response.data as UnitOfMeasurement
      setUnits((prev) => [...prev, newUnit])
      return newUnit
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateUnit = useCallback(async (id: string, data: Partial<UnitOfMeasurement>) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.put(`/inventory/units/${id}`, data)
      if (!response.ok) {
        throw new Error(response.error || "Failed to update unit")
      }
      const updatedUnit = response.data as UnitOfMeasurement
      setUnits((prev) =>
        prev.map((unit) => (unit.id === id || unit._id === id ? updatedUnit : unit))
      )
      return updatedUnit
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteUnit = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.delete(`/inventory/units/${id}`)
      if (!response.ok) {
        throw new Error(response.error || "Failed to delete unit")
      }
      setUnits((prev) => prev.filter((unit) => unit.id !== id && unit._id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    units,
    loading,
    error,
    getUnits,
    createUnit,
    updateUnit,
    deleteUnit,
  }
} 