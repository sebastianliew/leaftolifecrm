"use client"

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FiCalendar, FiCopy, FiRepeat, FiAlertCircle } from 'react-icons/fi'
import { format, addDays, addWeeks, addMonths, eachDayOfInterval, isWeekend } from 'date-fns'
import { Prescription } from '@/types/prescription'
import { PrescriptionVersionManager } from '@/lib/prescription-versioning'
import { useToast } from '@/components/ui/use-toast'

interface PrescriptionBulkOperationsProps {
  patientId: string
  currentPrescription: Prescription
  onComplete: () => void
  className?: string
}

interface DateRangeTemplate {
  id: string
  name: string
  description: string
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
  duration: number
  unit: 'days' | 'weeks' | 'months'
  skipWeekends?: boolean
}

const templates: DateRangeTemplate[] = [
  {
    id: 'weekly',
    name: 'Weekly Follow-up',
    description: 'Copy prescription for next 4 weeks',
    frequency: 'weekly',
    duration: 4,
    unit: 'weeks'
  },
  {
    id: 'biweekly',
    name: 'Bi-weekly Treatment',
    description: 'Copy prescription every 2 weeks for 2 months',
    frequency: 'biweekly',
    duration: 2,
    unit: 'months'
  },
  {
    id: 'monthly',
    name: 'Monthly Review',
    description: 'Copy prescription monthly for 3 months',
    frequency: 'monthly',
    duration: 3,
    unit: 'months'
  },
  {
    id: 'daily-weekdays',
    name: 'Daily (Weekdays)',
    description: 'Copy prescription for weekdays only',
    frequency: 'daily',
    duration: 2,
    unit: 'weeks',
    skipWeekends: true
  }
]

export default function PrescriptionBulkOperations({
  patientId,
  currentPrescription,
  onComplete,
  className = ""
}: PrescriptionBulkOperationsProps) {
  const { toast } = useToast()
  const [showDialog, setShowDialog] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(new Date())
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(addWeeks(new Date(), 2))
  const [skipWeekends, setSkipWeekends] = useState(false)
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [bulkOptions, setBulkOptions] = useState({
    copyRemedies: true,
    copyInstructions: true,
    copyDietaryAdvice: true,
    copyLifestyleAdvice: true,
    createAsDraft: false
  })

  const generateDatesFromTemplate = (template: DateRangeTemplate): Date[] => {
    const dates: Date[] = []
    const startDate = new Date()
    
    switch (template.frequency) {
      case 'daily': {
        const endDate = template.unit === 'days' 
          ? addDays(startDate, template.duration)
          : template.unit === 'weeks'
          ? addWeeks(startDate, template.duration)
          : addMonths(startDate, template.duration)
          
        const allDays = eachDayOfInterval({ start: startDate, end: endDate })
        return template.skipWeekends 
          ? allDays.filter(date => !isWeekend(date))
          : allDays
      }
          
      case 'weekly':
        for (let i = 1; i <= template.duration; i++) {
          dates.push(addWeeks(startDate, i))
        }
        return dates
        
      case 'biweekly': {
        const biweeklyCount = template.unit === 'months' 
          ? template.duration * 2
          : template.duration
        for (let i = 1; i <= biweeklyCount; i++) {
          dates.push(addWeeks(startDate, i * 2))
        }
        return dates
      }
        
      case 'monthly':
        for (let i = 1; i <= template.duration; i++) {
          dates.push(addMonths(startDate, i))
        }
        return dates
        
      default:
        return dates
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = templates.find(t => t.id === templateId)
    if (template) {
      const dates = generateDatesFromTemplate(template)
      setSelectedDates(dates)
      setSkipWeekends(template.skipWeekends || false)
    }
  }

  const handleCustomDateRange = () => {
    if (!customStartDate || !customEndDate) return
    
    const dates = eachDayOfInterval({ 
      start: customStartDate, 
      end: customEndDate 
    })
    
    setSelectedDates(
      skipWeekends ? dates.filter(date => !isWeekend(date)) : dates
    )
  }

  const handleBulkCopy = async () => {
    setIsProcessing(true)
    
    try {
      let successCount = 0
      
      for (const date of selectedDates) {
        const dateStr = format(date, 'yyyy-MM-dd')
        
        // Check if prescription already exists for this date
        const existingVersion = PrescriptionVersionManager.getVersionByDate(patientId, dateStr)
        if (existingVersion) {
          continue // Skip dates that already have prescriptions
        }
        
        // Create new prescription based on current
        const newPrescription: Prescription = {
          ...currentPrescription,
          id: `prescription-${Date.now()}-${Math.random()}`,
          date: format(date, 'dd-MMM-yyyy'),
          status: bulkOptions.createAsDraft ? 'draft' : currentPrescription.status,
          dailySchedule: bulkOptions.copyRemedies 
            ? currentPrescription.dailySchedule 
            : {
                breakfast: { before: [], during: [], after: [] },
                lunch: { before: [], during: [], after: [] },
                dinner: { before: [], during: [], after: [] }
              },
          specialInstructions: bulkOptions.copyInstructions 
            ? currentPrescription.specialInstructions 
            : [],
          dietaryAdvice: bulkOptions.copyDietaryAdvice 
            ? currentPrescription.dietaryAdvice 
            : [],
          lifestyleAdvice: bulkOptions.copyLifestyleAdvice 
            ? currentPrescription.lifestyleAdvice 
            : [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        // Save the new prescription
        PrescriptionVersionManager.saveVersion(patientId, newPrescription, [
          {
            field: 'bulk_copy',
            oldValue: null,
            newValue: `Copied from ${currentPrescription.date}`,
            timestamp: new Date().toISOString(),
            changeType: 'added',
            reason: 'Bulk operation'
          }
        ])
        
        successCount++
      }
      
      toast({
        title: 'Bulk Copy Complete',
        description: `Successfully created ${successCount} prescriptions`,
      })
      
      setShowDialog(false)
      onComplete()
      
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to complete bulk copy operation',
        variant: 'destructive'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        className={className}
      >
        <FiRepeat className="h-4 w-4 mr-2" />
        Bulk Copy
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Copy Prescription</DialogTitle>
            <DialogDescription>
              Create multiple prescriptions based on the current one
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Template Selection */}
            <div className="space-y-3">
              <Label>Select Template</Label>
              <div className="grid grid-cols-2 gap-3">
                {templates.map(template => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-all ${
                      selectedTemplate === template.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'hover:border-gray-400'
                    }`}
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    <CardHeader className="p-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                        {selectedTemplate === template.id && (
                          <Badge className="bg-blue-500">Selected</Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            <div className="space-y-3">
              <Label>Or Choose Custom Date Range</Label>
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <FiCalendar className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, 'PP') : 'Start date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <span>to</span>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <FiCalendar className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, 'PP') : 'End date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <Button 
                  onClick={handleCustomDateRange}
                  variant="secondary"
                >
                  Apply
                </Button>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="skip-weekends"
                  checked={skipWeekends}
                  onCheckedChange={setSkipWeekends}
                />
                <Label htmlFor="skip-weekends">Skip weekends</Label>
              </div>
            </div>

            {/* Copy Options */}
            <div className="space-y-3">
              <Label>Copy Options</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="copy-remedies"
                    checked={bulkOptions.copyRemedies}
                    onCheckedChange={(checked) => 
                      setBulkOptions(prev => ({ ...prev, copyRemedies: checked as boolean }))
                    }
                  />
                  <Label htmlFor="copy-remedies" className="text-sm">Copy remedy schedule</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="copy-instructions"
                    checked={bulkOptions.copyInstructions}
                    onCheckedChange={(checked) => 
                      setBulkOptions(prev => ({ ...prev, copyInstructions: checked as boolean }))
                    }
                  />
                  <Label htmlFor="copy-instructions" className="text-sm">Copy special instructions</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="copy-dietary"
                    checked={bulkOptions.copyDietaryAdvice}
                    onCheckedChange={(checked) => 
                      setBulkOptions(prev => ({ ...prev, copyDietaryAdvice: checked as boolean }))
                    }
                  />
                  <Label htmlFor="copy-dietary" className="text-sm">Copy dietary advice</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="copy-lifestyle"
                    checked={bulkOptions.copyLifestyleAdvice}
                    onCheckedChange={(checked) => 
                      setBulkOptions(prev => ({ ...prev, copyLifestyleAdvice: checked as boolean }))
                    }
                  />
                  <Label htmlFor="copy-lifestyle" className="text-sm">Copy lifestyle advice</Label>
                </div>
                
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="create-draft"
                    checked={bulkOptions.createAsDraft}
                    onCheckedChange={(checked) => 
                      setBulkOptions(prev => ({ ...prev, createAsDraft: checked }))
                    }
                  />
                  <Label htmlFor="create-draft">Create as drafts</Label>
                </div>
              </div>
            </div>

            {/* Selected Dates Preview */}
            {selectedDates.length > 0 && (
              <div className="space-y-3">
                <Label>Selected Dates ({selectedDates.length})</Label>
                <div className="max-h-32 overflow-y-auto border rounded-md p-3">
                  <div className="flex flex-wrap gap-2">
                    {selectedDates.map(date => (
                      <Badge key={date.toISOString()} variant="secondary">
                        {format(date, 'MMM d, yyyy')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Warning */}
            <Alert>
              <FiAlertCircle className="h-4 w-4" />
              <AlertDescription>
                Dates that already have prescriptions will be skipped. Only new prescriptions will be created.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkCopy}
              disabled={selectedDates.length === 0 || isProcessing}
            >
              {isProcessing ? (
                <>Processing...</>
              ) : (
                <>
                  <FiCopy className="h-4 w-4 mr-2" />
                  Create {selectedDates.length} Prescriptions
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}