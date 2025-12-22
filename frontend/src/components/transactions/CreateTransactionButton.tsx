"use client"

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SimpleTransactionForm } from './SimpleTransactionForm'
import { useInventory } from '@/hooks/useInventory'
import { useCreateTransaction } from '@/hooks/queries/use-transaction-queries'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import type { TransactionFormData } from '@/types/transaction'

export function CreateTransactionButton() {
  const [isOpen, setIsOpen] = useState(false)
  const { products, getProducts } = useInventory()
  const createTransactionMutation = useCreateTransaction()
  const { toast } = useToast()
  const auth = useAuth()

  useEffect(() => {
    if (isOpen) {
      getProducts().catch(console.error)
    }
  }, [isOpen, getProducts])

  const handleSubmit = async (data: TransactionFormData) => {
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
    }
  }

  const handleSaveDraft = async (data: TransactionFormData) => {
    try {
      if (!auth.isAuthenticated || !auth.user) {
        console.error('Auth state:', { isAuthenticated: auth.isAuthenticated, user: auth.user })
        throw new Error('User not authenticated')
      }
      
      const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      const draftName = `Draft ${new Date().toLocaleString()}`
      
      // Save to database via API  
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const response = await fetch(`${apiUrl}/transactions/drafts/autosave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          draftId,
          draftName,
          formData: data
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to save draft to server')
      }
      
      await response.json()
      
      toast({
        title: "Draft Saved",
        description: "Transaction saved as draft successfully. Refresh the page to see latest updates.",
      })
    } catch (error) {
      console.error('Failed to save draft:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save draft",
        variant: "destructive",
      })
    }
  }

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
            loading={createTransactionMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}