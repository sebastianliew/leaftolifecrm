"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FiEdit, FiTrash2, FiPlus, FiPrinter, FiUser, FiAlertCircle, FiUpload, FiX, FiMaximize2, FiClock, FiEye, FiCheck, FiLoader, FiActivity } from 'react-icons/fi'
import { format, parseISO, addDays, subDays } from 'date-fns'
import type { Prescription, PrescriptionRemedy, PrescriptionSpecialInstruction, PrescriptionMeal, PrescriptionVersion, PrescriptionChange } from '@/types/prescription'
import type { Patient } from '@/types/patient'
import { PrescriptionVersionManager } from '@/lib/prescription-versioning'
import PrescriptionTimeline from './prescription/PrescriptionTimeline'
import PrescriptionComparison from './prescription/PrescriptionComparison'
import DateNavigator from './prescription/DateNavigator'
import PrescriptionTimelineGraph from './prescription/PrescriptionTimelineGraph'
import PrescriptionBulkOperations from './prescription/PrescriptionBulkOperations'
import Image from 'next/image'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { usePrescriptions } from '@/hooks/usePrescriptions'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'

interface PrescriptionDashboardProps {
  patient: Patient
  prescription?: Prescription
  onSave?: (prescription: Prescription) => void
  onPrint?: (prescription: Prescription) => void
  onDelete?: (prescriptionId: string) => void
  readOnly?: boolean
  className?: string
  selectedDate?: string
  onDateChange?: (date: string) => void
}

// Removed hardcoded remedy templates - users will type directly into cells

export default function PrescriptionDashboard({ 
  patient, 
  prescription, 
  onSave, 
  onPrint, 
  onDelete: _onDelete,
  readOnly = false,
  className = "",
  selectedDate,
  onDateChange
}: PrescriptionDashboardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { deletePrescription } = usePrescriptions({ patientId: patient.id })
  // Load saved prescription from localStorage if available
  const loadSavedPrescription = (): Prescription => {
    if (prescription) {
      return prescription
    }
    
    try {
      const storageKey = `prescription-${patient.id}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load saved prescription:', error)
    }
    
    // Return default prescription if no saved data
    return {
      id: '',
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      practitionerName: 'Super Admin, ND, MNHAA, MHS (UEA)',
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

  const [currentPrescription, setCurrentPrescription] = useState<Prescription>(loadSavedPrescription())
  const [editMode, setEditMode] = useState(() => {
    // Start in edit mode if no prescription was passed as prop
    // This ensures users can edit saved prescriptions from localStorage
    return !prescription
  })
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [, setLastSaved] = useState<Date>(new Date())
  const [medicalPhotos, setMedicalPhotos] = useState<Array<{ id: string; url: string; name: string; uploadedAt: string }>>(() => {
    // Load saved photos from localStorage
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
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [showTimeline, setShowTimeline] = useState(false) // Start with timeline hidden
  const [showComparison, setShowComparison] = useState(false)
  const [comparisonDates, setComparisonDates] = useState<string[]>([])
  const [versions, setVersions] = useState<PrescriptionVersion[]>([])
  const [currentVersionDate, setCurrentVersionDate] = useState<string>(selectedDate || format(new Date(), 'yyyy-MM-dd'))
  const [showAdvancedFeatures, setShowAdvancedFeatures] = useState(false)
  const [remedyRows, setRemedyRows] = useState<Array<{ id: string; name: string }>>(() => {
    // Try to load saved rows
    try {
      const storageKey = `prescription-rows-${patient.id}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load saved rows:', error)
    }
    return [
      { id: 'row-1', name: 'Remedies' }
    ]
  })

  const _handleAddRemedy = (meal: string, timing: string, name: string = '', dosage: string = '', instructions: string = '') => {
    const newRemedy: PrescriptionRemedy = {
      id: `${Date.now()}-${Math.random()}`,
      name,
      dosage,
      instructions,
      frequency: 'Daily',
      notes: ''
    }

    setCurrentPrescription(prev => ({
      ...prev,
      dailySchedule: {
        ...prev.dailySchedule,
        [meal]: {
          ...prev.dailySchedule[meal as keyof typeof prev.dailySchedule],
          [timing]: [
            ...prev.dailySchedule[meal as keyof typeof prev.dailySchedule][timing as keyof typeof prev.dailySchedule.breakfast],
            newRemedy
          ]
        }
      }
    }))
  }

  const _handleRemoveRemedy = (meal: string, timing: string, remedyId: string) => {
    setCurrentPrescription(prev => ({
      ...prev,
      dailySchedule: {
        ...prev.dailySchedule,
        [meal]: {
          ...prev.dailySchedule[meal as keyof typeof prev.dailySchedule],
          [timing]: prev.dailySchedule[meal as keyof typeof prev.dailySchedule][timing as keyof typeof prev.dailySchedule.breakfast]
            .filter((r: PrescriptionRemedy) => r.id !== remedyId)
        }
      }
    }))
  }

  const _handleUpdateRemedy = (meal: string, timing: string, remedyId: string, field: keyof PrescriptionRemedy, value: string) => {
    setCurrentPrescription(prev => ({
      ...prev,
      dailySchedule: {
        ...prev.dailySchedule,
        [meal]: {
          ...prev.dailySchedule[meal as keyof typeof prev.dailySchedule],
          [timing]: prev.dailySchedule[meal as keyof typeof prev.dailySchedule][timing as keyof typeof prev.dailySchedule.breakfast]
            .map((r: PrescriptionRemedy) => r.id === remedyId ? { ...r, [field]: value } : r)
        }
      }
    }))
  }

  const handleAddSpecialInstruction = () => {
    const newInstruction: PrescriptionSpecialInstruction = {
      id: `${Date.now()}-${Math.random()}`,
      category: 'general',
      instruction: '',
      priority: 'medium'
    }
    setCurrentPrescription(prev => ({
      ...prev,
      specialInstructions: [...prev.specialInstructions, newInstruction]
    }))
  }

  const _handleSave = async () => {
    try {
      // Convert row data back to prescription format
      const newDailySchedule: PrescriptionMeal = {
        breakfast: { before: [], during: [], after: [] },
        lunch: { before: [], during: [], after: [] },
        dinner: { before: [], during: [], after: [] }
      }

      // Process each row's data
      remedyRows.forEach((row) => {
        const rowId = row.id
        const rowName = row.name
        
        // Process each meal and timing
        const meals = ['breakfast', 'lunch', 'dinner'] as const
        const timings = ['before', 'during', 'after'] as const
        
        meals.forEach(meal => {
          timings.forEach(timing => {
            const key = `${meal}-${timing}`
            const content = rowData[rowId]?.[key] || ''
            
            if (content.trim()) {
              const remedy: PrescriptionRemedy = {
                id: `${rowId}-${meal}-${timing}`,
                name: rowName,
                dosage: '',
                instructions: content.trim(),
                frequency: 'Daily',
                notes: ''
              };
              newDailySchedule[meal][timing].push(remedy)
            }
          })
        })
      })

      // Update prescription with current timestamp
      const updatedPrescription = {
        ...currentPrescription,
        dailySchedule: newDailySchedule,
        updatedAt: new Date().toISOString(),
        id: currentPrescription.id || `prescription-${Date.now()}`
      }
      
      setCurrentPrescription(updatedPrescription)
      
      // Calculate changes if there's a previous version
      const previousVersion = PrescriptionVersionManager.getVersionByDate(patient.id, currentVersionDate)
      const changes: PrescriptionChange[] = previousVersion 
        ? PrescriptionVersionManager.compareVersions(previousVersion, {
            ...previousVersion,
            prescription: updatedPrescription
          })
        : []

      // Save as new version
      const _savedVersion = PrescriptionVersionManager.saveVersion(patient.id, updatedPrescription, changes)
      
      // Save to localStorage for persistence across page refreshes
      const storageKey = `prescription-${updatedPrescription.patientId}`
      localStorage.setItem(storageKey, JSON.stringify(updatedPrescription))
      
      // Save row data and remedy rows with version-specific keys
      const rowDataKey = `prescription-rowdata-${updatedPrescription.patientId}-${currentVersionDate}`
      localStorage.setItem(rowDataKey, JSON.stringify(rowData))
      const rowsKey = `prescription-rows-${updatedPrescription.patientId}-${currentVersionDate}`
      localStorage.setItem(rowsKey, JSON.stringify(remedyRows))
      
      // Reload versions
      loadVersions()
      
      // Also call the onSave callback if provided
      if (onSave) {
        await onSave(updatedPrescription)
      }
      
      setEditMode(false)
      
      // Prescription saved successfully
    } catch (error) {
      console.error('Failed to save prescription:', error)
    }
  }

  const handlePrint = () => {
    if (onPrint) {
      onPrint(currentPrescription)
    } else {
      // Default print functionality
      window.print()
    }
  }

  const handleDelete = async () => {
    try {
      if (currentPrescription.id) {
        await deletePrescription(currentPrescription.id)
        
        // Clear from localStorage
        const storageKey = `prescription-${patient.id}`
        localStorage.removeItem(storageKey)
        localStorage.removeItem(`prescription-photos-${patient.id}`)
        localStorage.removeItem(`prescription-rows-${patient.id}-${currentVersionDate}`)
        localStorage.removeItem(`prescription-rowdata-${patient.id}-${currentVersionDate}`)
        
        toast({
          title: 'Success',
          description: 'Prescription deleted successfully'
        })
        
        // Navigate back to patient page
        router.push(`/patients/${patient.id}`)
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete prescription',
        variant: 'destructive'
      })
    }
  }

  // Auto-save helper with status indicator
  const autoSavePrescription = async (updatedPrescription: Prescription) => {
    setSaveStatus('saving')
    try {
      // Save to localStorage
      const storageKey = `prescription-${updatedPrescription.patientId}`
      localStorage.setItem(storageKey, JSON.stringify(updatedPrescription))
      
      // If prescription has an ID and onSave is provided, save to backend
      if (updatedPrescription.id && onSave) {
        await onSave(updatedPrescription)
      }
      
      setSaveStatus('saved')
      setLastSaved(new Date())
      setCurrentPrescription(updatedPrescription)
    } catch (error) {
      setSaveStatus('error')
      console.error('Failed to auto-save prescription:', error)
      toast({
        title: 'Auto-save failed',
        description: 'Your changes may not be saved',
        variant: 'destructive'
      })
    }
  }

  // Initialize row data storage
  const [rowData, setRowData] = useState<Record<string, Record<string, string>>>(() => {
    // Try to load saved row data
    try {
      const storageKey = `prescription-rowdata-${patient.id}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load saved row data:', error)
    }
    // Initialize with empty data for the first row
    return {
      'row-1': {}
    }
  })

  const loadVersions = useCallback(() => {
    const allVersions = PrescriptionVersionManager.getAllVersions(patient.id)
    // console.log('Loaded versions:', allVersions)
    setVersions(allVersions)
    // Don't show timeline by default, let user toggle it
    // This prevents confusion when there are no prescriptions yet
  }, [patient.id])

  // Load versions when component mounts
  useEffect(() => {
    loadVersions()
  }, [patient.id, loadVersions])

  const handleCreateNewVersion = useCallback((date: string) => {
    try {
      // console.log('Creating new prescription version for date:', date)
      const newPrescription = {
        ...currentPrescription,
        id: `prescription-${Date.now()}`,
        date: format(new Date(date), 'dd-MMM-yyyy'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      // console.log('New prescription created:', newPrescription)
      
      // Save the new prescription as a version immediately
      const _savedVersion = PrescriptionVersionManager.saveVersion(patient.id, newPrescription, [])
      // console.log('Version saved:', _savedVersion)
      
      // Update component state
      setCurrentPrescription(newPrescription)
      setCurrentVersionDate(date)
      setEditMode(true)
      
      // Reload versions to update the UI
      loadVersions()
      
      // Initialize row data for this version
      setRowData({ 'row-1': {} })
      setRemedyRows([{ id: 'row-1', name: 'Remedies' }])
      
    } catch (error) {
      console.error('Error creating new prescription version:', error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id, currentPrescription, loadVersions, setCurrentPrescription, setCurrentVersionDate, setEditMode, setRowData, setRemedyRows])

  const handleDateSelect = useCallback((date: string) => {
    setCurrentVersionDate(date)
    const version = PrescriptionVersionManager.getVersionByDate(patient.id, date)
    if (version) {
      setCurrentPrescription(version.prescription)
      // Load associated row data for this version
      try {
        const rowDataKey = `prescription-rowdata-${patient.id}-${date}`
        const saved = localStorage.getItem(rowDataKey)
        if (saved) {
          setRowData(JSON.parse(saved))
        }
        const rowsKey = `prescription-rows-${patient.id}-${date}`
        const savedRows = localStorage.getItem(rowsKey)
        if (savedRows) {
          setRemedyRows(JSON.parse(savedRows))
        }
      } catch (error) {
        console.error('Failed to load version data:', error)
      }
    } else {
      // If no version exists for this date, create a new one
      handleCreateNewVersion(date)
    }
    if (onDateChange) {
      onDateChange(date)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id, onDateChange, handleCreateNewVersion])

  const handleCompareVersions = (dates: string[]) => {
    setComparisonDates(dates)
    setShowComparison(true)
    setShowTimeline(false)
  }

  // Load existing prescription data into row format on initial load
  useEffect(() => {
    // Only run if we haven't loaded row data yet and prescription has data
    const hasExistingRowData = Object.keys(rowData).some(rowId => 
      Object.values(rowData[rowId] || {}).some(value => value.trim() !== '')
    )
    
    if (!hasExistingRowData && currentPrescription.id) {
      const newRowData: Record<string, Record<string, string>> = {}
      const existingRows: Array<{ id: string; name: string }> = []
      const remedyNames = new Set<string>()
      
      // Extract remedies and group by name
      const meals = ['breakfast', 'lunch', 'dinner'] as const
      const timings = ['before', 'during', 'after'] as const
      
      meals.forEach(meal => {
        timings.forEach(timing => {
          const remedies = currentPrescription.dailySchedule[meal][timing]
          remedies.forEach(remedy => {
            if (remedy.name) {
              remedyNames.add(remedy.name)
            }
          })
        })
      })
      
      // Create rows for each unique remedy name
      const nameArray = Array.from(remedyNames)
      if (nameArray.length === 0) {
        return // No existing data to convert
      }
      
      nameArray.forEach((name, index) => {
        const rowId = `row-${index + 1}`
        existingRows.push({ id: rowId, name })
        newRowData[rowId] = {}
        
        // Populate row data
        meals.forEach(meal => {
          timings.forEach(timing => {
            const remedies = currentPrescription.dailySchedule[meal][timing]
            const remedy = remedies.find(r => r.name === name)
            if (remedy) {
              const key = `${meal}-${timing}`
              const content = remedy.instructions || 
                            (remedy.dosage ? remedy.dosage : '')
              if (content) {
                newRowData[rowId][key] = content
              }
            }
          })
        })
      })
      
      setRemedyRows(existingRows)
      setRowData(newRowData)
    }
  }, [currentPrescription.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Store cell content in a simple string format for each cell
  const getCellContent = (meal: string, timing: string, rowId: string): string => {
    const key = `${meal}-${timing}`
    return rowData[rowId]?.[key] || ''
  }

  const setCellContent = (meal: string, timing: string, rowId: string, content: string) => {
    const key = `${meal}-${timing}`
    setRowData(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [key]: content
      }
    }))
    
    // Auto-save to localStorage immediately with version-specific key
    try {
      const storageKey = `prescription-rowdata-${currentPrescription.patientId}-${currentVersionDate}`
      const updatedRowData = {
        ...rowData,
        [rowId]: {
          ...rowData[rowId],
          [key]: content
        }
      }
      localStorage.setItem(storageKey, JSON.stringify(updatedRowData))
    } catch (error) {
      console.error('Failed to auto-save prescription row data:', error)
    }
  }

  const renderRemedyCell = (meal: string, timing: string, rowId: string) => {
    const cellContent = getCellContent(meal, timing, rowId)

    return (
      <TableCell className="p-0 border align-top" style={{ minWidth: '150px' }}>
        <div
          className="min-h-[100px] p-3 text-sm cursor-text outline-none focus:bg-blue-50 hover:bg-gray-50 overflow-visible"
          contentEditable={!readOnly && editMode}
          suppressContentEditableWarning={true}
          onBlur={(e) => {
            const newContent = e.target.textContent || ''
            if (newContent !== cellContent) {
              setCellContent(meal, timing, rowId, newContent)
            }
          }}
          onInput={(e) => {
            // Auto-expand height as user types
            const target = e.target as HTMLElement
            target.style.height = 'auto'
            target.style.height = Math.max(100, target.scrollHeight) + 'px'
          }}
          style={{ 
            lineHeight: '1.4',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            overflow: 'visible'
          }}
        >
          {cellContent}
        </div>
      </TableCell>
    )
  }

  const handleAddRow = () => {
    const newRow = {
      id: `row-${Date.now()}`,
      name: 'New Remedy'
    }
    const updatedRows = [...remedyRows, newRow]
    setRemedyRows(updatedRows)
    
    // Initialize empty data for the new row
    const updatedRowData = {
      ...rowData,
      [newRow.id]: {}
    }
    setRowData(updatedRowData)
    
    // Save rows to localStorage with version-specific keys
    try {
      const rowsKey = `prescription-rows-${patient.id}-${currentVersionDate}`
      localStorage.setItem(rowsKey, JSON.stringify(updatedRows))
      
      const rowDataKey = `prescription-rowdata-${patient.id}-${currentVersionDate}`
      localStorage.setItem(rowDataKey, JSON.stringify(updatedRowData))
    } catch (error) {
      console.error('Failed to save rows:', error)
    }
  }

  const handleDeleteRow = (rowId: string) => {
    if (remedyRows.length > 1) {
      const updatedRows = remedyRows.filter(row => row.id !== rowId)
      setRemedyRows(updatedRows)
      
      // Remove data for the deleted row
      const updatedRowData = { ...rowData }
      delete updatedRowData[rowId]
      setRowData(updatedRowData)
      
      // Save to localStorage with version-specific keys
      try {
        const rowsKey = `prescription-rows-${patient.id}-${currentVersionDate}`
        localStorage.setItem(rowsKey, JSON.stringify(updatedRows))
        
        const rowDataKey = `prescription-rowdata-${patient.id}-${currentVersionDate}`
        localStorage.setItem(rowDataKey, JSON.stringify(updatedRowData))
      } catch (error) {
        console.error('Failed to save after deletion:', error)
      }
    }
  }

  const handleUpdateRowName = (rowId: string, newName: string) => {
    const updatedRows = remedyRows.map(row => 
      row.id === rowId ? { ...row, name: newName } : row
    )
    setRemedyRows(updatedRows)
    
    // Save to localStorage with version-specific key
    try {
      const rowsKey = `prescription-rows-${patient.id}-${currentVersionDate}`
      localStorage.setItem(rowsKey, JSON.stringify(updatedRows))
    } catch (error) {
      console.error('Failed to save row name:', error)
    }
  }

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const newPhoto = {
          id: `photo-${Date.now()}-${Math.random()}`,
          url: e.target?.result as string,
          name: file.name,
          uploadedAt: new Date().toISOString()
        }
        
        const updatedPhotos = [...medicalPhotos, newPhoto]
        setMedicalPhotos(updatedPhotos)
        
        // Save to localStorage
        try {
          const storageKey = `prescription-photos-${patient.id}`
          localStorage.setItem(storageKey, JSON.stringify(updatedPhotos))
        } catch (error) {
          console.error('Failed to save photos:', error)
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const handleDeletePhoto = (photoId: string) => {
    const updatedPhotos = medicalPhotos.filter(photo => photo.id !== photoId)
    setMedicalPhotos(updatedPhotos)
    
    // Save to localStorage
    try {
      const storageKey = `prescription-photos-${patient.id}`
      localStorage.setItem(storageKey, JSON.stringify(updatedPhotos))
    } catch (error) {
      console.error('Failed to save photos after deletion:', error)
    }
  }

  // Determine current UI state
  const hasNoPrescriptions = versions.length === 0 && !currentPrescription.id
  const isCreatingNew = editMode && !currentPrescription.id
  const isViewing = !editMode && currentPrescription.id
  const isEditing = editMode && currentPrescription.id

  // Keyboard shortcuts for date navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return // Don't trigger shortcuts when typing
      }
      
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'ArrowLeft': {
            e.preventDefault()
            const prevDate = format(subDays(parseISO(currentVersionDate), 1), 'yyyy-MM-dd')
            handleDateSelect(prevDate)
            break
          }
          case 'ArrowRight': {
            e.preventDefault()
            const nextDate = format(addDays(parseISO(currentVersionDate), 1), 'yyyy-MM-dd')
            handleDateSelect(nextDate)
            break
          }
          case 't': {
            e.preventDefault()
            handleDateSelect(format(new Date(), 'yyyy-MM-dd'))
            break
          }
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentVersionDate, handleDateSelect])

  return (
    <div className={`max-w-7xl mx-auto p-6 space-y-6 ${className}`}>
      {/* Enhanced Date Navigator - Always show */}
      <DateNavigator
        currentDate={currentVersionDate}
        onDateChange={handleDateSelect}
        onCreateNew={handleCreateNewVersion}
        versions={versions}
      />
      
      {/* Timeline - Show when requested */}
      {showTimeline && versions.length > 0 && (
        <PrescriptionTimeline
          patientId={patient.id}
          currentDate={currentVersionDate}
          onDateSelect={handleDateSelect}
          onCompareSelect={handleCompareVersions}
          onCreateNew={handleCreateNewVersion}
        />
      )}

      {/* Prescription Timeline Graph - Show when there are multiple versions */}
      {showAdvancedFeatures && versions.length > 1 && (
        <PrescriptionTimelineGraph
          versions={versions}
        />
      )}
      
      {/* Empty State - No prescriptions yet */}
      {hasNoPrescriptions && !isCreatingNew && (
        <Card>
          <CardContent className="text-center py-16">
            <div className="max-w-md mx-auto">
              <FiUser className="h-20 w-20 text-gray-300 mx-auto mb-6" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">No Prescriptions Yet</h2>
              <p className="text-gray-600 mb-8">
                Create the first prescription for {patient.firstName} {patient.lastName}
              </p>
              <Button 
                onClick={() => {
                  const date = format(new Date(), 'yyyy-MM-dd')
                  handleCreateNewVersion(date)
                }}
                size="lg"
                className="gap-2"
              >
                <FiPlus className="h-5 w-5" />
                Create New Prescription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prescription Content - Only show when there's a prescription */}
      {(currentPrescription.id || isCreatingNew) && (
        <>
          {/* Header Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <FiUser className="h-6 w-6 text-blue-600" />
                    <div>
                      <CardTitle className="text-2xl">Naturopathic Prescription</CardTitle>
                      <CardDescription>
                        by {currentPrescription.practitionerName}
                      </CardDescription>
                    </div>
                {editMode && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {saveStatus === 'saving' && (
                      <>
                        <FiLoader className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    )}
                    {saveStatus === 'saved' && (
                      <>
                        <FiCheck className="h-4 w-4 text-green-600" />
                        <span>All changes saved</span>
                      </>
                    )}
                    {saveStatus === 'error' && (
                      <>
                        <FiAlertCircle className="h-4 w-4 text-red-600" />
                        <span>Save failed</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Name</Label>
                  <p className="text-lg font-semibold">{currentPrescription.patientName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Date</Label>
                  <p className="text-lg">{currentPrescription.date}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  {editMode && !readOnly ? (
                    <Select
                      value={currentPrescription.status}
                      onValueChange={(value: 'draft' | 'active' | 'completed' | 'cancelled') => {
                        const updatedPrescription = { ...currentPrescription, status: value }
                        autoSavePrescription(updatedPrescription)
                      }}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge 
                      className={
                        currentPrescription.status === 'active' ? 'bg-green-100 text-green-800' :
                        currentPrescription.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                        currentPrescription.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }
                    >
                      {currentPrescription.status}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {/* View Mode Actions */}
              {isViewing && (
                <>
                  <Button onClick={() => setEditMode(true)} variant="default" size="sm" className="gap-1.5">
                    <FiEdit className="h-3.5 w-3.5" />
                    Edit Prescription
                  </Button>
                  
                  {currentPrescription.status !== 'cancelled' && (
                    <PrescriptionBulkOperations
                      patientId={patient.id}
                      currentPrescription={currentPrescription}
                      onComplete={loadVersions}
                    />
                  )}
                  {currentPrescription.status === 'draft' && (
                    <Button 
                      onClick={() => {
                        const updatedPrescription = { ...currentPrescription, status: 'active' as const }
                        autoSavePrescription(updatedPrescription)
                      }} 
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-green-600 hover:text-green-700"
                    >
                      <FiCheck className="h-3.5 w-3.5" />
                      Activate
                    </Button>
                  )}
                  <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5">
                    <FiPrinter className="h-3.5 w-3.5" />
                    Print
                  </Button>
                </>
              )}

              {/* Edit Mode Actions */}
              {isEditing && (
                <>
                  <Button 
                    onClick={() => setEditMode(false)} 
                    variant="default" 
                    size="sm"
                    className="gap-1.5"
                  >
                    <FiCheck className="h-3.5 w-3.5" />
                    Done Editing
                  </Button>
                  {currentPrescription.status === 'draft' && (
                    <Button 
                      onClick={() => {
                        const updatedPrescription = { ...currentPrescription, status: 'active' as const }
                        autoSavePrescription(updatedPrescription)
                      }} 
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-green-600 hover:text-green-700"
                    >
                      <FiCheck className="h-3.5 w-3.5" />
                      Activate
                    </Button>
                  )}
                </>
              )}

              {/* Creating New Prescription Actions */}
              {isCreatingNew && (
                <Button 
                  onClick={() => {
                    // Cancel creation and go back
                    setEditMode(false)
                    if (versions.length > 0) {
                      handleDateSelect(versions[0].date)
                    }
                  }} 
                  variant="outline" 
                  size="sm"
                  className="gap-1.5"
                >
                  Cancel
                </Button>
              )}

              {/* Common Actions */}
              {versions.length > 0 && (
                <>
                  <Button 
                    onClick={() => setShowTimeline(!showTimeline)} 
                    variant="outline" 
                    size="sm"
                    className="gap-1.5"
                  >
                    <FiClock className="h-3.5 w-3.5" />
                    {showTimeline ? 'Hide History' : 'Show History'}
                  </Button>
                  
                  <Button 
                    onClick={() => setShowAdvancedFeatures(!showAdvancedFeatures)} 
                    variant="outline" 
                    size="sm"
                    className="gap-1.5"
                  >
                    <FiActivity className="h-3.5 w-3.5" />
                    {showAdvancedFeatures ? 'Hide Analytics' : 'Show Analytics'}
                  </Button>
                </>
              )}
              
              {versions.length > 1 && (
                <Button 
                  onClick={() => {
                    setComparisonDates([versions[0]?.date || '', versions[1]?.date || ''])
                    setShowComparison(true)
                  }} 
                  variant="outline" 
                  size="sm"
                  className="gap-1.5"
                >
                  <FiEye className="h-3.5 w-3.5" />
                  Compare
                </Button>
              )}

              {/* Delete - Only in edit mode for existing prescriptions */}
              {isEditing && currentPrescription.id && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-red-600 hover:text-red-700">
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Prescription</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this prescription? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                        Delete Prescription
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

          {/* Mode Indicator */}
          {(isCreatingNew || isEditing) && (
            <Alert className="border-blue-200 bg-blue-50">
              <FiEdit className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                {isCreatingNew ? 'Creating new prescription - all changes are auto-saved' : 'Editing prescription - all changes are auto-saved'}
              </AlertDescription>
            </Alert>
          )}

          {/* Main Prescription Content */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>
                    {isCreatingNew ? 'New Prescription' : 'Remedy Schedule'}
                  </CardTitle>
                  <CardDescription>
                    {isCreatingNew 
                      ? 'Add remedies and instructions for this prescription' 
                      : 'Daily remedy schedule organized by meal times'}
                  </CardDescription>
                </div>
                {editMode && !readOnly && (
                  <Button onClick={handleAddRow} variant="outline" size="sm" className="gap-2">
                    <FiPlus className="h-4 w-4" />
                    Add Remedy
                  </Button>
                )}
              </div>
            </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="w-full" style={{ tableLayout: 'auto' }}>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold bg-gray-50" style={{ minWidth: '120px' }}>Remedy</TableHead>
                  <TableHead className="text-center font-semibold bg-blue-50" colSpan={3}>Breakfast</TableHead>
                  <TableHead className="text-center font-semibold bg-orange-50" colSpan={3}>Lunch</TableHead>
                  <TableHead className="text-center font-semibold bg-purple-50" colSpan={3}>Dinner</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="bg-gray-50"></TableHead>
                  <TableHead className="text-center text-xs bg-blue-50 border-l">Before</TableHead>
                  <TableHead className="text-center text-xs bg-blue-50">During</TableHead>
                  <TableHead className="text-center text-xs bg-blue-50">After</TableHead>
                  <TableHead className="text-center text-xs bg-orange-50 border-l">Before</TableHead>
                  <TableHead className="text-center text-xs bg-orange-50">During</TableHead>
                  <TableHead className="text-center text-xs bg-orange-50">After</TableHead>
                  <TableHead className="text-center text-xs bg-purple-50 border-l">Before</TableHead>
                  <TableHead className="text-center text-xs bg-purple-50">During</TableHead>
                  <TableHead className="text-center text-xs bg-purple-50">After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {remedyRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium bg-gray-50 border-r">
                      <div className="flex items-center justify-between">
                        {editMode && !readOnly ? (
                          <Input
                            value={row.name}
                            onChange={(e) => handleUpdateRowName(row.id, e.target.value)}
                            className="border border-gray-300 bg-white px-2 py-1 h-auto text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded"
                            placeholder="Enter remedy name..."
                          />
                        ) : (
                          <div className="text-sm px-2 py-1">{row.name}</div>
                        )}
                        {editMode && !readOnly && remedyRows.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRow(row.id)}
                            className="ml-2 h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          >
                            <FiTrash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    {renderRemedyCell('breakfast', 'before', row.id)}
                    {renderRemedyCell('breakfast', 'during', row.id)}
                    {renderRemedyCell('breakfast', 'after', row.id)}
                    {renderRemedyCell('lunch', 'before', row.id)}
                    {renderRemedyCell('lunch', 'during', row.id)}
                    {renderRemedyCell('lunch', 'after', row.id)}
                    {renderRemedyCell('dinner', 'before', row.id)}
                    {renderRemedyCell('dinner', 'during', row.id)}
                    {renderRemedyCell('dinner', 'after', row.id)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        </Card>
        </>
      )}

      {/* Special Instructions and Advice */}
      {(versions.length > 0 || editMode) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiAlertCircle className="h-5 w-5" />
              Special Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editMode && !readOnly ? (
              <div className="space-y-3">
                {currentPrescription.specialInstructions.map((instruction, index) => (
                  <div key={instruction.id} className="flex gap-2">
                    <Textarea
                      value={instruction.instruction}
                      onChange={(e) => {
                        const updated = [...currentPrescription.specialInstructions]
                        updated[index] = { ...instruction, instruction: e.target.value }
                        const updatedPrescription = { 
                          ...currentPrescription, 
                          specialInstructions: updated,
                          updatedAt: new Date().toISOString()
                        }
                        autoSavePrescription(updatedPrescription)
                      }}
                      placeholder="Enter special instruction..."
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const updated = currentPrescription.specialInstructions.filter((_, i) => i !== index)
                        setCurrentPrescription(prev => ({ ...prev, specialInstructions: updated }))
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button onClick={handleAddSpecialInstruction} variant="outline" size="sm" className="w-full">
                  <FiPlus className="h-4 w-4 mr-2" />
                  Add Instruction
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {currentPrescription.specialInstructions.length > 0 ? (
                  currentPrescription.specialInstructions.map((instruction) => (
                    <div key={instruction.id} className="p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                      <p className="text-sm">{instruction.instruction}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No special instructions</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dietary & Lifestyle Advice</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="dietary" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="dietary">Dietary</TabsTrigger>
                <TabsTrigger value="lifestyle">Lifestyle</TabsTrigger>
              </TabsList>
              <TabsContent value="dietary" className="space-y-3">
                {editMode && !readOnly ? (
                  <div className="space-y-2">
                    {currentPrescription.dietaryAdvice.map((advice, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={advice}
                          onChange={(e) => {
                            const updated = [...currentPrescription.dietaryAdvice]
                            updated[index] = e.target.value
                            const updatedPrescription = { 
                              ...currentPrescription, 
                              dietaryAdvice: updated,
                              updatedAt: new Date().toISOString()
                            }
                            setCurrentPrescription(updatedPrescription)
                            
                            // Auto-save to localStorage
                            try {
                              const storageKey = `prescription-${updatedPrescription.patientId}`
                              localStorage.setItem(storageKey, JSON.stringify(updatedPrescription))
                            } catch (error) {
                              console.error('Failed to auto-save prescription:', error)
                            }
                          }}
                          placeholder="Enter dietary advice..."
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const updated = currentPrescription.dietaryAdvice.filter((_, i) => i !== index)
                            setCurrentPrescription(prev => ({ ...prev, dietaryAdvice: updated }))
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      onClick={() => {
                        setCurrentPrescription(prev => ({
                          ...prev,
                          dietaryAdvice: [...prev.dietaryAdvice, '']
                        }))
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <FiPlus className="h-4 w-4 mr-2" />
                      Add Dietary Advice
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentPrescription.dietaryAdvice.length > 0 ? (
                      currentPrescription.dietaryAdvice.map((advice, index) => (
                        <div key={index} className="p-2 bg-green-50 rounded text-sm">
                          • {advice}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">No dietary advice</p>
                    )}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="lifestyle" className="space-y-3">
                {editMode && !readOnly ? (
                  <div className="space-y-2">
                    {currentPrescription.lifestyleAdvice.map((advice, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={advice}
                          onChange={(e) => {
                            const updated = [...currentPrescription.lifestyleAdvice]
                            updated[index] = e.target.value
                            const updatedPrescription = { 
                              ...currentPrescription, 
                              lifestyleAdvice: updated,
                              updatedAt: new Date().toISOString()
                            }
                            setCurrentPrescription(updatedPrescription)
                            
                            // Auto-save to localStorage
                            try {
                              const storageKey = `prescription-${updatedPrescription.patientId}`
                              localStorage.setItem(storageKey, JSON.stringify(updatedPrescription))
                            } catch (error) {
                              console.error('Failed to auto-save prescription:', error)
                            }
                          }}
                          placeholder="Enter lifestyle advice..."
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const updated = currentPrescription.lifestyleAdvice.filter((_, i) => i !== index)
                            setCurrentPrescription(prev => ({ ...prev, lifestyleAdvice: updated }))
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      onClick={() => {
                        setCurrentPrescription(prev => ({
                          ...prev,
                          lifestyleAdvice: [...prev.lifestyleAdvice, '']
                        }))
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <FiPlus className="h-4 w-4 mr-2" />
                      Add Lifestyle Advice
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentPrescription.lifestyleAdvice.length > 0 ? (
                      currentPrescription.lifestyleAdvice.map((advice, index) => (
                        <div key={index} className="p-2 bg-blue-50 rounded text-sm">
                          • {advice}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">No lifestyle advice</p>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Medical Photos Section */}
      {(versions.length > 0 || editMode) && (
        <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Medical Photos</CardTitle>
              <CardDescription>
                Upload and manage patient medical photos for documentation
              </CardDescription>
            </div>
            {editMode && !readOnly && (
              <div className="relative">
                <input
                  type="file"
                  id="photo-upload"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                />
                <label
                  htmlFor="photo-upload"
                  className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FiUpload className="h-4 w-4" />
                  Upload Photos
                </label>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {medicalPhotos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {medicalPhotos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <div 
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer border-2 border-gray-200 hover:border-blue-500 transition-colors"
                    onClick={() => setSelectedPhoto(photo.url)}
                  >
                    <Image
                      src={photo.url}
                      alt={photo.name}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                      <FiMaximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6" />
                    </div>
                  </div>
                  {editMode && !readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeletePhoto(photo.id)
                      }}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  )}
                  <p className="mt-2 text-xs text-gray-600 truncate">{photo.name}</p>
                  <p className="text-xs text-gray-500">{format(new Date(photo.uploadedAt), 'dd/MM/yyyy')}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No medical photos uploaded yet</p>
              {editMode && !readOnly && (
                <p className="text-sm text-gray-400 mt-2">Click &quot;Upload Photos&quot; to add medical images</p>
              )}
            </div>
          )}
        </CardContent>
        </Card>
      )}

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <Image
              src={selectedPhoto}
              alt="Medical photo"
              width={1200}
              height={800}
              className="max-w-full max-h-[90vh] object-contain"
              style={{ width: 'auto', height: 'auto' }}
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-white text-black rounded-full hover:bg-gray-200"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      {/* Version Comparison Modal */}
      {showComparison && (
        <PrescriptionComparison
          patientId={patient.id}
          selectedDates={comparisonDates}
          onClose={() => setShowComparison(false)}
        />
      )}

      {/* Removed remedy selection dialog - users now type directly into cells */}
    </div>
  )
} 