"use client"

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FiCalendar, FiCheck, FiChevronLeft, FiChevronRight, FiCopy, FiPlus, FiTrash2, FiAlertCircle } from 'react-icons/fi'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Patient } from '@/types/patient'
import type { Prescription, PrescriptionRemedy, PrescriptionSpecialInstruction, PrescriptionMeal } from '@/types/prescription'
import { PrescriptionVersionManager } from '@/lib/prescription-versioning'
import { useToast } from '@/components/ui/use-toast'

interface PrescriptionCreateModalProps {
  open: boolean
  onClose: () => void
  patient: Patient
  templatePrescription?: Prescription
  onSave: (prescription: Prescription) => Promise<void>
}

interface StepData {
  date: Date
  status: 'draft' | 'active'
  useTemplate: boolean
  remedyRows: Array<{ id: string; name: string }>
  remedyData: Record<string, Record<string, string>>
  specialInstructions: PrescriptionSpecialInstruction[]
  dietaryAdvice: string[]
  lifestyleAdvice: string[]
}

const STEPS = [
  { id: 1, name: 'Date & Setup', description: 'Choose date and template' },
  { id: 2, name: 'Remedy Schedule', description: 'Add medications and timing' },
  { id: 3, name: 'Instructions', description: 'Special notes and advice' },
  { id: 4, name: 'Review', description: 'Confirm and save' }
]

export default function PrescriptionCreateModal({
  open,
  onClose,
  patient,
  templatePrescription,
  onSave
}: PrescriptionCreateModalProps) {
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  
  const [stepData, setStepData] = useState<StepData>({
    date: new Date(),
    status: 'draft',
    useTemplate: false,
    remedyRows: [{ id: 'row-1', name: 'Remedies' }],
    remedyData: { 'row-1': {} },
    specialInstructions: [],
    dietaryAdvice: [],
    lifestyleAdvice: []
  })

  // Load template data if using template
  useEffect(() => {
    if (stepData.useTemplate && templatePrescription) {
      // Convert prescription remedies back to row format
      const rowData: Record<string, Record<string, string>> = {}
      const rows: Array<{ id: string; name: string }> = []
      const remedyNames = new Set<string>()
      
      // Extract remedies and group by name
      const meals = ['breakfast', 'lunch', 'dinner'] as const
      const timings = ['before', 'during', 'after'] as const
      
      meals.forEach(meal => {
        timings.forEach(timing => {
          const remedies = templatePrescription.dailySchedule[meal][timing]
          remedies.forEach(remedy => {
            if (remedy.name) {
              remedyNames.add(remedy.name)
            }
          })
        })
      })
      
      // Create rows for each unique remedy name
      Array.from(remedyNames).forEach((name, index) => {
        const rowId = `row-${index + 1}`
        rows.push({ id: rowId, name })
        rowData[rowId] = {}
        
        // Populate row data
        meals.forEach(meal => {
          timings.forEach(timing => {
            const remedies = templatePrescription.dailySchedule[meal][timing]
            const remedy = remedies.find(r => r.name === name)
            if (remedy) {
              const key = `${meal}-${timing}`
              rowData[rowId][key] = remedy.instructions || remedy.dosage || ''
            }
          })
        })
      })
      
      if (rows.length === 0) {
        rows.push({ id: 'row-1', name: 'Remedies' })
        rowData['row-1'] = {}
      }
      
      setStepData(prev => ({
        ...prev,
        remedyRows: rows,
        remedyData: rowData,
        specialInstructions: templatePrescription.specialInstructions,
        dietaryAdvice: templatePrescription.dietaryAdvice,
        lifestyleAdvice: templatePrescription.lifestyleAdvice
      }))
    }
  }, [stepData.useTemplate, templatePrescription])

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    
    try {
      // Convert row data to prescription format
      const dailySchedule: PrescriptionMeal = {
        breakfast: { before: [], during: [], after: [] },
        lunch: { before: [], during: [], after: [] },
        dinner: { before: [], during: [], after: [] }
      }

      // Process each row's data
      stepData.remedyRows.forEach((row) => {
        const meals = ['breakfast', 'lunch', 'dinner'] as const
        const timings = ['before', 'during', 'after'] as const
        
        meals.forEach(meal => {
          timings.forEach(timing => {
            const key = `${meal}-${timing}`
            const content = stepData.remedyData[row.id]?.[key] || ''
            
            if (content.trim()) {
              const remedy: PrescriptionRemedy = {
                id: `${row.id}-${meal}-${timing}`,
                name: row.name,
                dosage: '',
                instructions: content.trim(),
                frequency: 'Daily',
                notes: ''
              }
              dailySchedule[meal][timing].push(remedy)
            }
          })
        })
      })

      const prescription: Prescription = {
        id: `prescription-${Date.now()}`,
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        practitionerName: 'Super Admin, ND, MNHAA, MHS (UEA)',
        practitionerCredentials: 'ND, MNHAA, MHS (UEA)',
        date: format(stepData.date, 'dd-MMM-yyyy'),
        dailySchedule,
        specialInstructions: stepData.specialInstructions,
        dietaryAdvice: stepData.dietaryAdvice,
        lifestyleAdvice: stepData.lifestyleAdvice,
        status: stepData.status,
        isActive: stepData.status === 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'current-user'
      }

      await onSave(prescription)
      
      // Save version
      PrescriptionVersionManager.saveVersion(patient.id, prescription, [])
      
      toast({
        title: 'Success',
        description: 'Prescription created successfully'
      })
      
      onClose()
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create prescription',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Date Selection */}
            <div className="space-y-2">
              <Label>Prescription Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !stepData.date && "text-muted-foreground"
                    )}
                  >
                    <FiCalendar className="mr-2 h-4 w-4" />
                    {stepData.date ? format(stepData.date, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={stepData.date}
                    onSelect={(date) => date && setStepData(prev => ({ ...prev, date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Status Selection */}
            <div className="space-y-2">
              <Label>Initial Status</Label>
              <Select 
                value={stepData.status} 
                onValueChange={(value: 'draft' | 'active') => 
                  setStepData(prev => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft - Work in progress</SelectItem>
                  <SelectItem value="active">Active - Ready to use</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Template Option */}
            {templatePrescription && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Use Previous Prescription as Template?</p>
                      <p className="text-sm text-gray-500">
                        Copy remedies and instructions from {templatePrescription.date}
                      </p>
                    </div>
                    <Button
                      variant={stepData.useTemplate ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStepData(prev => ({ ...prev, useTemplate: !prev.useTemplate }))}
                    >
                      {stepData.useTemplate ? (
                        <>
                          <FiCheck className="h-4 w-4 mr-2" />
                          Using Template
                        </>
                      ) : (
                        <>
                          <FiCopy className="h-4 w-4 mr-2" />
                          Use Template
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                Add remedies and specify when they should be taken
              </p>
              <Button
                onClick={() => {
                  const newRow = {
                    id: `row-${Date.now()}`,
                    name: 'New Remedy'
                  }
                  setStepData(prev => ({
                    ...prev,
                    remedyRows: [...prev.remedyRows, newRow],
                    remedyData: { ...prev.remedyData, [newRow.id]: {} }
                  }))
                }}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <FiPlus className="h-4 w-4" />
                Add Remedy
              </Button>
            </div>

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
                  {stepData.remedyRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium bg-gray-50 border-r">
                        <div className="flex items-center justify-between">
                          <Input
                            value={row.name}
                            onChange={(e) => {
                              setStepData(prev => ({
                                ...prev,
                                remedyRows: prev.remedyRows.map(r =>
                                  r.id === row.id ? { ...r, name: e.target.value } : r
                                )
                              }))
                            }}
                            className="border border-gray-300 bg-white px-2 py-1 h-auto text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded"
                            placeholder="Enter remedy name..."
                          />
                          {stepData.remedyRows.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setStepData(prev => ({
                                  ...prev,
                                  remedyRows: prev.remedyRows.filter(r => r.id !== row.id),
                                  remedyData: Object.fromEntries(
                                    Object.entries(prev.remedyData).filter(([key]) => key !== row.id)
                                  )
                                }))
                              }}
                              className="ml-2 h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              <FiTrash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      {['breakfast', 'lunch', 'dinner'].map(meal => (
                        ['before', 'during', 'after'].map(timing => {
                          const key = `${meal}-${timing}`
                          const cellContent = stepData.remedyData[row.id]?.[key] || ''
                          
                          return (
                            <TableCell key={key} className="p-0 border align-top" style={{ minWidth: '150px' }}>
                              <div
                                className="min-h-[100px] p-3 text-sm cursor-text outline-none focus:bg-blue-50 hover:bg-gray-50 overflow-visible"
                                contentEditable={true}
                                suppressContentEditableWarning={true}
                                onBlur={(e) => {
                                  const newContent = e.target.textContent || ''
                                  if (newContent !== cellContent) {
                                    setStepData(prev => ({
                                      ...prev,
                                      remedyData: {
                                        ...prev.remedyData,
                                        [row.id]: {
                                          ...prev.remedyData[row.id],
                                          [key]: newContent
                                        }
                                      }
                                    }))
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
                                  whiteSpace: 'pre-wrap',
                                  minHeight: '100px'
                                }}
                                dangerouslySetInnerHTML={{ __html: cellContent }}
                              />
                            </TableCell>
                          )
                        })
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            {/* Special Instructions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Special Instructions</Label>
                <Button
                  onClick={() => {
                    setStepData(prev => ({
                      ...prev,
                      specialInstructions: [...prev.specialInstructions, {
                        id: `inst-${Date.now()}`,
                        category: 'general',
                        instruction: '',
                        priority: 'medium'
                      }]
                    }))
                  }}
                  variant="outline"
                  size="sm"
                >
                  <FiPlus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
              {stepData.specialInstructions.map((inst, index) => (
                <div key={inst.id} className="flex gap-2">
                  <Textarea
                    value={inst.instruction}
                    onChange={(e) => {
                      setStepData(prev => ({
                        ...prev,
                        specialInstructions: prev.specialInstructions.map((item, i) =>
                          i === index ? { ...item, instruction: e.target.value } : item
                        )
                      }))
                    }}
                    placeholder="Enter special instruction..."
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStepData(prev => ({
                        ...prev,
                        specialInstructions: prev.specialInstructions.filter((_, i) => i !== index)
                      }))
                    }}
                  >
                    <FiTrash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Dietary Advice */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Dietary Advice</Label>
                <Button
                  onClick={() => {
                    setStepData(prev => ({
                      ...prev,
                      dietaryAdvice: [...prev.dietaryAdvice, '']
                    }))
                  }}
                  variant="outline"
                  size="sm"
                >
                  <FiPlus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
              {stepData.dietaryAdvice.map((advice, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={advice}
                    onChange={(e) => {
                      setStepData(prev => ({
                        ...prev,
                        dietaryAdvice: prev.dietaryAdvice.map((item, i) =>
                          i === index ? e.target.value : item
                        )
                      }))
                    }}
                    placeholder="Enter dietary advice..."
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStepData(prev => ({
                        ...prev,
                        dietaryAdvice: prev.dietaryAdvice.filter((_, i) => i !== index)
                      }))
                    }}
                  >
                    <FiTrash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Lifestyle Advice */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Lifestyle Advice</Label>
                <Button
                  onClick={() => {
                    setStepData(prev => ({
                      ...prev,
                      lifestyleAdvice: [...prev.lifestyleAdvice, '']
                    }))
                  }}
                  variant="outline"
                  size="sm"
                >
                  <FiPlus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
              {stepData.lifestyleAdvice.map((advice, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={advice}
                    onChange={(e) => {
                      setStepData(prev => ({
                        ...prev,
                        lifestyleAdvice: prev.lifestyleAdvice.map((item, i) =>
                          i === index ? e.target.value : item
                        )
                      }))
                    }}
                    placeholder="Enter lifestyle advice..."
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStepData(prev => ({
                        ...prev,
                        lifestyleAdvice: prev.lifestyleAdvice.filter((_, i) => i !== index)
                      }))
                    }}
                  >
                    <FiTrash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FiAlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-blue-900">Ready to Save</p>
                  <p className="text-sm text-blue-700">
                    Please review the prescription details below before saving.
                  </p>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{format(stepData.date, 'PPP')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge className={
                    stepData.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }>
                    {stepData.status}
                  </Badge>
                </div>
              </div>

              {/* Remedies Summary */}
              <div>
                <p className="font-medium mb-2">Remedies</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  {stepData.remedyRows.map(row => {
                    const hasData = Object.values(stepData.remedyData[row.id] || {}).some(v => v)
                    return hasData ? (
                      <div key={row.id}>
                        <span className="font-medium">{row.name}</span>
                      </div>
                    ) : null
                  })}
                </div>
              </div>

              {/* Instructions Summary */}
              {stepData.specialInstructions.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Special Instructions</p>
                  <div className="bg-yellow-50 rounded-lg p-3 space-y-1">
                    {stepData.specialInstructions.map(inst => (
                      <p key={inst.id} className="text-sm">• {inst.instruction}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Advice Summary */}
              <div className="grid grid-cols-2 gap-4">
                {stepData.dietaryAdvice.length > 0 && (
                  <div>
                    <p className="font-medium mb-2">Dietary Advice</p>
                    <div className="bg-green-50 rounded-lg p-3 space-y-1">
                      {stepData.dietaryAdvice.map((advice, i) => (
                        <p key={i} className="text-sm">• {advice}</p>
                      ))}
                    </div>
                  </div>
                )}
                {stepData.lifestyleAdvice.length > 0 && (
                  <div>
                    <p className="font-medium mb-2">Lifestyle Advice</p>
                    <div className="bg-blue-50 rounded-lg p-3 space-y-1">
                      {stepData.lifestyleAdvice.map((advice, i) => (
                        <p key={i} className="text-sm">• {advice}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Prescription</DialogTitle>
          <DialogDescription>
            {patient.firstName} {patient.lastName}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={(currentStep / STEPS.length) * 100} className="h-2" />
          <div className="flex justify-between text-sm text-gray-500">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-2",
                  step.id === currentStep && "text-blue-600 font-medium",
                  step.id < currentStep && "text-green-600"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                  step.id === currentStep && "bg-blue-100 text-blue-600",
                  step.id < currentStep && "bg-green-100 text-green-600",
                  step.id > currentStep && "bg-gray-100 text-gray-400"
                )}>
                  {step.id < currentStep ? <FiCheck className="h-3 w-3" /> : step.id}
                </div>
                <span className="hidden md:inline">{step.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {renderStepContent()}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? onClose : handleBack}
          >
            {currentStep === 1 ? 'Cancel' : (
              <>
                <FiChevronLeft className="h-4 w-4 mr-2" />
                Back
              </>
            )}
          </Button>
          
          {currentStep < STEPS.length ? (
            <Button onClick={handleNext}>
              Next
              <FiChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Prescription'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}