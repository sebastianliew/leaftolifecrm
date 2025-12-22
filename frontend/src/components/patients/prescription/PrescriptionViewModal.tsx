"use client"

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FiPrinter, FiEdit2, FiX } from 'react-icons/fi'
import { format, parseISO } from 'date-fns'
import type { Prescription } from '@/types/prescription'

interface PrescriptionViewModalProps {
  open: boolean
  onClose: () => void
  prescription: Prescription | null
  onEdit?: () => void
  onPrint?: () => void
}

export default function PrescriptionViewModal({
  open,
  onClose,
  prescription,
  onEdit,
  onPrint
}: PrescriptionViewModalProps) {
  if (!prescription) return null

  const remedyCount = Object.values(prescription.dailySchedule).reduce((total, meal) => 
    total + Object.values(meal).reduce((mealTotal: number, timing: unknown) => {
      if (Array.isArray(timing)) {
        return mealTotal + timing.length;
      }
      return mealTotal;
    }, 0
    ), 0
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Prescription Details</DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                {prescription.patientName} - {prescription.date}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onEdit && (
                <Button onClick={onEdit} variant="outline" size="sm">
                  <FiEdit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {onPrint && (
                <Button onClick={onPrint} variant="outline" size="sm">
                  <FiPrinter className="h-4 w-4 mr-2" />
                  Print
                </Button>
              )}
              <Button onClick={onClose} variant="ghost" size="sm">
                <FiX className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-1">
            {/* Summary Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge className={
                      prescription.status === 'active' 
                        ? 'bg-green-100 text-green-800 mt-1' 
                        : prescription.status === 'draft'
                        ? 'bg-yellow-100 text-yellow-800 mt-1'
                        : 'bg-gray-100 text-gray-800 mt-1'
                    }>
                      {prescription.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Practitioner</p>
                    <p className="font-medium">{prescription.practitionerName.split(',')[0]}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Remedies</p>
                    <p className="font-medium">{remedyCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Last Updated</p>
                    <p className="font-medium">{format(parseISO(prescription.updatedAt), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Remedy Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Remedy Schedule</CardTitle>
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
                      {/* Group remedies by name */}
                      {(() => {
                        const remedyMap = new Map<string, Record<string, string>>()
                        
                        // Collect all remedies and group by name
                        const meals = ['breakfast', 'lunch', 'dinner'] as const
                        const timings = ['before', 'during', 'after'] as const
                        
                        meals.forEach(meal => {
                          timings.forEach(timing => {
                            prescription.dailySchedule[meal][timing].forEach(remedy => {
                              if (!remedyMap.has(remedy.name)) {
                                remedyMap.set(remedy.name, {})
                              }
                              remedyMap.get(remedy.name)![`${meal}-${timing}`] = remedy.instructions || remedy.dosage || ''
                            })
                          })
                        })
                        
                        // Render rows
                        return Array.from(remedyMap.entries()).map(([name, schedule], index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium bg-gray-50 border-r">
                              <div className="text-sm px-2 py-1">{name}</div>
                            </TableCell>
                            {meals.map(meal => (
                              timings.map(timing => {
                                const key = `${meal}-${timing}`
                                const content = schedule[key] || ''
                                
                                return (
                                  <TableCell key={key} className="p-0 border align-top" style={{ minWidth: '150px' }}>
                                    <div className="min-h-[80px] p-3 text-sm" style={{ lineHeight: '1.4' }}>
                                      {content || <span className="text-gray-400 italic">-</span>}
                                    </div>
                                  </TableCell>
                                )
                              })
                            ))}
                          </TableRow>
                        ))
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Special Instructions */}
            {prescription.specialInstructions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Special Instructions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {prescription.specialInstructions.map(instruction => (
                      <div key={instruction.id} className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                        <p className="text-sm">{instruction.instruction}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Advice */}
            {(prescription.dietaryAdvice.length > 0 || prescription.lifestyleAdvice.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Advice</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {prescription.dietaryAdvice.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3 text-green-700">Dietary Advice</h4>
                        <div className="space-y-2">
                          {prescription.dietaryAdvice.map((advice, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <span className="text-green-600 mt-0.5">•</span>
                              <span className="text-sm">{advice}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {prescription.lifestyleAdvice.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3 text-blue-700">Lifestyle Advice</h4>
                        <div className="space-y-2">
                          {prescription.lifestyleAdvice.map((advice, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <span className="text-blue-600 mt-0.5">•</span>
                              <span className="text-sm">{advice}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}