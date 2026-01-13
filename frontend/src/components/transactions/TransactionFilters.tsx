"use client"

import { format } from "date-fns"
import { CalendarIcon, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { PaymentStatus, TransactionStatus } from "@/types/transaction"

export interface TransactionFilterValues {
  paymentStatus?: PaymentStatus | "all"
  status?: TransactionStatus | "all"
  dateFrom?: Date
  dateTo?: Date
}

interface TransactionFiltersProps {
  filters: TransactionFilterValues
  onFiltersChange: (filters: TransactionFilterValues) => void
  onClearFilters: () => void
}

const PAYMENT_STATUS_OPTIONS: Array<{ value: PaymentStatus | "all"; label: string }> = [
  { value: "all", label: "All Payment Status" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "overdue", label: "Overdue" },
  { value: "failed", label: "Failed" },
]

const TRANSACTION_STATUS_OPTIONS: Array<{ value: TransactionStatus | "all"; label: string }> = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "draft", label: "Draft" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially Refunded" },
]

export function TransactionFilters({
  filters,
  onFiltersChange,
  onClearFilters,
}: TransactionFiltersProps) {
  const hasActiveFilters =
    (filters.paymentStatus && filters.paymentStatus !== "all") ||
    (filters.status && filters.status !== "all") ||
    filters.dateFrom ||
    filters.dateTo

  const handlePaymentStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      paymentStatus: value as PaymentStatus | "all",
    })
  }

  const handleStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      status: value as TransactionStatus | "all",
    })
  }

  const handleDateFromChange = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      dateFrom: date,
    })
  }

  const handleDateToChange = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      dateTo: date,
    })
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Payment Status Filter */}
      <Select
        value={filters.paymentStatus || "all"}
        onValueChange={handlePaymentStatusChange}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Payment Status" />
        </SelectTrigger>
        <SelectContent>
          {PAYMENT_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Transaction Status Filter */}
      <Select
        value={filters.status || "all"}
        onValueChange={handleStatusChange}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {TRANSACTION_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date From Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[140px] justify-start text-left font-normal",
              !filters.dateFrom && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.dateFrom ? format(filters.dateFrom, "dd MMM yyyy") : "From"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.dateFrom}
            onSelect={handleDateFromChange}
            disabled={(date) => {
              if (date > new Date()) return true
              if (filters.dateTo && date > filters.dateTo) return true
              return false
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Date To Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[140px] justify-start text-left font-normal",
              !filters.dateTo && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.dateTo ? format(filters.dateTo, "dd MMM yyyy") : "To"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.dateTo}
            onSelect={handleDateToChange}
            disabled={(date) => {
              if (date > new Date()) return true
              if (filters.dateFrom && date < filters.dateFrom) return true
              return false
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="h-10 px-3"
        >
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  )
}
