"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Transaction } from "@/types/transaction"

interface TransactionDeleteDialogProps {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading?: boolean
}

export function TransactionDeleteDialog({ 
  transaction, 
  open, 
  onOpenChange, 
  onConfirm, 
  loading = false 
}: TransactionDeleteDialogProps) {
  if (!transaction) return null

  const isDraft = transaction.status === 'draft'
  const itemType = isDraft ? 'draft' : 'transaction'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {isDraft ? 'Draft' : 'Transaction'}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              <p className="mb-4">
                Are you sure you want to delete this {itemType}?
              </p>
              
              <div className="space-y-1 text-sm mb-4">
                <div><strong>Transaction Number:</strong> {transaction.transactionNumber}</div>
                <div><strong>Customer:</strong> {transaction.customerName}</div>
                <div><strong>Amount:</strong> {transaction.currency} {transaction.totalAmount.toFixed(2)}</div>
                <div><strong>Type:</strong> {transaction.type}</div>
                {transaction.createdAt && (
                  <div><strong>Date:</strong> {new Date(transaction.createdAt).toLocaleDateString()}</div>
                )}
              </div>
              
              <p className="font-medium">
                <strong>This action cannot be undone.</strong> {isDraft ? 'The draft' : 'All transaction data'} will be permanently removed from the system.
              </p>
              
              {!isDraft && transaction.paymentStatus === 'paid' && (
                <div className="text-amber-600 font-medium mt-2">
                  Warning: This is a completed transaction with payment received.
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {loading ? "Deleting..." : `Delete ${isDraft ? 'Draft' : 'Transaction'}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}