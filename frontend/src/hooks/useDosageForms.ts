"use client"

import { useState, useCallback } from "react"
import type { DosageForm } from "@/types/inventory"

export function useDosageForms() {
  const [dosageForms, setDosageForms] = useState<DosageForm[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getDosageForms = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/inventory/dosage-forms')
      if (!response.ok) {
        throw new Error('Failed to fetch dosage forms')
      }
      const data = await response.json()
      setDosageForms(data)
      setError(null)
      return data
    } catch (err) {
      setError("Failed to fetch dosage forms")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    dosageForms,
    loading,
    error,
    getDosageForms,
  }
} 