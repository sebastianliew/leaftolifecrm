"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SimpleTransactionForm } from './SimpleTransactionForm'
import { useInventory } from '@/hooks/useInventory'
import { useCreateTransaction, useUpdateTransaction } from '@/hooks/queries/use-transaction-queries'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { fetchAPI, queryKeys } from '@/lib/query-client'
import { APIError } from '@/lib/errors/api-error'
import type { TransactionFormData } from '@/types/transaction'

export function CreateTransactionButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isDraftSaving, setIsDraftSaving] = useState(false)
  // Persist draftId across saves to prevent duplicate drafts
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
  // Server-side transaction _id of the saved draft. When this exists, Pay
  // converts the existing draft instead of creating a brand-new transaction —
  // prevents the "1 draft + 1 completed" duplicate when the user saves a
  // draft and submits within the same modal session.
  const [currentDraftTxnId, setCurrentDraftTxnId] = useState<string | null>(null)
  const { products, getProducts } = useInventory()
  const createTransactionMutation = useCreateTransaction()
  const updateTransactionMutation = useUpdateTransaction()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  // Ref-based lock to prevent duplicate API calls (independent of React state timing)
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      getProducts().catch(console.error)
    } else {
      // Reset draft state when dialog closes
      setCurrentDraftId(null)
      setCurrentDraftTxnId(null)
      setIsDraftSaving(false)
      isSubmittingRef.current = false
    }
  }, [isOpen, getProducts])

  const handleSubmit = async (data: TransactionFormData) => {
    // CRITICAL: Ref-based lock to prevent duplicate submissions
    if (
      isSubmittingRef.current ||
      createTransactionMutation.isPending ||
      updateTransactionMutation.isPending
    ) {
      console.log('[CreateTransactionButton] Blocked duplicate submission')
      return
    }

    isSubmittingRef.current = true

    try {
      // If a draft was saved within this modal session, convert it in place
      // rather than creating a second record. The update controller handles
      // the draft→completed status transition, including stock deduction.
      const result = currentDraftTxnId
        ? await updateTransactionMutation.mutateAsync({
            id: currentDraftTxnId,
            data: { ...data, status: 'completed' } as Partial<typeof data> & { status: 'completed' },
          }) as unknown as {
            _oversoldItems?: Array<{ productName: string; deficit: number; currentStock: number }>
          }
        : await createTransactionMutation.mutateAsync(data) as unknown as {
            _oversoldItems?: Array<{ productName: string; deficit: number; currentStock: number }>
          }
      toast({
        title: "Success",
        description: currentDraftTxnId
          ? "Draft converted to completed transaction"
          : "Transaction created successfully",
      })

      // Non-blocking warning: if any item went negative, surface it so admin
      // knows to reconcile later. Patient flow continues uninterrupted.
      const oversold = result?._oversoldItems ?? []
      if (oversold.length > 0) {
        const lines = oversold.map((o) =>
          `• ${o.productName}: ${o.deficit} owed (now at ${o.currentStock})`
        )
        toast({
          title: `${oversold.length} item${oversold.length === 1 ? "" : "s"} oversold — please restock soon`,
          description: lines.join("\n"),
          variant: "default",
        })
      }

      setIsOpen(false)
      // React Query will automatically invalidate and refetch the transaction list
    } catch (error) {
      console.error('Failed to create transaction:', error)
      if (error instanceof APIError && error.isInsufficientStock()) {
        const lines = error.details.items.map((i) => {
          if (i.reason === 'product_not_found') return `• ${i.productName}: product not found`
          const poolLabel = i.pool === 'loose' ? 'loose' : i.pool === 'sealed' ? 'sealed' : ''
          const suffix = poolLabel ? ` (${poolLabel})` : ''
          return `• ${i.productName}: need ${i.requested}, ${i.available} available${suffix}`
        })
        toast({
          title: 'Insufficient stock',
          description: lines.join('\n'),
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to create transaction',
          variant: 'destructive',
        })
      }
    } finally {
      isSubmittingRef.current = false
    }
  }

  const handleSaveDraft = useCallback(async (data: TransactionFormData) => {
    // Prevent duplicate draft saves - check both ref and state
    if (isSubmittingRef.current || isDraftSaving) {
      console.log('[CreateTransactionButton] Blocked duplicate draft save')
      return
    }

    // Set both ref (immediate) and state (for UI) to block duplicates
    isSubmittingRef.current = true
    setIsDraftSaving(true)

    try {
      // Reuse existing draftId or create new one - prevents duplicate drafts!
      const draftId = currentDraftId || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      const draftName = `Draft ${new Date().toLocaleString()}`

      // Store draftId for future saves (only on first save)
      if (!currentDraftId) {
        setCurrentDraftId(draftId)
      }

      // Save to database via API using fetchAPI (handles auth automatically)
      const draftResponse = await fetchAPI<{
        success: boolean
        draftId: string
        transactionId: string
        message: string
      }>('/transactions/drafts/autosave', {
        method: 'POST',
        body: JSON.stringify({
          draftId,
          draftName,
          formData: data
        })
      })

      // Capture the server-side _id so a later Pay click in the same modal
      // session converts this draft instead of creating a duplicate.
      if (draftResponse?.transactionId) {
        setCurrentDraftTxnId(draftResponse.transactionId)
      }

      // Invalidate transactions query to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions })

      toast({
        title: currentDraftId ? "Draft Updated" : "Draft Saved",
        description: currentDraftId 
          ? "Draft updated successfully." 
          : "Transaction saved as draft successfully.",
      })
    } catch (error) {
      console.error('Failed to save draft:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save draft",
        variant: "destructive",
      })
    } finally {
      isSubmittingRef.current = false
      setIsDraftSaving(false)
    }
  }, [currentDraftId, isDraftSaving, queryClient, toast])

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
      >
        <Plus className="w-4 h-4" />
        New Transaction
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Transaction</DialogTitle>
          </DialogHeader>
          <SimpleTransactionForm
            products={products}
            onSubmit={handleSubmit}
            onSaveDraft={handleSaveDraft}
            onCancel={() => setIsOpen(false)}
            loading={createTransactionMutation.isPending || isDraftSaving}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}