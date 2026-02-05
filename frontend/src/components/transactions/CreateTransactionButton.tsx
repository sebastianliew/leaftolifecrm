"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SimpleTransactionForm } from './SimpleTransactionForm'
import { useInventory } from '@/hooks/useInventory'
import { useCreateTransaction } from '@/hooks/queries/use-transaction-queries'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { fetchAPI, queryKeys } from '@/lib/query-client'
import type { TransactionFormData } from '@/types/transaction'

export function CreateTransactionButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isDraftSaving, setIsDraftSaving] = useState(false)
  // Persist draftId across saves to prevent duplicate drafts
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
  const { products, getProducts } = useInventory()
  const createTransactionMutation = useCreateTransaction()
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
      setIsDraftSaving(false)
      isSubmittingRef.current = false
    }
  }, [isOpen, getProducts])

  const handleSubmit = async (data: TransactionFormData) => {
    // CRITICAL: Ref-based lock to prevent duplicate submissions
    if (isSubmittingRef.current || createTransactionMutation.isPending) {
      console.log('[CreateTransactionButton] Blocked duplicate submission')
      return
    }

    isSubmittingRef.current = true

    try {
      await createTransactionMutation.mutateAsync(data)
      toast({
        title: "Success",
        description: "Transaction created successfully",
      })
      setIsOpen(false)
      // React Query will automatically invalidate and refetch the transaction list
    } catch (error) {
      console.error('Failed to create transaction:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create transaction",
        variant: "destructive",
      })
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
      await fetchAPI('/transactions/drafts/autosave', {
        method: 'POST',
        body: JSON.stringify({
          draftId,
          draftName,
          formData: data
        })
      })

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