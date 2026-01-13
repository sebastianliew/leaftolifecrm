"use client"

import { useState, useMemo, useCallback } from 'react'
import { useTransactions, useDeleteTransaction, useUpdateTransaction } from '@/hooks/queries/use-transaction-queries'
import { TransactionTable } from './TransactionTable'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SimpleTransactionForm } from './SimpleTransactionForm'
import { TransactionDeleteDialog } from './transaction-delete-dialog'
import { useToast } from '@/components/ui/use-toast'
import { useInventory } from '@/hooks/useInventory'
import { useTransactions as useTransactionsHook } from '@/hooks/useTransactions'
import { usePermissions } from '@/hooks/usePermissions'
import type { Transaction, TransactionFormData } from '@/types/transaction'
import type { TransactionFilterValues } from './TransactionFilters'

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
  const [searchInput, setSearchInput] = useState('')  // For immediate UI updates
  const [searchTerm, setSearchTerm] = useState('')   // For actual API calls
  const [filters, setFilters] = useState<TransactionFilterValues>(DEFAULT_FILTERS)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null)
  const [cancellingTransaction, setCancellingTransaction] = useState<Transaction | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const { toast } = useToast()
  const { products, getProducts } = useInventory()
  const { generateInvoice } = useTransactionsHook()
  const { hasPermission } = usePermissions()
  
  // Get transaction permissions
  const canEditTransactions = hasPermission('transactions', 'canEditTransactions')
  const canDeleteTransactions = hasPermission('transactions', 'canDeleteTransactions')

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
    } catch (_error) {
      toast({
        title: 'Error',
        description: `Failed to delete ${isDraft ? 'draft' : 'transaction'}`,
        variant: 'destructive'
      })
    } finally {
      setDeletingTransaction(null)
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
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel draft',
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

      // Download PDF with authentication
      await downloadInvoicePDF(result.downloadUrl, result.invoiceNumber);

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

  const downloadInvoicePDF = async (downloadUrl: string, filename: string) => {
    try {
      // Get token from authToken (used by api-client)
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
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

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.pdf`;
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
      } catch (_error) {
        toast({
          title: 'Error',
          description: 'Failed to delete some transactions',
          variant: 'destructive'
        })
      }
    }
  }

  const handleUpdateTransaction = async (data: TransactionFormData) => {
    if (!editingTransaction?._id) return

    try {
      await updateTransactionMutation.mutateAsync({
        id: editingTransaction._id,
        data
      })
      toast({
        title: "Success",
        description: "Transaction updated successfully",
      })
      setEditingTransactionId(null)
      // React Query will automatically invalidate and refetch
    } catch (error) {
      console.error('Failed to update transaction:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update transaction",
        variant: "destructive",
      })
    }
  }

  const handleUpdateDraft = async (data: TransactionFormData) => {
    if (!editingTransaction?._id) return

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
      
      // Show toast after a small delay to avoid interference with React Query's automatic refetch
      setTimeout(() => {
        toast({
          title: "Draft Updated",
          description: "Draft has been updated successfully",
        })
      }, 100)
      
      // Keep the dialog open so user can see the toast
      // The user can close it manually or continue editing
      
      // Don't call manual refetch - React Query will handle it automatically
    } catch (error) {
      console.error('Failed to update draft:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update draft",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load transactions'
    const isAuthError = errorMessage.includes('Access token required') || errorMessage.includes('401')
    
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {isAuthError 
            ? 'Authentication required. Please log in to continue.' 
            : `${errorMessage}. Please try again.`
          }
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <TransactionTable
        transactions={transactions}
        onEdit={handleEdit}
        onDelete={handleDelete}
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
        canDeleteTransactions={canDeleteTransactions}
      />

      {/* Edit Transaction Dialog */}
      <Dialog open={!!editingTransaction} onOpenChange={() => setEditingTransactionId(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTransaction?.status === 'draft' ? 'Edit Draft' : 'Edit Transaction'}
            </DialogTitle>
          </DialogHeader>
          {editingTransaction && (
            <SimpleTransactionForm
              products={products}
              initialData={editingTransaction}
              onSubmit={handleUpdateTransaction}
              onSaveDraft={editingTransaction.status === 'draft' ? handleUpdateDraft : undefined}
              onCancel={() => setEditingTransactionId(null)}
              loading={updateTransactionMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Transaction Dialog */}
      <TransactionDeleteDialog
        transaction={deletingTransaction}
        open={!!deletingTransaction}
        onOpenChange={(open) => !open && setDeletingTransaction(null)}
        onConfirm={handleConfirmDelete}
        loading={deleteTransactionMutation.isPending}
      />

      {/* Cancel Draft Dialog */}
      <Dialog open={!!cancellingTransaction} onOpenChange={(open) => !open && setCancellingTransaction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Draft</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this draft? The draft will be marked as cancelled
              and can be found using the &quot;Cancelled&quot; status filter.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancellingTransaction(null)}>
              No, Keep Draft
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancelDraft}
              disabled={updateTransactionMutation.isPending}
            >
              {updateTransactionMutation.isPending ? 'Cancelling...' : 'Yes, Cancel Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}