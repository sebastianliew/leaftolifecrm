"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FiCalendar, FiChevronLeft, FiChevronRight, FiClock, FiEye, FiPlus } from 'react-icons/fi'
import { format, parseISO, isSameDay, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { PrescriptionVersion } from '@/types/prescription'
import { PrescriptionVersionManager } from '@/lib/prescription-versioning'
import { Skeleton } from '@/components/ui/skeleton'

interface PrescriptionTimelineProps {
  patientId: string
  currentDate?: string
  onDateSelect: (date: string) => void
  onCompareSelect: (dates: string[]) => void
  onCreateNew: (date: string) => void
  className?: string
}

export default function PrescriptionTimeline({
  patientId,
  currentDate,
  onDateSelect,
  onCompareSelect,
  onCreateNew,
  className = ""
}: PrescriptionTimelineProps) {
  const [versions, setVersions] = useState<PrescriptionVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [compareMode, setCompareMode] = useState(false)

  useEffect(() => {
    const loadVersions = async () => {
      try {
        setLoading(true)
        const allVersions = PrescriptionVersionManager.getAllVersions(patientId)
        setVersions(allVersions)
      } catch (error) {
        console.error('Failed to load prescription versions:', error)
      } finally {
        setLoading(false)
      }
    }

    loadVersions()
  }, [patientId])

  const handleDateClick = (date: string) => {
    if (compareMode) {
      setSelectedDates(prev => {
        if (prev.includes(date)) {
          return prev.filter(d => d !== date)
        } else if (prev.length < 3) {
          return [...prev, date]
        }
        return prev
      })
    } else {
      onDateSelect(date)
    }
  }

  const handleCompare = () => {
    if (selectedDates.length >= 2) {
      onCompareSelect(selectedDates)
      setCompareMode(false)
      setSelectedDates([])
    }
  }

  const getVersionForDate = (date: string): PrescriptionVersion | undefined => {
    return versions.find(v => v.date === date)
  }

  const renderTimelineView = () => {
    const sortedVersions = [...versions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return (
      <ScrollArea className="h-96">
        <div className="space-y-4 p-4">
          {sortedVersions.map((version, index) => {
            const isSelected = selectedDates.includes(version.date)
            const isCurrent = currentDate === version.date
            const isFirst = index === 0

            return (
              <div
                key={version.id}
                className={`relative flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  isCurrent 
                    ? 'border-blue-500 bg-blue-50' 
                    : isSelected 
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
                onClick={() => handleDateClick(version.date)}
              >
                {/* Timeline connector */}
                {index < sortedVersions.length - 1 && (
                  <div className="absolute left-8 top-16 w-0.5 h-8 bg-gray-300" />
                )}

                {/* Version indicator */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isCurrent 
                    ? 'bg-blue-500 text-white' 
                    : isSelected
                    ? 'bg-orange-500 text-white'
                    : isFirst
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-400 text-white'
                }`}>
                  {version.version}
                </div>

                {/* Version details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">
                      {format(parseISO(version.date), 'dd MMM yyyy')}
                    </h3>
                    <div className="flex items-center gap-2">
                      {isFirst && (
                        <Badge className="bg-green-100 text-green-800">Latest</Badge>
                      )}
                      {isCurrent && (
                        <Badge className="bg-blue-100 text-blue-800">Viewing</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{version.summary}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <FiClock className="h-3 w-3" />
                      {format(parseISO(version.date), 'h:mm a')}
                    </span>
                    {version.changes.length > 0 && (
                      <span>{version.changes.length} changes</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {compareMode && (
                    <div className={`w-4 h-4 rounded border-2 ${
                      isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                    }`} />
                  )}
                </div>
              </div>
            )
          })}

          {versions.length === 0 && (
            <div className="text-center py-12">
              <FiCalendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No prescription versions found</p>
              <Button 
                onClick={() => {
                  const date = format(new Date(), 'yyyy-MM-dd')
                  // console.log('Create First Prescription clicked, date:', date)
                  onCreateNew(date)
                }}
                className="mt-4"
                size="sm"
              >
                <FiPlus className="h-4 w-4 mr-2" />
                Create First Prescription
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    )
  }

  const renderCalendarView = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

    return (
      <div className="p-4">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">{format(currentMonth, 'MMMM yyyy')}</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
            >
              <FiChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
            >
              <FiChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center text-xs font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const version = getVersionForDate(dateStr)
            const isToday = isSameDay(day, new Date())
            const isCurrent = currentDate === dateStr
            const isSelected = selectedDates.includes(dateStr)

            return (
              <button
                key={dateStr}
                onClick={() => handleDateClick(dateStr)}
                className={`relative aspect-square p-1 text-sm rounded-md transition-colors ${
                  isCurrent
                    ? 'bg-blue-500 text-white'
                    : isSelected
                    ? 'bg-orange-500 text-white'
                    : version
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : isToday
                    ? 'bg-gray-100 text-gray-900 border-2 border-blue-300'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="block">{format(day, 'd')}</span>
                {version && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-current rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FiCalendar className="h-5 w-5" />
            Prescription Timeline
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex rounded-md border">
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('timeline')}
                className="rounded-r-none"
              >
                Timeline
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className="rounded-l-none border-l"
              >
                Calendar
              </Button>
            </div>

            {/* Actions */}
            {versions.length > 1 && (
              <Button
                variant={compareMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setCompareMode(!compareMode)
                  setSelectedDates([])
                }}
              >
                <FiEye className="h-4 w-4 mr-2" />
                Compare
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => onCreateNew(format(new Date(), 'yyyy-MM-dd'))}
            >
              <FiPlus className="h-4 w-4 mr-2" />
              New
            </Button>
          </div>
        </div>

        {compareMode && (
          <div className="mt-4 p-3 bg-orange-50 rounded-md">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">Compare Mode:</span> Select 2-3 versions to compare
                {selectedDates.length > 0 && (
                  <span className="ml-2 text-orange-600">
                    {selectedDates.length} selected
                  </span>
                )}
              </div>
              {selectedDates.length >= 2 && (
                <Button size="sm" onClick={handleCompare}>
                  Compare Selected
                </Button>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {viewMode === 'timeline' ? renderTimelineView() : renderCalendarView()}
      </CardContent>
    </Card>
  )
}