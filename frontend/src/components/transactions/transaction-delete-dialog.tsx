"use client"

import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
} from "@/components/ui/editorial"
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
  loading = false,
}: TransactionDeleteDialogProps) {
  if (!transaction) return null

  const isDraft = transaction.status === 'draft'
  const isPaidComplete = !isDraft && transaction.paymentStatus === 'paid'

  return (
    <EditorialModal
      open={open}
      onOpenChange={onOpenChange}
      kicker={isDraft ? 'Delete draft' : 'Archive transaction'}
      kickerTone="danger"
      title={isDraft ? `Remove draft?` : `Archive transaction?`}
      description={
        isDraft
          ? 'This action cannot be undone. The draft will be permanently removed.'
          : 'The transaction will be archived — kept in the database for audit but hidden from default queries. An administrator can restore it.'
      }
    >
      <div className="grid grid-cols-2 gap-x-10 gap-y-3 text-[13px] text-[#0A0A0A]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Number</p>
          <p className="font-mono tracking-wide mt-1">{transaction.transactionNumber}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Customer</p>
          <p className="mt-1">{transaction.customerName}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Amount</p>
          <p className="tabular-nums mt-1">
            {transaction.currency} {(transaction.totalAmount ?? 0).toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Type</p>
          <p className="italic font-light mt-1">{transaction.type}</p>
        </div>
        {transaction.createdAt && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Date</p>
            <p className="tabular-nums mt-1">{new Date(transaction.createdAt).toLocaleDateString()}</p>
          </div>
        )}
      </div>

      {isPaidComplete && (
        <div className="mt-6 border-l-2 border-[#EA580C] bg-[#FFF7ED] px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#EA580C]">Warning</p>
          <p className="text-[13px] text-[#0A0A0A] mt-2">
            This is a completed transaction with payment received.
          </p>
        </div>
      )}

      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </EditorialButton>
        <EditorialButton variant="primary" arrow onClick={onConfirm} disabled={loading}>
          {loading ? 'Deleting…' : isDraft ? 'Delete draft' : 'Archive transaction'}
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>
  )
}
