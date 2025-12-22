"use client"

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FiCalendar, FiCopy, FiEye, FiMoreVertical, FiPrinter, FiSearch, FiFilter, FiTrash2 } from 'react-icons/fi'
import { format, parseISO, subDays, isWithinInterval } from 'date-fns'
import type { Patient } from '@/types/patient'
import type { PrescriptionVersion } from '@/types/prescription'
import { PrescriptionVersionManager } from '@/lib/prescription-versioning'
import { cn } from '@/lib/utils'

interface PrescriptionHistoryProps {
  open: boolean
  onClose: () => void
  patient: Patient
  onViewPrescription: (date: string) => void
  onCopyPrescription: (date: string) => void
  onCompare: (dates: string[]) => void
  onPrint: (date: string) => void
}

export default function PrescriptionHistory({
  open,
  onClose,
  patient,
  onViewPrescription,
  onCopyPrescription,
  onCompare,
  onPrint
}: PrescriptionHistoryProps) {
  const [versions, setVersions] = useState<PrescriptionVersion[]>([])
  const [filteredVersions, setFilteredVersions] = useState<PrescriptionVersion[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | '90days'>('all')
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list')

  useEffect(() => {
    const allVersions = PrescriptionVersionManager.getAllVersions(patient.id)
    setVersions(allVersions)
    setFilteredVersions(allVersions)
  }, [patient.id])

  useEffect(() => {
    let filtered = [...versions]

    // Apply date filter
    if (dateFilter !== 'all') {
      const days = dateFilter === '7days' ? 7 : dateFilter === '30days' ? 30 : 90
      const startDate = subDays(new Date(), days)
      filtered = filtered.filter(v => 
        isWithinInterval(parseISO(v.date), { start: startDate, end: new Date() })
      )
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(v => 
        v.prescription.practitionerName.toLowerCase().includes(term) ||
        v.prescription.status.toLowerCase().includes(term) ||
        v.summary.toLowerCase().includes(term) ||
        format(parseISO(v.date), 'PPP').toLowerCase().includes(term)
      )
    }

    setFilteredVersions(filtered)
  }, [versions, searchTerm, dateFilter])

  const handleSelectVersion = (date: string) => {
    setSelectedVersions(prev => {
      if (prev.includes(date)) {
        return prev.filter(d => d !== date)
      } else if (prev.length < 2) {
        return [...prev, date]
      }
      return prev
    })
  }

  const renderListView = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12"></TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Changes</TableHead>
          <TableHead>Remedies</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredVersions.map((version) => {
          const remedyCount = Object.values(version.prescription.dailySchedule).reduce((total, meal) => 
            total + Object.values(meal).reduce((mealTotal: number, timing: unknown) => {
              if (Array.isArray(timing)) {
                return mealTotal + timing.length;
              }
              return mealTotal;
            }, 0
            ), 0
          )
          
          return (
            <TableRow key={version.id}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedVersions.includes(version.date)}
                  onChange={() => handleSelectVersion(version.date)}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </TableCell>
              <TableCell className="font-medium">
                {format(parseISO(version.date), 'MMM d, yyyy')}
              </TableCell>
              <TableCell>
                <Badge className={
                  version.prescription.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : version.prescription.status === 'draft'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }>
                  {version.prescription.status}
                </Badge>
              </TableCell>
              <TableCell>{version.changes.length}</TableCell>
              <TableCell>{remedyCount}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <FiMoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      onViewPrescription(version.date)
                      onClose()
                    }}>
                      <FiEye className="h-4 w-4 mr-2" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      onCopyPrescription(version.date)
                      onClose()
                    }}>
                      <FiCopy className="h-4 w-4 mr-2" />
                      Copy as Template
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPrint(version.date)}>
                      <FiPrinter className="h-4 w-4 mr-2" />
                      Print
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this prescription?')) {
                          PrescriptionVersionManager.deleteVersion(patient.id, version.date)
                          setVersions(prev => prev.filter(v => v.date !== version.date))
                        }
                      }}
                      className="text-red-600"
                    >
                      <FiTrash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )

  const renderTimelineView = () => (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4 p-4">
        {filteredVersions.map((version, index) => {
          const isFirst = index === 0
          const remedyCount = Object.values(version.prescription.dailySchedule).reduce((total, meal) => 
            total + Object.values(meal).reduce((mealTotal: number, timing: unknown) => {
              if (Array.isArray(timing)) {
                return mealTotal + timing.length;
              }
              return mealTotal;
            }, 0
            ), 0
          )
          
          return (
            <div key={version.id} className="relative">
              {/* Timeline connector */}
              {index < filteredVersions.length - 1 && (
                <div className="absolute left-4 top-12 w-0.5 h-12 bg-gray-300" />
              )}
              
              <Card className={cn(
                "cursor-pointer transition-all",
                selectedVersions.includes(version.date) && "ring-2 ring-blue-500"
              )}
              onClick={() => handleSelectVersion(version.date)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Timeline dot */}
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                      isFirst ? "bg-blue-500 text-white" : "bg-gray-400 text-white"
                    )}>
                      {version.version}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">
                          {format(parseISO(version.date), 'd MMMM yyyy')}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge className={
                            version.prescription.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : version.prescription.status === 'draft'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }>
                            {version.prescription.status}
                          </Badge>
                          {isFirst && (
                            <Badge className="bg-blue-100 text-blue-800">Latest</Badge>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">{version.summary}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FiCalendar className="h-3 w-3" />
                          {remedyCount} remedies
                        </span>
                        <span>{version.changes.length} changes</span>
                      </div>
                      
                      {/* Quick Actions */}
                      <div className="flex gap-2 mt-3">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onViewPrescription(version.date)
                            onClose()
                          }}
                        >
                          <FiEye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onCopyPrescription(version.date)
                            onClose()
                          }}
                        >
                          <FiCopy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Prescription History</DialogTitle>
          <DialogDescription>
            {patient.firstName} {patient.lastName} - {versions.length} prescriptions
          </DialogDescription>
        </DialogHeader>

        {/* Filters and Search */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search prescriptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <FiFilter className="h-4 w-4" />
                  {dateFilter === 'all' ? 'All Time' : 
                   dateFilter === '7days' ? 'Last 7 Days' :
                   dateFilter === '30days' ? 'Last 30 Days' : 'Last 90 Days'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setDateFilter('all')}>All Time</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateFilter('7days')}>Last 7 Days</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateFilter('30days')}>Last 30 Days</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDateFilter('90days')}>Last 90 Days</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* View Mode Tabs */}
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'list' | 'timeline')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">List View</TabsTrigger>
              <TabsTrigger value="timeline">Timeline View</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-4">
              {renderListView()}
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              {renderTimelineView()}
            </TabsContent>
          </Tabs>

          {/* Selection Actions */}
          {selectedVersions.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-800">
                {selectedVersions.length} prescription{selectedVersions.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                {selectedVersions.length === 2 && (
                  <Button 
                    size="sm" 
                    onClick={() => {
                      onCompare(selectedVersions)
                      onClose()
                    }}
                  >
                    Compare Selected
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedVersions([])}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredVersions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No prescriptions found</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}