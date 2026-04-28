"use client"

import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
} from "@/components/ui/editorial"
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
  loading = false,
}: TransactionDuplicateDialogProps) {
  if (!transaction) return null

  const itemCount = transaction.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <EditorialModal
      open={open}
      onOpenChange={onOpenChange}
      kicker="Duplicate transaction"
      title="Create draft from this?"
      description="A new draft transaction will be created with the same customer and item details."
    >
      <div className="grid grid-cols-2 gap-x-10 gap-y-3 text-[13px] text-[#0A0A0A]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Source</p>
          <p className="font-mono tracking-wide mt-1">{transaction.transactionNumber}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Customer</p>
          <p className="mt-1">{transaction.customerName}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Items</p>
          <p className="tabular-nums mt-1">
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Amount</p>
          <p className="tabular-nums mt-1">
            {transaction.currency} {(transaction.totalAmount ?? 0).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-6 border-l-2 border-[#0A0A0A] bg-[#FAFAFA] px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">Draft will reset</p>
        <ul className="mt-2 space-y-1 text-[13px] text-[#0A0A0A]">
          <li>New transaction number</li>
          <li>Payment status set to pending</li>
          <li>Today&apos;s date as transaction date</li>
          <li>No invoice generated</li>
        </ul>
      </div>

      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </EditorialButton>
        <EditorialButton variant="primary" arrow onClick={onConfirm} disabled={loading}>
          {loading ? 'Duplicating…' : 'Duplicate as draft'}
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>
  )
}
