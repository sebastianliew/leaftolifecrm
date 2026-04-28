"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransactions, useDeleteTransaction, useUpdateTransaction, useDuplicateTransaction } from '@/hooks/queries/use-transaction-queries'
import { TransactionTable } from './TransactionTable'
import { EditorialModal, EditorialModalFooter, EditorialButton, EditorialNote } from '@/components/ui/editorial'
import { SimpleTransactionForm } from './SimpleTransactionForm'
import { TransactionDeleteDialog } from './transaction-delete-dialog'
import { TransactionDuplicateDialog } from './transaction-duplicate-dialog'
import { useToast } from '@/components/ui/use-toast'
import { useInventory } from '@/hooks/useInventory'
import { useTransactions as useTransactionsHook } from '@/hooks/useTransactions'
import { usePermissions } from '@/hooks/usePermissions'
import type { Transaction, TransactionFormData } from '@/types/transaction'
import type { TransactionFilterValues } from './TransactionFilters'
import { APIError } from '@/lib/errors/api-error'

function formatInsufficientStock(err: APIError): string {
  if (!err.isInsufficientStock()) return err.message
  return err.details.items.map((i) => {
    if (i.reason === 'product_not_found') return `• ${i.productName}: product not found`
    const poolLabel = i.pool === 'loose' ? ' (loose)' : i.pool === 'sealed' ? ' (sealed)' : ''
    return `• ${i.productName}: need ${i.requested}, ${i.available} available${poolLabel}`
  }).join('\n')
}

interface InvoiceGenerationResult {
  success: boolean;
  invoicePath: string;
  invoiceNumber: string;
  downloadUrl: string;
}

const DEFAULT_FILTERS: TransactionFilterValues = {
  paymentStatus: "all",
  status: "all",
  dateFrom: undefined,
  dateTo: undefined,
}

export function TransactionList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchInput, setSearchInput] = useState('')  // For immediate UI updates
  const [searchTerm, setSearchTerm] = useState('')   // For actual API calls
  const [filters, setFilters] = useState<TransactionFilterValues>(DEFAULT_FILTERS)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null)
  const [duplicatingTransaction, setDuplicatingTransaction] = useState<Transaction | null>(null)
  const [cancellingTransaction, setCancellingTransaction] = useState<Transaction | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const { toast } = useToast()
  const { products, getProducts } = useInventory()
  const { generateInvoice } = useTransactionsHook()
  const { hasPermission } = usePermissions()
  // Ref-based lock to prevent duplicate submissions
  const isSubmittingRef = useRef(false)

  // Get transaction permissions
  const canEditTransactions = hasPermission('transactions', 'canEditTransactions')
  const canEditDrafts = hasPermission('transactions', 'canEditDrafts')
  const canDeleteTransactions = hasPermission('transactions', 'canDeleteTransactions')
  const canCreateTransactions = hasPermission('transactions', 'canCreateTransactions')

  // Handle search input change (only updates UI, no API call)
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
  }, [])

  // Handle search submission (Enter key or clear)
  const handleSearchSubmit = useCallback(() => {
    const trimmedSearch = searchInput.trim()
    setSearchTerm(trimmedSearch)
    setCurrentPage(1) // Reset to first page on search
  }, [searchInput])

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: TransactionFilterValues) => {
    setFilters(newFilters)
    setCurrentPage(1) // Reset to first page on filter change
  }, [])

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setCurrentPage(1)
  }, [])

  // Build query params from filters
  const queryFilters = useMemo(() => {
    const params: {
      search?: string
      page: number
      limit: number
      paymentStatus?: string
      status?: string
      dateFrom?: string
      dateTo?: string
    } = {
      page: currentPage,
      limit: itemsPerPage,
    }

    if (searchTerm) {
      params.search = searchTerm
    }

    if (filters.paymentStatus && filters.paymentStatus !== "all") {
      params.paymentStatus = filters.paymentStatus
    }

    if (filters.status && filters.status !== "all") {
      params.status = filters.status
    }

    if (filters.dateFrom) {
      params.dateFrom = filters.dateFrom.toISOString()
    }

    if (filters.dateTo) {
      params.dateTo = filters.dateTo.toISOString()
    }

    return params
  }, [searchTerm, currentPage, itemsPerPage, filters])

  const {
    data: response,
    isLoading,
    error,
    refetch
  } = useTransactions(queryFilters)

  const transactions = useMemo(() => response?.transactions || [], [response?.transactions])
  const pagination = response?.pagination

  const deleteTransactionMutation = useDeleteTransaction()
  const updateTransactionMutation = useUpdateTransaction()
  const duplicateTransactionMutation = useDuplicateTransaction()

  // Pagination handlers
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handleItemsPerPageChange = useCallback((limit: number) => {
    setItemsPerPage(limit)
    setCurrentPage(1) // Reset to first page when changing page size
  }, [])

  // Get fresh transaction data from the list when editing
  const editingTransaction = useMemo(() => {
    if (!editingTransactionId) return null
    return transactions.find(t => t._id === editingTransactionId) || null
  }, [editingTransactionId, transactions])

  // Open edit dialog from ?edit=<id> query (deep link from transaction detail
  // page). Strip the param after consuming so closing the dialog doesn't
  // immediately re-open it (and doesn't trigger an infinite re-set loop).
  const handledEditParamRef = useRef<string | null>(null)
  useEffect(() => {
    const editId = searchParams?.get('edit')
    if (!editId) return
    if (handledEditParamRef.current === editId) return
    handledEditParamRef.current = editId
    setEditingTransactionId(editId)
    // Remove the query param from the URL without adding a new history entry.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('edit')
      window.history.replaceState(null, '', url.toString())
    }
  }, [searchParams])

  const handleEdit = (transaction: Transaction) => {
    setEditingTransactionId(transaction._id)
    // Load products for the form
    getProducts().catch(console.error)
  }

  const handleDelete = async (transactionId: string) => {
    // Check if it's a draft by looking at the transaction object
    const transaction = transactions.find(t => t._id === transactionId)
    if (transaction) {
      setDeletingTransaction(transaction)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingTransaction) return

    const isDraft = deletingTransaction.status === 'draft'

    try {
      // Both drafts and regular transactions are now in the database
      await deleteTransactionMutation.mutateAsync(deletingTransaction._id)
      toast({
        title: 'Success',
        description: `${isDraft ? 'Draft' : 'Transaction'} deleted successfully`
      })
      refetch()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to delete ${isDraft ? 'draft' : 'transaction'}`,
        variant: 'destructive'
      })
    } finally {
      setDeletingTransaction(null)
    }
  }

  // Handle duplicate transaction
  const handleDuplicate = (transaction: Transaction) => {
    setDuplicatingTransaction(transaction)
  }

  const handleConfirmDuplicate = async () => {
    if (!duplicatingTransaction) return

    try {
      const newTransaction = await duplicateTransactionMutation.mutateAsync(duplicatingTransaction._id)
      toast({
        title: 'Transaction Duplicated',
        description: `Created new draft: ${newTransaction.transactionNumber}`
      })
      setDuplicatingTransaction(null)
      // Redirect to the new transaction
      router.push(`/transactions/${newTransaction._id}`)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to duplicate transaction',
        variant: 'destructive'
      })
    }
  }

  // Handle cancel draft (sets status to 'cancelled')
  const handleCancelDraft = (transaction: Transaction) => {
    if (transaction.status === 'draft') {
      setCancellingTransaction(transaction)
    }
  }

  const handleConfirmCancelDraft = async () => {
    if (!cancellingTransaction) return

    try {
      await updateTransactionMutation.mutateAsync({
        id: cancellingTransaction._id,
        data: {
          ...cancellingTransaction,
          status: 'cancelled'
        } as TransactionFormData
      })
      toast({
        title: 'Draft Cancelled',
        description: 'The draft has been marked as cancelled'
      })
      refetch()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel draft',
        variant: 'destructive'
      })
    } finally {
      setCancellingTransaction(null)
    }
  }

  const handleGenerateInvoice = async (transactionId: string) => {
    try {
      console.log('[Invoice] Generating invoice for transaction:', transactionId);
      const result = await generateInvoice(transactionId) as InvoiceGenerationResult;
      console.log('[Invoice] Generated successfully:', result);

      // Download PDF with authentication (filename extracted from downloadUrl)
      await downloadInvoicePDF(result.downloadUrl);

      toast({
        title: 'Invoice Generated',
        description: result.invoiceNumber
          ? `Invoice ${result.invoiceNumber} generated successfully`
          : 'Invoice generated successfully'
      });

      // Refresh transaction list to show updated invoice status
      refetch();
    } catch (error) {
      console.error('[Invoice] Generation failed:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate invoice',
        variant: 'destructive'
      });
    }
  }

  const downloadInvoicePDF = async (downloadUrl: string) => {
    try {
      // Get token from authToken (used by api-client)
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
      const fullUrl = `${apiBase.replace(/\/api$/, '')}${downloadUrl}`;

      const response = await fetch(fullUrl, {
        credentials: 'include', // Include cookies
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }

      // Extract filename from downloadUrl (e.g., /api/invoices/TXN_Name_DDMMYYYY.pdf)
      const filename = downloadUrl.split('/').pop() || 'invoice.pdf';

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('[Invoice] Download failed:', error);
      throw error;
    }
  }

  const handleBulkDelete = async (transactionIds: string[]) => {
    // For bulk delete, we'll still use window.confirm for now
    // Could be extended to use a custom bulk delete dialog in the future
    if (confirm(`Are you sure you want to delete ${transactionIds.length} transactions?`)) {
      try {
        await Promise.all(
          transactionIds.map(id => deleteTransactionMutation.mutateAsync(id))
        )
        toast({
          title: 'Success',
          description: `${transactionIds.length} transactions deleted successfully`
        })
        refetch()
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to delete some transactions',
          variant: 'destructive'
        })
      }
    }
  }

  const handleUpdateTransaction = async (data: TransactionFormData) => {
    if (!editingTransaction?._id) return

    // Prevent duplicate submissions
    if (isSubmittingRef.current || updateTransactionMutation.isPending) {
      console.log('[TransactionList] Blocked duplicate transaction update')
      return
    }

    isSubmittingRef.current = true

    try {
      const result = await updateTransactionMutation.mutateAsync({
        id: editingTransaction._id,
        data
      }) as unknown as {
        _oversoldItems?: Array<{ productName: string; deficit: number; currentStock: number }>
      }
      toast({
        title: "Success",
        description: "Transaction updated successfully",
      })

      // Non-blocking warning: surface oversold items so admin can reconcile.
      const oversold = result?._oversoldItems ?? []
      if (oversold.length > 0) {
        const lines = oversold.map((o) =>
          `• ${o.productName}: ${o.deficit} owed (now at ${o.currentStock})`
        )
        toast({
          title: `${oversold.length} item${oversold.length === 1 ? "" : "s"} oversold — please restock soon`,
          description: lines.join("\n"),
        })
      }

      setEditingTransactionId(null)
      // React Query will automatically invalidate and refetch
    } catch (error) {
      console.error('Failed to update transaction:', error)
      if (error instanceof APIError && error.isInsufficientStock()) {
        toast({
          title: 'Insufficient stock',
          description: formatInsufficientStock(error),
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to update transaction',
          variant: 'destructive',
        })
      }
    } finally {
      isSubmittingRef.current = false
    }
  }

  const handleUpdateDraft = async (data: TransactionFormData) => {
    if (!editingTransaction?._id) return

    // Prevent duplicate submissions
    if (isSubmittingRef.current || updateTransactionMutation.isPending) {
      console.log('[TransactionList] Blocked duplicate draft update')
      return
    }

    isSubmittingRef.current = true

    try {
      const updatedData = {
        ...data,
        isDraft: true,
        status: 'draft' as const
      }
      
      // Use the correct update mutation (not the draft creation endpoint)
      await updateTransactionMutation.mutateAsync({
        id: editingTransaction._id,
        data: updatedData
      })
      
      toast({
        title: "Draft Updated",
        description: "Draft has been updated successfully",
      })
      
      // Keep the dialog open so user can see the toast
      // The user can close it manually or continue editing
      
      // Don't call manual refetch - React Query will handle it automatically
    } catch (error) {
      console.error('Failed to update draft:', error)
      if (error instanceof APIError && error.isInsufficientStock()) {
        toast({
          title: 'Insufficient stock',
          description: formatInsufficientStock(error),
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to update draft',
          variant: 'destructive',
        })
      }
    } finally {
      isSubmittingRef.current = false
    }
  }

  if (isLoading) {
    return (
      <div className="mt-12 space-y-2 animate-pulse">
        <div className="h-10 w-full max-w-sm bg-[#F3F4F6]" />
        <div className="space-y-1">
          <div className="h-12 w-full bg-[#F3F4F6]" />
          <div className="h-12 w-full bg-[#F3F4F6]" />
          <div className="h-12 w-full bg-[#F3F4F6]" />
          <div className="h-12 w-full bg-[#F3F4F6]" />
        </div>
      </div>
    )
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load transactions'
    const isAuthError = errorMessage.includes('Access token required') || errorMessage.includes('401')

    return (
      <div className="mt-8">
        <EditorialNote tone="danger" kicker="Error">
          {isAuthError
            ? 'Authentication required. Please log in to continue.'
            : `${errorMessage}. Please try again.`}
        </EditorialNote>
      </div>
    )
  }

  return (
    <>
      <TransactionTable
        transactions={transactions}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onCancelDraft={handleCancelDraft}
        onGenerateInvoice={handleGenerateInvoice}
        onBulkDelete={handleBulkDelete}
        searchTerm={searchInput}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        pagination={pagination}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
        activeSearchTerm={searchTerm}
        canEditTransactions={canEditTransactions}
        canEditDrafts={canEditDrafts}
        canDeleteTransactions={canDeleteTransactions}
        canCreateTransactions={canCreateTransactions}
      />

      {/* Edit Transaction Dialog */}
      <EditorialModal
        open={!!editingTransaction}
        onOpenChange={(open) => !open && setEditingTransactionId(null)}
        kicker="Transactions"
        title={
          editingTransaction?.status === 'draft' || editingTransaction?.status === 'cancelled'
            ? `Edit ${editingTransaction.status === 'cancelled' ? 'cancelled transaction' : 'draft'}`
            : 'Edit transaction'
        }
        size="2xl"
      >
        {editingTransaction && (
          <SimpleTransactionForm
            products={products}
            initialData={editingTransaction}
            onSubmit={handleUpdateTransaction}
            onSaveDraft={editingTransaction.status === 'draft' || editingTransaction.status === 'cancelled' ? handleUpdateDraft : undefined}
            onCancel={() => setEditingTransactionId(null)}
            loading={updateTransactionMutation.isPending}
          />
        )}
      </EditorialModal>

      {/* Delete Transaction Dialog */}
      <TransactionDeleteDialog
        transaction={deletingTransaction}
        open={!!deletingTransaction}
        onOpenChange={(open) => !open && setDeletingTransaction(null)}
        onConfirm={handleConfirmDelete}
        loading={deleteTransactionMutation.isPending}
      />

      {/* Duplicate Transaction Dialog */}
      <TransactionDuplicateDialog
        transaction={duplicatingTransaction}
        open={!!duplicatingTransaction}
        onOpenChange={(open) => !open && setDuplicatingTransaction(null)}
        onConfirm={handleConfirmDuplicate}
        loading={duplicateTransactionMutation.isPending}
      />

      {/* Cancel Draft Dialog */}
      <EditorialModal
        open={!!cancellingTransaction}
        onOpenChange={(open) => !open && setCancellingTransaction(null)}
        kicker="Cancel draft"
        kickerTone="warning"
        title="Cancel this draft?"
        description="The draft will be marked as cancelled. You can still find it using the Cancelled status filter."
      >
        <EditorialModalFooter>
          <EditorialButton variant="ghost" onClick={() => setCancellingTransaction(null)}>
            Keep draft
          </EditorialButton>
          <EditorialButton variant="primary" arrow onClick={handleConfirmCancelDraft} disabled={updateTransactionMutation.isPending}>
            {updateTransactionMutation.isPending ? 'Cancelling…' : 'Cancel draft'}
          </EditorialButton>
        </EditorialModalFooter>
      </EditorialModal>
    </>
  )
}