"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X, Filter } from 'lucide-react'
import type { RefundFilters as RefundFiltersType, RefundStatus, RefundReason } from '@/types/refund'

interface RefundFiltersProps {
  onFiltersChange?: (filters: RefundFiltersType) => void
}

export function RefundFilters({ onFiltersChange }: RefundFiltersProps) {
  const [filters, setFilters] = useState<RefundFiltersType>({})
  const [showFilters, setShowFilters] = useState(false)

  const handleFilterChange = (key: keyof RefundFiltersType, value: string) => {
    const newFilters = {
      ...filters,
      [key]: (value && value !== 'all') ? value : undefined
    }
    
    // Remove empty filters
    Object.keys(newFilters).forEach(k => {
      if (!newFilters[k as keyof RefundFiltersType]) {
        delete newFilters[k as keyof RefundFiltersType]
      }
    })
    
    setFilters(newFilters)
    onFiltersChange?.(newFilters)
  }

  const clearFilters = () => {
    setFilters({})
    onFiltersChange?.({})
  }

  const activeFilterCount = Object.keys(filters).length

  const statusOptions: { value: RefundStatus; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'processing', label: 'Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' }
  ]

  const reasonOptions: { value: RefundReason; label: string }[] = [
    { value: 'customer_request', label: 'Customer Request' },
    { value: 'product_issue', label: 'Product Issue' },
    { value: 'pricing_error', label: 'Pricing Error' },
    { value: 'expired_product', label: 'Expired Product' },
    { value: 'damaged_goods', label: 'Damaged Goods' },
    { value: 'wrong_item', label: 'Wrong Item' },
    { value: 'other', label: 'Other' }
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all filters
          </Button>
        )}
      </div>

      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={filters.status || 'all'} 
                  onValueChange={(value) => handleFilterChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Select 
                  value={filters.refundReason || 'all'} 
                  onValueChange={(value) => handleFilterChange('refundReason', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All reasons" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All reasons</SelectItem>
                    {reasonOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerId">Customer ID</Label>
                <Input
                  id="customerId"
                  placeholder="Enter customer ID"
                  value={filters.customerId || ''}
                  onChange={(e) => handleFilterChange('customerId', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transactionId">Transaction ID</Label>
                <Input
                  id="transactionId"
                  placeholder="Enter transaction ID"
                  value={filters.transactionId || ''}
                  onChange={(e) => handleFilterChange('transactionId', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minAmount">Min Amount</Label>
                <Input
                  id="minAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={filters.minAmount || ''}
                  onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxAmount">Max Amount</Label>
                <Input
                  id="maxAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={filters.maxAmount || ''}
                  onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.status && (
            <Badge variant="outline" className="flex items-center gap-1">
              Status: {statusOptions.find(s => s.value === filters.status)?.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleFilterChange('status', 'all')}
              />
            </Badge>
          )}
          
          {filters.refundReason && (
            <Badge variant="outline" className="flex items-center gap-1">
              Reason: {reasonOptions.find(r => r.value === filters.refundReason)?.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleFilterChange('refundReason', 'all')}
              />
            </Badge>
          )}
          
          {filters.startDate && (
            <Badge variant="outline" className="flex items-center gap-1">
              From: {filters.startDate}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleFilterChange('startDate', '')}
              />
            </Badge>
          )}
          
          {filters.endDate && (
            <Badge variant="outline" className="flex items-center gap-1">
              To: {filters.endDate}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleFilterChange('endDate', '')}
              />
            </Badge>
          )}
          
          {filters.customerId && (
            <Badge variant="outline" className="flex items-center gap-1">
              Customer: {filters.customerId}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleFilterChange('customerId', '')}
              />
            </Badge>
          )}
          
          {filters.transactionId && (
            <Badge variant="outline" className="flex items-center gap-1">
              Transaction: {filters.transactionId}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleFilterChange('transactionId', '')}
              />
            </Badge>
          )}
          
          {filters.minAmount && (
            <Badge variant="outline" className="flex items-center gap-1">
              Min: ${filters.minAmount}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleFilterChange('minAmount', '')}
              />
            </Badge>
          )}
          
          {filters.maxAmount && (
            <Badge variant="outline" className="flex items-center gap-1">
              Max: ${filters.maxAmount}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleFilterChange('maxAmount', '')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}