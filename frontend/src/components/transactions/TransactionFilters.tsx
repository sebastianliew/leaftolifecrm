"use client"

import { format } from "date-fns"
import { CalendarIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { PaymentStatus, TransactionStatus } from "@/types/transaction"
import {
  EditorialField,
  EditorialSelect,
  EditorialButton,
} from "@/components/ui/editorial"

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
  { value: "all", label: "All payment status" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "overdue", label: "Overdue" },
  { value: "failed", label: "Failed" },
]

const TRANSACTION_STATUS_OPTIONS: Array<{ value: TransactionStatus | "all"; label: string }> = [
  { value: "all", label: "All status" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "draft", label: "Draft" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially refunded" },
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

  return (
    <section className="border-b border-[#E5E7EB] py-6 grid grid-cols-1 md:grid-cols-4 gap-10">
      <EditorialField label="Payment status">
        <EditorialSelect
          value={filters.paymentStatus || "all"}
          onChange={(e) => onFiltersChange({ ...filters, paymentStatus: e.target.value as PaymentStatus | "all" })}
        >
          {PAYMENT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </EditorialSelect>
      </EditorialField>

      <EditorialField label="Status">
        <EditorialSelect
          value={filters.status || "all"}
          onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as TransactionStatus | "all" })}
        >
          {TRANSACTION_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </EditorialSelect>
      </EditorialField>

      <EditorialField label="Date from">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-left font-normal bg-transparent border-0 border-b border-[#E5E7EB] rounded-none px-0 py-2 h-auto hover:bg-transparent hover:border-[#0A0A0A]",
                !filters.dateFrom && "text-[#9CA3AF]"
              )}
            >
              <CalendarIcon className="mr-2 h-3 w-3 text-[#6B7280]" />
              <span className="text-sm">
                {filters.dateFrom ? format(filters.dateFrom, "dd MMM yyyy") : "From"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateFrom}
              onSelect={(date) => onFiltersChange({ ...filters, dateFrom: date })}
              disabled={(date) => {
                if (date > new Date()) return true
                if (filters.dateTo && date > filters.dateTo) return true
                return false
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </EditorialField>

      <EditorialField label="Date to">
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "flex-1 justify-start text-left font-normal bg-transparent border-0 border-b border-[#E5E7EB] rounded-none px-0 py-2 h-auto hover:bg-transparent hover:border-[#0A0A0A]",
                  !filters.dateTo && "text-[#9CA3AF]"
                )}
              >
                <CalendarIcon className="mr-2 h-3 w-3 text-[#6B7280]" />
                <span className="text-sm">
                  {filters.dateTo ? format(filters.dateTo, "dd MMM yyyy") : "To"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateTo}
                onSelect={(date) => onFiltersChange({ ...filters, dateTo: date })}
                disabled={(date) => {
                  if (date > new Date()) return true
                  if (filters.dateFrom && date < filters.dateFrom) return true
                  return false
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {hasActiveFilters && (
            <EditorialButton variant="ghost" icon={<X className="h-3 w-3" />} onClick={onClearFilters}>
              Clear
            </EditorialButton>
          )}
        </div>
      </EditorialField>
    </section>
  )
}
