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

interface TransactionDuplicateDialogProps {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading?: boolean
}

export function TransactionDuplicateDialog({
  transaction,
  open,
  onOpenChange,
  onConfirm,
  loading = false
}: TransactionDuplicateDialogProps) {
  if (!transaction) return null

  const itemCount = transaction.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Duplicate Transaction</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              <p className="mb-4">
                This will create a new draft transaction with the same customer and item details.
              </p>

              <div className="space-y-1 text-sm mb-4">
                <div><strong>Original Transaction:</strong> {transaction.transactionNumber}</div>
                <div><strong>Customer:</strong> {transaction.customerName}</div>
                <div><strong>Items:</strong> {itemCount} item{itemCount !== 1 ? 's' : ''}</div>
                <div><strong>Amount:</strong> {transaction.currency} {transaction.totalAmount.toFixed(2)}</div>
              </div>

              <p className="text-muted-foreground">
                The new transaction will be created as a <strong>Draft</strong> with:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>A new transaction number</li>
                <li>Payment status reset to pending</li>
                <li>Today&apos;s date as the transaction date</li>
                <li>No invoice generated</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Duplicating..." : "Duplicate as Draft"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
