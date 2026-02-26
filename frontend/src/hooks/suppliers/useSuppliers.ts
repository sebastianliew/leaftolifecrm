"use client"

import { useState, useCallback } from "react"
import type { Supplier, SupplierFormData } from "@/types/suppliers/supplier.types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getAuthToken = () => {
    return typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
  }

  const getSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/suppliers`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      })
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers')
      }
      const data = await response.json()
      setSuppliers(data)
      setError(null)
      return data
    } catch (err) {
      setError("Failed to fetch suppliers")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const getSupplier = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/suppliers/${id}`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      })
      if (!response.ok) {
        throw new Error('Failed to fetch supplier')
      }
      const data = await response.json()
      setError(null)
      return data
    } catch (err) {
      setError("Failed to fetch supplier")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const createSupplier = useCallback(async (data: SupplierFormData) => {
    setLoading(true)
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/suppliers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        throw new Error('Failed to create supplier')
      }
      const newSupplier = await response.json()
      setSuppliers((prev) => [...prev, newSupplier])
      setError(null)
      return newSupplier
    } catch (err) {
      setError("Failed to create supplier")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateSupplier = useCallback(async (id: string, data: Partial<SupplierFormData>) => {
    setLoading(true)
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/suppliers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        throw new Error('Failed to update supplier')
      }
      const updatedSupplier = await response.json()
      setSuppliers((prev) =>
        prev.map((supplier) => (supplier.id === id ? updatedSupplier : supplier))
      )
      setError(null)
      return updatedSupplier
    } catch (err) {
      setError("Failed to update supplier")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteSupplier = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/suppliers/${id}`, {
        method: 'DELETE',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      })
      if (!response.ok) {
        throw new Error('Failed to delete supplier')
      }
      setSuppliers((prev) => prev.filter((supplier) => supplier.id !== id))
      setError(null)
    } catch (err) {
      setError("Failed to delete supplier")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    suppliers,
    loading,
    error,
    getSuppliers,
    getSupplier,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  }
}
