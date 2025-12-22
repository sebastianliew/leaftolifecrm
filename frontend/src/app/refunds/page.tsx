"use client"

import { useState, useMemo } from 'react'
import { RefundList } from '@/components/refunds/RefundList'
import { RefundFilters } from '@/components/refunds/RefundFilters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus } from 'lucide-react'
import type { RefundFilters as RefundFiltersType, RefundStatus } from '@/types/refund'
import { usePermissions } from '@/hooks/usePermissions'

export default function RefundsPage() {
  const { hasPermission } = usePermissions()
  const canProcessRefunds = hasPermission('transactions', 'canRefundTransactions')

  const [searchTerm, setSearchTerm] = useState('')
  const [quickStatusFilter, setQuickStatusFilter] = useState<RefundStatus | 'all'>('all')
  const [advancedFilters, setAdvancedFilters] = useState<RefundFiltersType>({})

  // Combine all filters
  const combinedFilters = useMemo(() => {
    const filters: RefundFiltersType = {
      ...advancedFilters,
    }
    
    if (searchTerm.trim()) {
      filters.searchTerm = searchTerm.trim()
    }
    
    if (quickStatusFilter && quickStatusFilter !== 'all') {
      filters.status = quickStatusFilter
    }

    return filters
  }, [searchTerm, quickStatusFilter, advancedFilters])

  const handleAdvancedFiltersChange = (filters: RefundFiltersType) => {
    setAdvancedFilters(filters)
  }

  const handleQuickStatusChange = (status: string) => {
    setQuickStatusFilter(status as RefundStatus | 'all')
    // Clear advanced status filter if it conflicts
    if (status !== 'all' && advancedFilters.status && advancedFilters.status !== status) {
      setAdvancedFilters(prev => ({ ...prev, status: undefined }))
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Refund Management</h1>
          <p className="text-sm text-gray-600">Track and manage customer refunds</p>
        </div>
        
        {canProcessRefunds && (
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Refund
            </Button>
          </div>
        )}
      </div>

      {/* Quick Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search refunds by number, customer, or transaction..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="min-w-[180px]">
          <Select value={quickStatusFilter} onValueChange={handleQuickStatusChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Advanced Filters */}
      <RefundFilters onFiltersChange={handleAdvancedFiltersChange} />
      
      {/* Refund List */}
      <RefundList filters={combinedFilters} />
    </div>
  )
}