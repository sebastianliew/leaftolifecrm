"use client"

import { useState, useCallback, useRef } from "react"
import { api } from "@/lib/api-client"
import type { Patient, PatientFormData, PatientNotification } from "@/types/patient"

interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalCount: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
  nextPage: number | null
  prevPage: number | null
}

interface PatientResponse {
  patients: Patient[]
  pagination?: PaginationInfo
}

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [recentPatients, setRecentPatients] = useState<Patient[]>([])
  const searchCache = useRef<Map<string, { patients: Patient[], pagination?: PaginationInfo, timestamp: number }>>(new Map())
  const CACHE_DURATION = useRef(60 * 1000) // 60 seconds for better performance

  const getPatients = useCallback(async (search?: string, page: number = 1, limit: number = 25) => {
    const cacheKey = `${search || 'all'}_${page}_${limit}`
    
    // Check cache first
    const cached = searchCache.current.get(cacheKey)
    const isCacheValid = cached && Date.now() - cached.timestamp < CACHE_DURATION.current

    if (isCacheValid) {
      setPatients(cached.patients)
      setPagination(cached.pagination || null)
      return { patients: cached.patients, pagination: cached.pagination || null }
    }

    setLoading(true)
    try {
      const params: Record<string, string> = {
        page: page.toString(),
        limit: limit.toString(),
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }
      
      // Only add search if provided and has minimum length
      if (search && search.trim().length >= 2) {
        params.search = search.trim()
      }
      
      const response = await api.get('/patients', params)

      if (!response.ok) {
        throw new Error(response.error || `HTTP error! status: ${response.status}`)
      }

      // Handle paginated response and transform _id to id
      const responseData = response.data as PatientResponse
      const patientsList = (responseData?.patients || []).map((patient: Patient & { _id?: string }) => ({
        ...patient,
        id: patient._id || patient.id
      }))
      
      const paginationInfo = responseData?.pagination || null
      
      setPatients(patientsList)
      setPagination(paginationInfo)
      setError(null)

      // Cache the results
      searchCache.current.set(cacheKey, {
        patients: patientsList,
        pagination: paginationInfo || undefined,
        timestamp: Date.now()
      })

      return { patients: patientsList, pagination: paginationInfo }
    } catch (err) {
      setError("Failed to fetch patients")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const getPatient = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const response = await api.get(`/patients/${id}`)
      if (!response.ok) {
        throw new Error(response.error || "Patient not found")
      }
      setError(null)
      const patientData = response.data as Patient & { _id?: string }
      return {
        ...patientData,
        id: patientData._id || patientData.id
      }
    } catch (err) {
      setError("Failed to fetch patient")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const clearSearchCache = useCallback(() => {
    searchCache.current.clear()
  }, [])

  const createPatient = useCallback(async (data: PatientFormData): Promise<{ success: true; data: Patient } | { error: string }> => {
    setLoading(true)
    try {
      const response = await api.post('/patients', data)
      if (!response.ok) {
        // Return error object instead of throwing
        setError(response.error || "Failed to create patient")
        return { error: response.error || "Failed to create patient" }
      }
      const newPatient = response.data as Patient
      setPatients((prev) => [newPatient, ...prev])
      clearSearchCache() // Clear cache to force refresh
      setError(null)
      return { success: true, data: newPatient }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create patient"
      setError(errorMessage)
      return { error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [clearSearchCache])

  const updatePatient = useCallback(async (id: string, data: Partial<PatientFormData>) => {
    setLoading(true)
    try {
      const response = await api.put(`/patients/${id}`, data)
      if (!response.ok) {
        throw new Error(response.error || "Failed to update patient")
      }
      const updatedPatient = response.data as Patient
      setPatients((prev) =>
        prev.map((patient) => (patient.id === id ? updatedPatient : patient))
      )
      setError(null)
      return updatedPatient
    } catch (err) {
      setError("Failed to update patient")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const deletePatient = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const response = await api.delete(`/patients/${id}`)
      
      if (!response.ok) {
        throw new Error(response.error || `Failed to delete patient: ${response.status}`)
      }
      
      setPatients((prev) => prev.filter((patient) => patient.id !== id))
      setError(null)
    } catch (err) {
      setError("Failed to delete patient")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const searchPatients = useCallback(async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setPatients([])
      return []
    }

    // Check cache first
    const cached = searchCache.current.get(searchTerm)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION.current) {
      setPatients(cached.patients)
      return cached.patients
    }

    setSearchLoading(true)
    try {
      const params = {
        search: searchTerm,
        limit: '50',
      }
      const response = await api.get('/patients', params)
      const responseData = response.data as PatientResponse
      const patientsList = (responseData?.patients || responseData || []) as Patient[]
      setPatients(patientsList)
      
      // Cache the results
      searchCache.current.set(searchTerm, {
        patients: patientsList,
        timestamp: Date.now()
      })
      
      return patientsList
    } catch (err) {
      console.error("Failed to search patients:", err)
      setError("Failed to search patients")
      return []
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const getRecentPatients = useCallback(async () => {
    try {
      // Get recent patients from transactions
      const response = await api.get('/patients/recent', { limit: '10' })
      if (response.ok) {
        const responseData = response.data as PatientResponse
        const patientsList = (responseData?.patients || responseData || []).map((patient: Patient & { _id?: string }) => ({
          ...patient,
          id: patient._id || patient.id
        }))
        setRecentPatients(patientsList)
        return patientsList
      }
      return []
    } catch (err) {
      // Silently fail for recent patients
      console.error("Failed to get recent patients:", err)
      return []
    }
  }, [])

  return {
    patients,
    pagination,
    loading,
    searchLoading,
    error,
    recentPatients,
    getPatients,
    searchPatients,
    getRecentPatients,
    getPatient,
    getPatientById: getPatient, // Alias for compatibility
    createPatient,
    updatePatient,
    deletePatient,
    clearSearchCache,
  }
}

export function usePatientNotifications() {
  const [notifications, setNotifications] = useState<PatientNotification[]>([])

  const addNotification = useCallback((notification: Omit<PatientNotification, "id" | "createdAt">) => {
    const newNotification: PatientNotification = {
      ...notification,
      id: `notif_${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setNotifications((prev) => [newNotification, ...prev])
  }, [])

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif)))
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id))
  }, [])

  return {
    notifications,
    addNotification,
    markAsRead,
    removeNotification,
  }
}
