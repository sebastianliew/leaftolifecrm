"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { FiCalendar, FiChevronLeft, FiChevronRight, FiClock, FiCopy, FiPlus } from 'react-icons/fi'
import { format, parseISO, addDays, subDays, isSameDay } from 'date-fns'
import { PrescriptionVersion } from '@/types/prescription'
import { motion, AnimatePresence } from 'framer-motion'

interface DateNavigatorProps {
  currentDate: string
  onDateChange: (date: string) => void
  onCreateNew: (date: string) => void
  versions: PrescriptionVersion[]
  className?: string
}

interface DateMarker {
  date: string
  hasVersion: boolean
  changeCount: number
  summary: string
}

export default function DateNavigator({
  currentDate,
  onDateChange,
  onCreateNew,
  versions,
  className = ""
}: DateNavigatorProps) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [dateMarkers, setDateMarkers] = useState<DateMarker[]>([])
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day')
  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Generate date markers for the timeline
    const markers: DateMarker[] = []
    const today = new Date()
    
    // Generate markers for past 30 days and next 7 days
    for (let i = -30; i <= 7; i++) {
      const date = format(addDays(today, i), 'yyyy-MM-dd')
      const version = versions.find(v => v.date === date)
      
      markers.push({
        date,
        hasVersion: !!version,
        changeCount: version?.changes.length || 0,
        summary: version?.summary || ''
      })
    }
    
    setDateMarkers(markers)
  }, [versions])

  const handleDateNavigation = (direction: 'prev' | 'next') => {
    const current = parseISO(currentDate)
    const newDate = direction === 'prev' ? subDays(current, 1) : addDays(current, 1)
    onDateChange(format(newDate, 'yyyy-MM-dd'))
  }

  const handleQuickJump = (jump: 'today' | 'lastWeek' | 'lastMonth') => {
    const today = new Date()
    let targetDate: Date
    
    switch (jump) {
      case 'today':
        targetDate = today
        break
      case 'lastWeek':
        targetDate = subDays(today, 7)
        break
      case 'lastMonth':
        targetDate = subDays(today, 30)
        break
    }
    
    onDateChange(format(targetDate, 'yyyy-MM-dd'))
  }

  const renderTimelineMarker = (marker: DateMarker) => {
    const isCurrentDate = marker.date === currentDate
    const date = parseISO(marker.date)
    const isToday = isSameDay(date, new Date())
    
    return (
      <motion.div
        key={marker.date}
        className={cn(
          "relative flex flex-col items-center cursor-pointer group",
          "transition-all duration-200"
        )}
        onClick={() => onDateChange(marker.date)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Date marker dot */}
        <div
          className={cn(
            "w-3 h-3 rounded-full transition-all duration-200",
            isCurrentDate && "w-4 h-4 ring-4 ring-blue-200",
            marker.hasVersion && !isCurrentDate && "bg-green-500",
            !marker.hasVersion && !isCurrentDate && "bg-gray-300",
            isCurrentDate && marker.hasVersion && "bg-blue-500",
            isCurrentDate && !marker.hasVersion && "bg-blue-400",
            isToday && "ring-2 ring-yellow-400"
          )}
        />
        
        {/* Date label on hover */}
        <div className={cn(
          "absolute -bottom-8 opacity-0 group-hover:opacity-100",
          "transition-opacity duration-200 text-xs whitespace-nowrap",
          "bg-gray-800 text-white px-2 py-1 rounded",
          isCurrentDate && "opacity-100 bg-blue-600"
        )}>
          {format(date, 'MMM d')}
          {marker.changeCount > 0 && (
            <span className="ml-1 text-yellow-300">({marker.changeCount})</span>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <Card className={cn("p-4", className)}>
      <div className="space-y-4">
        {/* Main Navigation Bar */}
        <div className="flex items-center justify-between">
          {/* Left side - Date display and navigation */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDateNavigation('prev')}
              className="h-8 w-8 p-0"
            >
              <FiChevronLeft className="h-4 w-4" />
            </Button>
            
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="justify-start text-left font-normal"
                >
                  <FiCalendar className="mr-2 h-4 w-4" />
                  {format(parseISO(currentDate), 'd MMMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseISO(currentDate)}
                  onSelect={(date) => {
                    if (date) {
                      onDateChange(format(date, 'yyyy-MM-dd'))
                      setShowCalendar(false)
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDateNavigation('next')}
              className="h-8 w-8 p-0"
            >
              <FiChevronRight className="h-4 w-4" />
            </Button>
            
            {/* Current viewing mode indicator */}
            {!isSameDay(parseISO(currentDate), new Date()) && (
              <Badge variant="secondary" className="gap-1">
                <FiClock className="h-3 w-3" />
                Time Travel Mode
              </Badge>
            )}
          </div>
          
          {/* Center - Quick jumps */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleQuickJump('today')}
              className={cn(
                "text-xs",
                isSameDay(parseISO(currentDate), new Date()) && "bg-blue-50"
              )}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleQuickJump('lastWeek')}
              className="text-xs"
            >
              Last Week
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleQuickJump('lastMonth')}
              className="text-xs"
            >
              Last Month
            </Button>
          </div>
          
          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const version = versions.find(v => v.date === currentDate)
                if (version) {
                  // Copy from current date
                  const newDate = format(new Date(), 'yyyy-MM-dd')
                  if (newDate !== currentDate) {
                    // Create new prescription based on current
                    onCreateNew(newDate)
                  }
                }
              }}
              disabled={!versions.find(v => v.date === currentDate)}
              className="gap-1"
            >
              <FiCopy className="h-3.5 w-3.5" />
              Copy to Today
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={() => onCreateNew(currentDate)}
              className="gap-1"
            >
              <FiPlus className="h-3.5 w-3.5" />
              New Prescription
            </Button>
          </div>
        </div>
        
        {/* Timeline visualization */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-0.5 bg-gray-200" />
          </div>
          
          <div
            ref={timelineRef}
            className="relative flex items-center justify-between overflow-x-auto no-scrollbar py-2"
          >
            <AnimatePresence>
              {dateMarkers.map((marker) => renderTimelineMarker(marker))}
            </AnimatePresence>
          </div>
        </div>
        
        {/* View mode selector */}
        <div className="flex items-center justify-center gap-1">
          <div className="inline-flex rounded-md border">
            {(['day', 'week', 'month'] as const).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode(mode)}
                className={cn(
                  "capitalize rounded-none",
                  mode === 'day' && "rounded-l-md",
                  mode === 'month' && "rounded-r-md"
                )}
              >
                {mode}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}