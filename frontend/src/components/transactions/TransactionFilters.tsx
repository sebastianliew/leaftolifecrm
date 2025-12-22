"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { CalendarIcon, Filter } from 'lucide-react'

export function TransactionFilters() {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <Select>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="refunded">Refunded</SelectItem>
        </SelectContent>
      </Select>

      <Select>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Payment Method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Methods</SelectItem>
          <SelectItem value="cash">Cash</SelectItem>
          <SelectItem value="card">Card</SelectItem>
          <SelectItem value="bank">Bank Transfer</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm">
        <CalendarIcon className="mr-2 h-4 w-4" />
        Date Range
      </Button>

      <Button variant="outline" size="sm">
        <Filter className="mr-2 h-4 w-4" />
        Clear Filters
      </Button>
    </div>
  )
}