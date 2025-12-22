"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FiActivity, FiTrendingUp, FiTrendingDown, FiFilter } from 'react-icons/fi'
import { format, parseISO, subDays, eachDayOfInterval } from 'date-fns'
import { PrescriptionVersion } from '@/types/prescription'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface PrescriptionTimelineGraphProps {
  versions: PrescriptionVersion[]
  className?: string
}

interface TimelineDataPoint {
  date: string
  remedyCount: number
  changeCount: number
  specialInstructions: number
  dietaryAdvice: number
  lifestyleAdvice: number
}

interface MetricChange {
  metric: string
  current: number
  previous: number
  change: number
  trend: 'up' | 'down' | 'stable'
}

export default function PrescriptionTimelineGraph({
  versions,
  className = ""
}: PrescriptionTimelineGraphProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [graphType, setGraphType] = useState<'line' | 'area' | 'bar'>('line')
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['remedyCount', 'changeCount'])
  const [timelineData, setTimelineData] = useState<TimelineDataPoint[]>([])
  const [metricChanges, setMetricChanges] = useState<MetricChange[]>([])

  const generateTimelineData = useCallback(() => {
    const now = new Date()
    let startDate: Date
    
    switch (timeRange) {
      case '7d':
        startDate = subDays(now, 7)
        break
      case '30d':
        startDate = subDays(now, 30)
        break
      case '90d':
        startDate = subDays(now, 90)
        break
      default:
        startDate = versions.length > 0 
          ? parseISO(versions[versions.length - 1].date)
          : subDays(now, 30)
    }
    
    const days = eachDayOfInterval({ start: startDate, end: now })
    
    const data: TimelineDataPoint[] = days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const version = versions.find(v => v.date === dateStr)
      
      if (version) {
        const p = version.prescription
        const remedyCount = Object.values(p.dailySchedule).reduce((total, meal) => 
          total + Object.values(meal).reduce((mealTotal: number, timing: unknown) => {
            if (Array.isArray(timing)) {
              return mealTotal + timing.length;
            }
            return mealTotal;
          }, 0
          ), 0
        )
        
        return {
          date: dateStr,
          remedyCount,
          changeCount: version.changes.length,
          specialInstructions: p.specialInstructions.length,
          dietaryAdvice: p.dietaryAdvice.length,
          lifestyleAdvice: p.lifestyleAdvice.length
        }
      }
      
      // Fill with previous data if no version for this date
      const previousData = data.length > 0 ? data[data.length - 1] : null
      return {
        date: dateStr,
        remedyCount: previousData?.remedyCount || 0,
        changeCount: 0,
        specialInstructions: previousData?.specialInstructions || 0,
        dietaryAdvice: previousData?.dietaryAdvice || 0,
        lifestyleAdvice: previousData?.lifestyleAdvice || 0
      }
    })
    
    setTimelineData(data)
    
    // Calculate metric changes
    if (data.length >= 2) {
      const latest = data[data.length - 1]
      const previous = data[data.length - 8] || data[0] // Compare with week ago or first
      
      const changes: MetricChange[] = [
        {
          metric: 'Total Remedies',
          current: latest.remedyCount,
          previous: previous.remedyCount,
          change: latest.remedyCount - previous.remedyCount,
          trend: latest.remedyCount > previous.remedyCount ? 'up' : 
                 latest.remedyCount < previous.remedyCount ? 'down' : 'stable'
        },
        {
          metric: 'Special Instructions',
          current: latest.specialInstructions,
          previous: previous.specialInstructions,
          change: latest.specialInstructions - previous.specialInstructions,
          trend: latest.specialInstructions > previous.specialInstructions ? 'up' : 
                 latest.specialInstructions < previous.specialInstructions ? 'down' : 'stable'
        },
        {
          metric: 'Dietary Advice',
          current: latest.dietaryAdvice,
          previous: previous.dietaryAdvice,
          change: latest.dietaryAdvice - previous.dietaryAdvice,
          trend: latest.dietaryAdvice > previous.dietaryAdvice ? 'up' : 
                 latest.dietaryAdvice < previous.dietaryAdvice ? 'down' : 'stable'
        }
      ]
      
      setMetricChanges(changes)
    }
  }, [versions, timeRange])

  useEffect(() => {
    generateTimelineData()
  }, [generateTimelineData])

  const metricColors = {
    remedyCount: '#3b82f6',
    changeCount: '#f59e0b',
    specialInstructions: '#10b981',
    dietaryAdvice: '#8b5cf6',
    lifestyleAdvice: '#ef4444'
  }

  const metricLabels = {
    remedyCount: 'Remedies',
    changeCount: 'Changes',
    specialInstructions: 'Instructions',
    dietaryAdvice: 'Dietary',
    lifestyleAdvice: 'Lifestyle'
  }

  const renderChart = () => {
    const chartData = timelineData.map(d => ({
      ...d,
      date: format(parseISO(d.date), 'MMM d')
    }))

    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    }

    switch (graphType) {
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedMetrics.map(metric => (
                <Area
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  stroke={metricColors[metric as keyof typeof metricColors]}
                  fill={metricColors[metric as keyof typeof metricColors]}
                  fillOpacity={0.3}
                  name={metricLabels[metric as keyof typeof metricLabels]}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )
      
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedMetrics.map(metric => (
                <Bar
                  key={metric}
                  dataKey={metric}
                  fill={metricColors[metric as keyof typeof metricColors]}
                  name={metricLabels[metric as keyof typeof metricLabels]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )
      
      default:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedMetrics.map(metric => (
                <Line
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  stroke={metricColors[metric as keyof typeof metricColors]}
                  strokeWidth={2}
                  name={metricLabels[metric as keyof typeof metricLabels]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FiActivity className="h-5 w-5" />
            Treatment Progress
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Time Range Selector */}
            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as '7d' | '30d' | '90d' | 'all')}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="90d">90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Graph Type Selector */}
            <div className="flex rounded-md border">
              {(['line', 'area', 'bar'] as const).map(type => (
                <Button
                  key={type}
                  variant={graphType === type ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setGraphType(type)}
                  className="rounded-none first:rounded-l-md last:rounded-r-md capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Metric Change Indicators */}
        {metricChanges.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {metricChanges.map(change => (
              <div key={change.metric} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">{change.metric}</span>
                  {change.trend === 'up' && <FiTrendingUp className="h-4 w-4 text-green-500" />}
                  {change.trend === 'down' && <FiTrendingDown className="h-4 w-4 text-red-500" />}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold">{change.current}</span>
                  {change.change !== 0 && (
                    <span className={`text-sm ${change.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {change.change > 0 ? '+' : ''}{change.change}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Metric Filters */}
        <div className="flex items-center gap-2">
          <FiFilter className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">Show:</span>
          <div className="flex gap-2">
            {Object.entries(metricLabels).map(([key, label]) => (
              <Button
                key={key}
                variant={selectedMetrics.includes(key) ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectedMetrics(prev => 
                    prev.includes(key)
                      ? prev.filter(m => m !== key)
                      : [...prev, key]
                  )
                }}
                className="text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Chart */}
        <div className="w-full">
          {renderChart()}
        </div>
        
        {/* Insights */}
        {versions.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Insights</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Average changes per update: {(versions.reduce((sum, v) => sum + v.changes.length, 0) / versions.length).toFixed(1)}</li>
              <li>• Most active day: {format(parseISO(versions[0].date), 'EEEE')}</li>
              <li>• Total prescription versions: {versions.length}</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}