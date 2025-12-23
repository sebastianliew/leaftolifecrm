"use client"

import { useState } from 'react'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { TransactionTableRow } from './TransactionTableRow'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Search, Trash2, X } from 'lucide-react'
import type { Transaction } from '@/types/transaction'

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
  onGenerateInvoice: (transactionId: string) => void
  onBulkDelete?: (transactionIds: string[]) => void
  searchTerm: string
  onSearchChange: (search: string) => void
  onSearchSubmit?: () => void
  pagination?: PaginationInfo
  onPageChange?: (page: number) => void
  onItemsPerPageChange?: (limit: number) => void
  activeSearchTerm?: string
  canEditTransactions?: boolean
  canDeleteTransactions?: boolean
}

export function TransactionTable({
  transactions,
  onEdit,
  onDelete,
  onGenerateInvoice,
  onBulkDelete,
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  pagination,
  onPageChange,
  onItemsPerPageChange,
  activeSearchTerm,
  canEditTransactions = false,
  canDeleteTransactions = false
}: TransactionTableProps) {
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([])

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
    <div className="space-y-4">
      {/* Search and bulk actions */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search all transactions... (Press Enter)"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onSearchSubmit) {
                  onSearchSubmit()
                }
              }}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                onClick={() => {
                  onSearchChange('')
                  if (onSearchSubmit) onSearchSubmit()
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {activeSearchTerm && pagination && (
            <p className="text-sm text-muted-foreground">
              Found {pagination.totalCount} result{pagination.totalCount !== 1 ? 's' : ''} for &quot;{activeSearchTerm}&quot;
            </p>
          )}
        </div>
        
        {selectedTransactions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedTransactions.length} selected
            </span>
            {onBulkDelete && canDeleteTransactions && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all transactions"
                />
              </TableHead>
              <TableHead>Transaction #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <td colSpan={9} className="text-center py-8 text-muted-foreground">
                  No transactions found
                </td>
              </TableRow>
            ) : (
              transactions.map((transaction) => (
                <TransactionTableRow
                  key={transaction._id}
                  transaction={transaction}
                  isSelected={selectedTransactions.includes(transaction._id)}
                  onSelect={handleSelectTransaction}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onGenerateInvoice={onGenerateInvoice}
                  canEdit={canEditTransactions}
                  canDelete={canDeleteTransactions}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination */}
      {pagination && onPageChange && onItemsPerPageChange && (
        <PaginationControls
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalCount}
          itemsPerPage={pagination.limit}
          onPageChange={onPageChange}
          onItemsPerPageChange={onItemsPerPageChange}
        />
      )}
    </div>
  )
}