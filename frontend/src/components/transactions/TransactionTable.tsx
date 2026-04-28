"use client"

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { TransactionTableRow } from './TransactionTableRow'
import { TransactionFilters, type TransactionFilterValues } from './TransactionFilters'
import { HiFunnel } from 'react-icons/hi2'
import type { Transaction } from '@/types/transaction'
import {
  EditorialSearch,
  EditorialButton,
  EditorialBulkBar,
  EditorialTable,
  EditorialTHead,
  EditorialTh,
  EditorialEmptyRow,
  EditorialPagination,
} from '@/components/ui/editorial'

interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalCount: number
  limit: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

interface TransactionTableProps {
  transactions: Transaction[]
  onEdit: (transaction: Transaction) => void
  onDelete: (transactionId: string) => void
  onDuplicate?: (transaction: Transaction) => void
  onCancelDraft?: (transaction: Transaction) => void
  onGenerateInvoice: (transactionId: string) => void
  onBulkDelete?: (transactionIds: string[]) => void
  searchTerm: string
  onSearchChange: (search: string) => void
  onSearchSubmit?: () => void
  filters?: TransactionFilterValues
  onFiltersChange?: (filters: TransactionFilterValues) => void
  onClearFilters?: () => void
  pagination?: PaginationInfo
  onPageChange?: (page: number) => void
  onItemsPerPageChange?: (limit: number) => void
  activeSearchTerm?: string
  canEditTransactions?: boolean
  canEditDrafts?: boolean
  canDeleteTransactions?: boolean
  canCreateTransactions?: boolean
}

export function TransactionTable({
  transactions,
  onEdit,
  onDelete,
  onDuplicate,
  onCancelDraft,
  onGenerateInvoice,
  onBulkDelete,
  onSearchChange,
  onSearchSubmit,
  filters,
  onFiltersChange,
  onClearFilters,
  pagination,
  onPageChange,
  onItemsPerPageChange,
  activeSearchTerm,
  canEditTransactions = false,
  canEditDrafts = false,
  canDeleteTransactions = false,
  canCreateTransactions = false,
}: TransactionTableProps) {
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  const handleSearch = (term: string) => {
    onSearchChange(term)
    if (onSearchSubmit) onSearchSubmit()
  }

  const handleSelectTransaction = (transactionId: string, checked: boolean) => {
    if (checked) {
      setSelectedTransactions(prev => [...prev, transactionId])
    } else {
      setSelectedTransactions(prev => prev.filter(id => id !== transactionId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTransactions(transactions.map(t => t._id))
    } else {
      setSelectedTransactions([])
    }
  }

  const handleBulkDelete = () => {
    if (onBulkDelete && selectedTransactions.length > 0) {
      onBulkDelete(selectedTransactions)
      setSelectedTransactions([])
    }
  }

  const isAllSelected = transactions.length > 0 && selectedTransactions.length === transactions.length

  return (
    <>
      <div className="flex items-center gap-7 mt-8 flex-wrap">
        <EditorialSearch onSearch={handleSearch} placeholder="Search transactions..." />
        {filters && onFiltersChange && (
          <EditorialButton
            variant={showFilters ? 'ghost-active' : 'ghost'}
            icon={<HiFunnel className="h-3 w-3" />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filter
          </EditorialButton>
        )}
        {activeSearchTerm && pagination && (
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280] ml-auto">
            <span className="tabular-nums text-[#0A0A0A]">{pagination.totalCount}</span> result
            {pagination.totalCount !== 1 ? 's' : ''} for &ldquo;{activeSearchTerm}&rdquo;
          </p>
        )}
      </div>

      {showFilters && filters && onFiltersChange && onClearFilters && (
        <TransactionFilters
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClearFilters={onClearFilters}
        />
      )}

      <EditorialBulkBar count={selectedTransactions.length}>
        {onBulkDelete && canDeleteTransactions && (
          <button
            onClick={handleBulkDelete}
            className="text-[11px] uppercase tracking-[0.28em] text-[#FCA5A5] hover:text-white transition-colors flex items-center gap-2"
          >
            Delete selected
            <span className="text-base normal-case tracking-normal">→</span>
          </button>
        )}
      </EditorialBulkBar>

      <EditorialTable>
        <EditorialTHead>
          <EditorialTh className="w-8">
            <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} aria-label="Select all transactions" />
          </EditorialTh>
          <EditorialTh>Transaction #</EditorialTh>
          <EditorialTh>Date</EditorialTh>
          <EditorialTh>Customer</EditorialTh>
          <EditorialTh>Type</EditorialTh>
          <EditorialTh align="right">Items</EditorialTh>
          <EditorialTh align="right">Amount</EditorialTh>
          <EditorialTh>Payment</EditorialTh>
          <EditorialTh align="right" className="w-12">Actions</EditorialTh>
        </EditorialTHead>
        <tbody>
          {transactions.length === 0 ? (
            <EditorialEmptyRow colSpan={9} description="No transactions match the current filters." />
          ) : (
            transactions.map((transaction) => (
              <TransactionTableRow
                key={transaction._id}
                transaction={transaction}
                isSelected={selectedTransactions.includes(transaction._id)}
                onSelect={handleSelectTransaction}
                onEdit={onEdit}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onCancelDraft={onCancelDraft}
                onGenerateInvoice={onGenerateInvoice}
                canEdit={canEditTransactions}
                canEditDrafts={canEditDrafts}
                canDelete={canDeleteTransactions}
                canCreate={canCreateTransactions}
              />
            ))
          )}
        </tbody>
      </EditorialTable>

      {pagination && onPageChange && (
        <EditorialPagination
          total={pagination.totalCount}
          page={pagination.currentPage}
          limit={pagination.limit}
          pages={pagination.totalPages}
          onPageChange={onPageChange}
          onLimitChange={onItemsPerPageChange}
        />
      )}
    </>
  )
}
