"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FiX, FiChevronDown, FiDownload, FiEye, FiEyeOff } from 'react-icons/fi'
import { format, parseISO } from 'date-fns'
import { PrescriptionVersion } from '@/types/prescription'
import { PrescriptionVersionManager } from '@/lib/prescription-versioning'

interface PrescriptionComparisonProps {
  patientId: string
  selectedDates: string[]
  onClose: () => void
  className?: string
}

interface DiffItem {
  field: string
  versions: Array<{
    date: string
    value: unknown
    isChange?: boolean
  }>
  changeType?: 'added' | 'modified' | 'removed'
}

export default function PrescriptionComparison({
  patientId,
  selectedDates,
  onClose,
  className = ""
}: PrescriptionComparisonProps) {
  const [versions, setVersions] = useState<PrescriptionVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false)
  const [overlayOpacity, setOverlayOpacity] = useState(0.5)
  const [splitPosition, setSplitPosition] = useState(50)

  useEffect(() => {
    const loadVersions = async () => {
      try {
        setLoading(true)
        const loadedVersions = selectedDates
          .map(date => PrescriptionVersionManager.getVersionByDate(patientId, date))
          .filter(v => v !== null) as PrescriptionVersion[]
        
        // Sort by date
        loadedVersions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        setVersions(loadedVersions)
      } catch (error) {
        console.error('Failed to load versions for comparison:', error)
      } finally {
        setLoading(false)
      }
    }

    loadVersions()
  }, [patientId, selectedDates])

  const generateComparison = (): DiffItem[] => {
    if (versions.length < 2) return []

    const diffItems: DiffItem[] = []
    const baseVersion = versions[0]

    // Compare basic fields
    const basicFields = [
      { key: 'practitionerName', label: 'Practitioner' },
      { key: 'date', label: 'Date' },
      { key: 'status', label: 'Status' }
    ]

    basicFields.forEach(({ key, label }) => {
      const versionValues = versions.map(v => ({
        date: v.date,
        value: v.prescription[key as keyof typeof v.prescription],
        isChange: v.prescription[key as keyof typeof v.prescription] !== baseVersion.prescription[key as keyof typeof baseVersion.prescription]
      }))

      if (!showOnlyDifferences || versionValues.some(v => v.isChange)) {
        diffItems.push({
          field: label,
          versions: versionValues
        })
      }
    })

    // Compare remedy schedules
    const meals = ['breakfast', 'lunch', 'dinner'] as const
    const timings = ['before', 'during', 'after'] as const

    meals.forEach(meal => {
      timings.forEach(timing => {
        const versionValues = versions.map(v => {
          const remedies = v.prescription.dailySchedule[meal][timing] || []
          const remedyText = remedies.map(r => `${r.name}: ${r.instructions}`).join('; ')
          const baseRemedies = baseVersion.prescription.dailySchedule[meal][timing] || []
          const baseText = baseRemedies.map(r => `${r.name}: ${r.instructions}`).join('; ')
          
          return {
            date: v.date,
            value: remedyText,
            isChange: remedyText !== baseText
          }
        })

        if (!showOnlyDifferences || versionValues.some(v => v.isChange)) {
          diffItems.push({
            field: `${meal.charAt(0).toUpperCase() + meal.slice(1)} - ${timing}`,
            versions: versionValues
          })
        }
      })
    })

    // Compare special instructions
    const instructionValues = versions.map(v => {
      const instructions = v.prescription.specialInstructions.map(i => i.instruction).join('; ')
      const baseInstructions = baseVersion.prescription.specialInstructions.map(i => i.instruction).join('; ')
      
      return {
        date: v.date,
        value: instructions,
        isChange: instructions !== baseInstructions
      }
    })

    if (!showOnlyDifferences || instructionValues.some(v => v.isChange)) {
      diffItems.push({
        field: 'Special Instructions',
        versions: instructionValues
      })
    }

    // Compare dietary advice
    const dietaryValues = versions.map(v => {
      const advice = v.prescription.dietaryAdvice.join('; ')
      const baseAdvice = baseVersion.prescription.dietaryAdvice.join('; ')
      
      return {
        date: v.date,
        value: advice,
        isChange: advice !== baseAdvice
      }
    })

    if (!showOnlyDifferences || dietaryValues.some(v => v.isChange)) {
      diffItems.push({
        field: 'Dietary Advice',
        versions: dietaryValues
      })
    }

    // Compare lifestyle advice
    const lifestyleValues = versions.map(v => {
      const advice = v.prescription.lifestyleAdvice.join('; ')
      const baseAdvice = baseVersion.prescription.lifestyleAdvice.join('; ')
      
      return {
        date: v.date,
        value: advice,
        isChange: advice !== baseAdvice
      }
    })

    if (!showOnlyDifferences || lifestyleValues.some(v => v.isChange)) {
      diffItems.push({
        field: 'Lifestyle Advice',
        versions: lifestyleValues
      })
    }

    return diffItems
  }


  const renderPrescriptionContent = (version: PrescriptionVersion, isOverlay = false) => {
    const p = version.prescription
    
    return (
      <div className={`space-y-6 ${isOverlay ? 'mix-blend-multiply' : ''}`}>
        {/* Daily Schedule */}
        <div>
          <h4 className="font-semibold mb-3">Daily Schedule</h4>
          <div className="grid grid-cols-3 gap-4">
            {(['breakfast', 'lunch', 'dinner'] as const).map(meal => (
              <div key={meal} className="space-y-2">
                <h5 className="font-medium capitalize">{meal}</h5>
                {(['before', 'during', 'after'] as const).map(timing => {
                  const remedies = p.dailySchedule[meal][timing]
                  return (
                    <div key={timing} className="text-sm">
                      <span className="text-gray-500 capitalize">{timing}:</span>
                      {remedies.length > 0 ? (
                        <ul className="mt-1 space-y-1">
                          {remedies.map(r => (
                            <li key={r.id} className="ml-4">
                              • {r.name}: {r.instructions}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="ml-2 text-gray-400 italic">None</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        
        {/* Special Instructions */}
        {p.specialInstructions.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Special Instructions</h4>
            <div className="space-y-2">
              {p.specialInstructions.map(inst => (
                <div key={inst.id} className="p-2 bg-yellow-50 rounded">
                  {inst.instruction}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Dietary Advice */}
        {p.dietaryAdvice.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Dietary Advice</h4>
            <ul className="space-y-1">
              {p.dietaryAdvice.map((advice, idx) => (
                <li key={idx}>• {advice}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Lifestyle Advice */}
        {p.lifestyleAdvice.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Lifestyle Advice</h4>
            <ul className="space-y-1">
              {p.lifestyleAdvice.map((advice, idx) => (
                <li key={idx}>• {advice}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const exportComparison = () => {
    const comparison = generateComparison()
    const csvContent = [
      ['Field', ...versions.map(v => format(parseISO(v.date), 'dd MMM yyyy'))],
      ...comparison.map(item => [
        item.field,
        ...item.versions.map(v => `"${v.value || ''}"`)
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prescription-comparison-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const diffItems = generateComparison()

  if (loading) {
    return (
      <Card className={`fixed inset-4 z-50 ${className}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Loading Comparison...</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <FiX className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className={`w-full max-w-7xl h-[90vh] flex flex-col ${className}`}>
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Prescription Comparison</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Comparing {versions.length} versions from {format(parseISO(versions[0].date), 'dd MMM yyyy')} to {format(parseISO(versions[versions.length - 1].date), 'dd MMM yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOnlyDifferences(!showOnlyDifferences)}
              >
                {showOnlyDifferences ? (
                  <>
                    <FiEye className="h-4 w-4 mr-2" />
                    Show All
                  </>
                ) : (
                  <>
                    <FiEyeOff className="h-4 w-4 mr-2" />
                    Differences Only
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={exportComparison}>
                <FiDownload className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <FiX className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden">
          <Tabs defaultValue="side-by-side" className="h-full flex flex-col">
            <TabsList className="flex-shrink-0">
              <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
              <TabsTrigger value="split-screen">Split Screen</TabsTrigger>
              <TabsTrigger value="overlay">Overlay</TabsTrigger>
              <TabsTrigger value="changes">Change Log</TabsTrigger>
            </TabsList>

            <TabsContent value="side-by-side" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  {/* Version Headers */}
                  <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${versions.length}, 1fr)` }}>
                    <div className="font-medium text-gray-500">Field</div>
                    {versions.map(version => (
                      <div key={version.id} className="text-center">
                        <div className="font-medium">{format(parseISO(version.date), 'dd MMM yyyy')}</div>
                        <Badge variant="outline" className="mt-1">
                          v{version.version}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  {/* Comparison Rows */}
                  {diffItems.map((item) => (
                    <div
                      key={item.field}
                      className={`grid gap-4 p-3 rounded-lg border ${
                        item.versions.some(v => v.isChange) ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'
                      }`}
                      style={{ gridTemplateColumns: `200px repeat(${versions.length}, 1fr)` }}
                    >
                      <div className="font-medium text-sm">{item.field}</div>
                      {item.versions.map((versionData, vIndex) => (
                        <div
                          key={vIndex}
                          className={`text-sm p-2 rounded ${
                            versionData.isChange
                              ? 'bg-yellow-100 border border-yellow-300'
                              : 'bg-white border border-gray-200'
                          }`}
                        >
                          {typeof versionData.value === 'object' && versionData.value !== null 
                            ? JSON.stringify(versionData.value) 
                            : (versionData.value ? String(versionData.value) : <span className="text-gray-400 italic">Empty</span>)}
                        </div>
                      ))}
                    </div>
                  ))}

                  {diffItems.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">
                        {showOnlyDifferences ? 'No differences found between selected versions' : 'No data to compare'}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="split-screen" className="flex-1 overflow-hidden">
              <div className="h-full flex">
                {versions.length >= 2 && (
                  <>
                    <div 
                      className="overflow-auto border-r-2 border-gray-300"
                      style={{ width: `${splitPosition}%` }}
                    >
                      <div className="p-4">
                        <h3 className="font-medium mb-4 sticky top-0 bg-white pb-2">
                          {format(parseISO(versions[0].date), 'dd MMM yyyy')} - v{versions[0].version}
                        </h3>
                        {renderPrescriptionContent(versions[0])}
                      </div>
                    </div>
                    
                    {/* Draggable divider */}
                    <div
                      className="w-1 bg-gray-300 cursor-col-resize hover:bg-blue-500 transition-colors"
                      onMouseDown={(e) => {
                        const startX = e.pageX
                        const startSplit = splitPosition
                        const containerElement = e.currentTarget.parentElement
                        
                        const handleMouseMove = (e: MouseEvent) => {
                          const diff = e.pageX - startX
                          const containerWidth = containerElement?.offsetWidth || 1000
                          const newSplit = Math.max(20, Math.min(80, startSplit + (diff / containerWidth) * 100))
                          setSplitPosition(newSplit)
                        }
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove)
                          document.removeEventListener('mouseup', handleMouseUp)
                        }
                        
                        document.addEventListener('mousemove', handleMouseMove)
                        document.addEventListener('mouseup', handleMouseUp)
                      }}
                    />
                    
                    <div 
                      className="overflow-auto flex-1"
                      style={{ width: `${100 - splitPosition}%` }}
                    >
                      <div className="p-4">
                        <h3 className="font-medium mb-4 sticky top-0 bg-white pb-2">
                          {format(parseISO(versions[1].date), 'dd MMM yyyy')} - v{versions[1].version}
                        </h3>
                        {renderPrescriptionContent(versions[1])}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="overlay" className="flex-1 overflow-hidden">
              {versions.length >= 2 && (
                <div className="h-full relative">
                  <div className="absolute top-0 right-0 z-10 p-4 bg-white rounded-bl-lg shadow-lg">
                    <label className="text-sm font-medium">Overlay Opacity</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={overlayOpacity * 100}
                      onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
                      className="w-32 ml-2"
                    />
                  </div>
                  
                  <ScrollArea className="h-full">
                    <div className="relative p-4">
                      {/* Base version */}
                      <div className="relative">
                        <h3 className="font-medium mb-4">
                          Base: {format(parseISO(versions[0].date), 'dd MMM yyyy')} - v{versions[0].version}
                        </h3>
                        {renderPrescriptionContent(versions[0])}
                      </div>
                      
                      {/* Overlay version */}
                      <div 
                        className="absolute inset-0 p-4 pointer-events-none"
                        style={{ opacity: overlayOpacity }}
                      >
                        <h3 className="font-medium mb-4 text-blue-600">
                          Overlay: {format(parseISO(versions[1].date), 'dd MMM yyyy')} - v{versions[1].version}
                        </h3>
                        <div className="text-blue-600">
                          {renderPrescriptionContent(versions[1], true)}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </TabsContent>

            <TabsContent value="changes" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  {versions.slice(1).map(version => (
                    <Collapsible key={version.id}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                          <div className="text-left">
                            <div className="font-medium">
                              {format(parseISO(version.date), 'dd MMM yyyy')} - v{version.version}
                            </div>
                            <div className="text-sm text-gray-600">{version.summary}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{version.changes.length} changes</Badge>
                            <FiChevronDown className="h-4 w-4" />
                          </div>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="px-4 pb-4">
                        <div className="space-y-2">
                          {version.changes.map((change, index) => (
                            <div
                              key={index}
                              className={`p-3 rounded border-l-4 ${
                                change.changeType === 'added'
                                  ? 'bg-green-50 border-green-400'
                                  : change.changeType === 'removed'
                                  ? 'bg-red-50 border-red-400'
                                  : 'bg-blue-50 border-blue-400'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Badge
                                  className={
                                    change.changeType === 'added'
                                      ? 'bg-green-100 text-green-800'
                                      : change.changeType === 'removed'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }
                                >
                                  {change.changeType}
                                </Badge>
                                <span className="text-sm font-medium">{change.field}</span>
                              </div>
                              
                              {change.changeType === 'modified' && (
                                <div className="space-y-1 text-sm">
                                  <div className="text-red-600">
                                    <span className="font-medium">Before:</span> {String(change.oldValue || 'Empty')}
                                  </div>
                                  <div className="text-green-600">
                                    <span className="font-medium">After:</span> {String(change.newValue || 'Empty')}
                                  </div>
                                </div>
                              )}
                              
                              {change.changeType === 'added' && (
                                <div className="text-sm text-green-600">
                                  <span className="font-medium">Added:</span> {String(change.newValue)}
                                </div>
                              )}
                              
                              {change.changeType === 'removed' && (
                                <div className="text-sm text-red-600">
                                  <span className="font-medium">Removed:</span> {String(change.oldValue)}
                                </div>
                              )}

                              {change.reason && (
                                <div className="text-sm text-gray-600 mt-2">
                                  <span className="font-medium">Reason:</span> {change.reason}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}

                  {versions.length <= 1 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">Need at least 2 versions to show changes</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}