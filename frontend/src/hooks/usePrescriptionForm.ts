import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import type { Prescription, PrescriptionSpecialInstruction } from '@/types/prescription'
import type { Patient } from '@/types/patient'
import type { MedicalPhoto } from '@/components/patients/prescription/MedicalPhotos'

interface UsePrescriptionFormProps {
  patient: Patient
  prescription?: Prescription
  onSave?: (prescription: Prescription) => void
}

interface RemedyRow {
  id: string
  name: string
}

export function usePrescriptionForm({ patient, prescription, onSave }: UsePrescriptionFormProps) {
  // Initialize prescription
  const initializePrescription = (): Prescription => {
    if (prescription) {
      return prescription
    }
    
    // Try to load from localStorage
    try {
      const storageKey = `prescription-${patient.id}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load saved prescription:', error)
    }
    
    // Return default prescription
    return {
      id: '',
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      practitionerName: 'Sebastian Liew, ND, MNHAA, MHS (UEA)',
      practitionerCredentials: 'ND, MNHAA, MHS (UEA)',
      date: format(new Date(), 'dd-MMM-yyyy'),
      dailySchedule: {
        breakfast: { before: [], during: [], after: [] },
        lunch: { before: [], during: [], after: [] },
        dinner: { before: [], during: [], after: [] }
      },
      specialInstructions: [],
      dietaryAdvice: [],
      lifestyleAdvice: [],
      status: 'draft',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'current-user'
    }
  }

  // State management
  const [currentPrescription, setCurrentPrescription] = useState<Prescription>(initializePrescription())
  const [editMode, setEditMode] = useState(!prescription)
  
  // Remedy rows state
  const [remedyRows, setRemedyRows] = useState<RemedyRow[]>(() => {
    try {
      const storageKey = `prescription-rows-${patient.id}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load saved rows:', error)
    }
    return []
  })

  // Row data state
  const [rowData, setRowData] = useState<Record<string, string>>(() => {
    try {
      const storageKey = `prescription-rowdata-${patient.id}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load saved row data:', error)
    }
    return {}
  })

  // Medical photos state
  const [medicalPhotos, setMedicalPhotos] = useState<MedicalPhoto[]>(() => {
    try {
      const storageKey = `prescription-photos-${patient.id}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load saved photos:', error)
    }
    return []
  })

  // Save to localStorage
  const saveToLocalStorage = useCallback(() => {
    try {
      localStorage.setItem(`prescription-${patient.id}`, JSON.stringify(currentPrescription))
      localStorage.setItem(`prescription-rows-${patient.id}`, JSON.stringify(remedyRows))
      localStorage.setItem(`prescription-rowdata-${patient.id}`, JSON.stringify(rowData))
      localStorage.setItem(`prescription-photos-${patient.id}`, JSON.stringify(medicalPhotos))
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }
  }, [patient.id, currentPrescription, remedyRows, rowData, medicalPhotos])

  // Auto-save effect
  useEffect(() => {
    const timer = setTimeout(() => {
      saveToLocalStorage()
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [currentPrescription, remedyRows, rowData, medicalPhotos, saveToLocalStorage])

  // Remedy row management
  const addRemedyRow = useCallback(() => {
    const newRow: RemedyRow = {
      id: `row-${Date.now()}`,
      name: ''
    }
    setRemedyRows(prev => [...prev, newRow])
  }, [])

  const deleteRemedyRow = useCallback((rowId: string) => {
    setRemedyRows(prev => prev.filter(row => row.id !== rowId))
    // Clean up row data
    setRowData(prev => {
      const newData = { ...prev }
      Object.keys(newData).forEach(key => {
        if (key.startsWith(rowId)) {
          delete newData[key]
        }
      })
      return newData
    })
  }, [])

  const updateCellData = useCallback((rowId: string, cellKey: string, value: string) => {
    setRowData(prev => ({
      ...prev,
      [cellKey]: value
    }))
  }, [])

  // Special instructions management
  const addSpecialInstruction = useCallback((instruction: PrescriptionSpecialInstruction) => {
    setCurrentPrescription(prev => ({
      ...prev,
      specialInstructions: [...prev.specialInstructions, instruction]
    }))
  }, [])

  const removeSpecialInstruction = useCallback((index: number) => {
    setCurrentPrescription(prev => ({
      ...prev,
      specialInstructions: prev.specialInstructions.filter((_, i) => i !== index)
    }))
  }, [])

  // Advice management
  const updateDietaryAdvice = useCallback((advice: string[]) => {
    setCurrentPrescription(prev => ({
      ...prev,
      dietaryAdvice: advice
    }))
  }, [])

  const updateLifestyleAdvice = useCallback((advice: string[]) => {
    setCurrentPrescription(prev => ({
      ...prev,
      lifestyleAdvice: advice
    }))
  }, [])

  // Photo management
  const addPhoto = useCallback((photo: MedicalPhoto) => {
    setMedicalPhotos(prev => [...prev, photo])
  }, [])

  const deletePhoto = useCallback((photoId: string) => {
    setMedicalPhotos(prev => prev.filter(photo => photo.id !== photoId))
  }, [])

  // Edit mode toggle
  const toggleEditMode = useCallback(() => {
    if (editMode && onSave) {
      // Save when exiting edit mode
      onSave(currentPrescription)
    }
    setEditMode(prev => !prev)
  }, [editMode, currentPrescription, onSave])

  // Print handler
  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  return {
    prescription: currentPrescription,
    editMode,
    remedyRows,
    rowData,
    medicalPhotos,
    addRemedyRow,
    deleteRemedyRow,
    updateCellData,
    addSpecialInstruction,
    removeSpecialInstruction,
    updateDietaryAdvice,
    updateLifestyleAdvice,
    addPhoto,
    deletePhoto,
    toggleEditMode,
    handlePrint
  }
}