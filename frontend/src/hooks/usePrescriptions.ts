import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Prescription, PrescriptionFormData, RemedyTemplate } from '@/types/prescription'

interface UsePrescriptionsOptions {
  patientId?: string
}

export const usePrescriptions = (_options: UsePrescriptionsOptions = {}) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [remedyTemplates, setRemedyTemplates] = useState<RemedyTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mock data - in a real app, this would come from an API
  const mockRemedyTemplates = useMemo((): RemedyTemplate[] => [
    {
      id: '1',
      name: 'Flea seeds',
      category: 'herb',
      defaultDosage: '1 tbsp + 2-3 lime juice, warm',
      commonInstructions: ['Take with warm water', 'Take on empty stomach'],
      isActive: true
    },
    {
      id: '2',
      name: 'Herb Tincture',
      category: 'tincture',
      defaultDosage: '5d (0.5-1 cup water)',
      commonInstructions: ['Dilute in water', 'Take as directed'],
      isActive: true
    },
    {
      id: '3',
      name: 'Echinacea Premium',
      category: 'supplement',
      defaultDosage: '2 tablets',
      commonInstructions: ['Take with food', 'Take as directed'],
      isActive: true
    },
    {
      id: '4',
      name: 'Bacto Capa-GI',
      category: 'probiotic',
      defaultDosage: '1 capsule',
      commonInstructions: ['Take with food', 'Store in refrigerator'],
      isActive: true
    },
    {
      id: '5',
      name: 'Cleavers Complex',
      category: 'herb',
      defaultDosage: '2 tablets',
      commonInstructions: ['Take as directed', 'Can finish can pause'],
      isActive: true
    },
    {
      id: '6',
      name: 'Flaxseed oil',
      category: 'supplement',
      defaultDosage: '1 tbsp',
      commonInstructions: ['Take with food', 'Store in refrigerator'],
      isActive: true
    },
    {
      id: '7',
      name: 'Zinc Powder',
      category: 'supplement',
      defaultDosage: '1s',
      commonInstructions: ['Take on empty stomach', 'Take with water'],
      isActive: true
    },
    {
      id: '8',
      name: 'B De-stress',
      category: 'supplement',
      defaultDosage: '1 tablet',
      commonInstructions: ['Take with breakfast', 'Take with food'],
      isActive: true
    },
    {
      id: '9',
      name: 'Lipo-C',
      category: 'supplement',
      defaultDosage: '1tsp',
      commonInstructions: ['Take 3 times daily', 'Take with meals'],
      isActive: true
    },
    {
      id: '10',
      name: 'Spore Renew',
      category: 'probiotic',
      defaultDosage: '1 capsule',
      commonInstructions: ['Take as directed', 'Take with food'],
      isActive: true
    },
    {
      id: '11',
      name: 'Qcetin',
      category: 'supplement',
      defaultDosage: '2 tablets',
      commonInstructions: ['Take as directed', 'Take with food'],
      isActive: true
    },
    {
      id: '12',
      name: 'Phyto-GIH (heal the gut)',
      category: 'herb',
      defaultDosage: '1s',
      commonInstructions: ['Take as directed', 'Heal the gut'],
      isActive: true
    },
    {
      id: '13',
      name: 'Probiotics',
      category: 'probiotic',
      defaultDosage: '2 capsules',
      commonInstructions: ['Take daily', 'Store in refrigerator'],
      isActive: true
    },
    {
      id: '14',
      name: 'Zyme 2',
      category: 'supplement',
      defaultDosage: '1-2 tablets',
      commonInstructions: ['Take with meals', 'As necessary'],
      isActive: true
    }
  ], [])

  // Fetch prescriptions
  const fetchPrescriptions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // In a real app, this would be an API call
      // const response = await fetch(`/api/prescriptions${options.patientId ? `?patientId=${options.patientId}` : ''}`)
      // const data = await response.json()
      // setPrescriptions(data)
      
      // Mock data for now
      setPrescriptions([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prescriptions')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch remedy templates
  const fetchRemedyTemplates = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // In a real app, this would be an API call
      // const response = await fetch('/api/remedy-templates')
      // const data = await response.json()
      // setRemedyTemplates(data)
      
      // Mock data for now
      setRemedyTemplates(mockRemedyTemplates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch remedy templates')
    } finally {
      setLoading(false)
    }
  }, [mockRemedyTemplates])

  // Create prescription
  const createPrescription = useCallback(async (prescriptionData: PrescriptionFormData): Promise<Prescription> => {
    try {
      setLoading(true)
      setError(null)
      
      // In a real app, this would be an API call
      // const response = await fetch('/api/prescriptions', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(prescriptionData)
      // })
      // const newPrescription = await response.json()
      
      // Mock implementation
      const newPrescription: Prescription = {
        ...prescriptionData,
        id: `prescription-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      setPrescriptions(prev => [...prev, newPrescription])
      return newPrescription
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create prescription'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  // Update prescription
  const updatePrescription = useCallback(async (id: string, prescriptionData: Partial<PrescriptionFormData>): Promise<Prescription> => {
    try {
      setLoading(true)
      setError(null)
      
      // In a real app, this would be an API call
      // const response = await fetch(`/api/prescriptions/${id}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(prescriptionData)
      // })
      // const updatedPrescription = await response.json()
      
      // Mock implementation
      const updatedPrescription: Prescription = {
        ...prescriptions.find(p => p.id === id)!,
        ...prescriptionData,
        updatedAt: new Date().toISOString()
      }
      
      setPrescriptions(prev => prev.map(p => p.id === id ? updatedPrescription : p))
      return updatedPrescription
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update prescription'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [prescriptions])

  // Delete prescription
  const deletePrescription = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      
      // In a real app, this would be an API call
      // await fetch(`/api/prescriptions/${id}`, { method: 'DELETE' })
      
      // Mock implementation
      setPrescriptions(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete prescription'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  // Get prescription by ID
  const getPrescriptionById = useCallback((id: string): Prescription | undefined => {
    return prescriptions.find(p => p.id === id)
  }, [prescriptions])

  // Initialize data
  useEffect(() => {
    fetchPrescriptions()
    fetchRemedyTemplates()
  }, [fetchPrescriptions, fetchRemedyTemplates])

  return {
    prescriptions,
    remedyTemplates,
    loading,
    error,
    fetchPrescriptions,
    fetchRemedyTemplates,
    createPrescription,
    updatePrescription,
    deletePrescription,
    getPrescriptionById
  }
} 