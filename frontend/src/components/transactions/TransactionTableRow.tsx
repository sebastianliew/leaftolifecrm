"use client"

import React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { MoreVertical, Ban, Copy } from "lucide-react"
import { FaEye, FaEdit, FaReceipt, FaTrash } from "react-icons/fa"
import type { Transaction } from "@/types/transaction"
import {
  EditorialTr,
  EditorialTd,
  EditorialPill,
  EditorialMeta,
} from "@/components/ui/editorial"

interface TransactionTableRowProps {
  transaction: Transaction
  isSelected: boolean
  onSelect: (transactionId: string, checked: boolean) => void
  onEdit: (transaction: Transaction) => void
  onDelete: (transactionId: string) => void
  onDuplicate?: (transaction: Transaction) => void
  onCancelDraft?: (transaction: Transaction) => void
  onGenerateInvoice: (transactionId: string) => void
  canEdit?: boolean
  canEditDrafts?: boolean
  canDelete?: boolean
  canCreate?: boolean
}

const paymentToneMap: Record<string, "muted" | "ink" | "danger" | "warning" | "ok"> = {
  paid: "ok",
  pending: "warning",
  partial: "warning",
  overdue: "danger",
  failed: "danger",
  refunded: "ink",
}

const typeToneMap = (type: string, status?: string): "muted" | "ink" | "danger" | "warning" | "ok" => {
  if (status === "cancelled") return "danger"
  if (type === "DRAFT") return "warning"
  if (type === "COMPLETED") return "ok"
  return "muted"
}

const typeLabel = (type: string, status?: string) => {
  if (status === "cancelled") return "CANCELLED"
  return type
}

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-GB")

const formatCurrency = (amount: number | undefined | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "SGD" }).format(amount ?? 0)

export const TransactionTableRow = React.memo(({
  transaction,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onCancelDraft,
  onGenerateInvoice,
  canEdit = false,
  canEditDrafts = false,
  canDelete = false,
  canCreate = false,
}: TransactionTableRowProps) => {
  const itemCount = (transaction.items || []).reduce((sum, item) => sum + (item.quantity ?? 0), 0)
  const paymentTone = paymentToneMap[transaction.paymentStatus || ""] || "muted"

  return (
    <EditorialTr>
      <EditorialTd className="w-8 pr-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(transaction._id, checked as boolean)}
        />
      </EditorialTd>
      <EditorialTd size="md" className="font-mono tracking-wide">
        {transaction.transactionNumber}
      </EditorialTd>
      <EditorialTd className="tabular-nums">{formatDate(transaction.transactionDate)}</EditorialTd>
      <EditorialTd size="md" className="pr-4">
        <p className="text-[14px] text-[#0A0A0A]">{transaction.customerName}</p>
        {transaction.customerEmail && <EditorialMeta>{transaction.customerEmail}</EditorialMeta>}
      </EditorialTd>
      <EditorialTd>
        <EditorialPill tone={typeToneMap(transaction.type, transaction.status)}>
          {typeLabel(transaction.type, transaction.status)}
        </EditorialPill>
      </EditorialTd>
      <EditorialTd align="right" className="tabular-nums">
        {itemCount}
      </EditorialTd>
      <EditorialTd align="right" size="md" className="tabular-nums">
        {formatCurrency(transaction.totalAmount)}
      </EditorialTd>
      <EditorialTd>
        <EditorialPill tone={paymentTone}>{transaction.paymentStatus}</EditorialPill>
      </EditorialTd>
      <EditorialTd align="right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors opacity-40 group-hover:opacity-100"
              aria-label="Actions"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/transactions/${transaction._id}`}>
                <FaEye className="mr-2 h-3 w-3" />
                View details
              </Link>
            </DropdownMenuItem>
            {(canEdit || (canEditDrafts && (transaction.status === "draft" || transaction.status === "cancelled"))) && (
              <DropdownMenuItem onClick={() => onEdit(transaction)}>
                <FaEdit className="mr-2 h-3 w-3" />
                Edit
              </DropdownMenuItem>
            )}
            {canCreate && onDuplicate && (
              <DropdownMenuItem onClick={() => onDuplicate(transaction)}>
                <Copy className="mr-2 h-3 w-3" />
                Duplicate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onGenerateInvoice(transaction._id)}>
              <FaReceipt className="mr-2 h-3 w-3" />
              Generate invoice
            </DropdownMenuItem>
            {transaction.status === "draft" && onCancelDraft && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onCancelDraft(transaction)}
                  className="text-[#EA580C] focus:text-[#EA580C]"
                >
                  <Ban className="mr-2 h-3 w-3" />
                  Cancel draft
                </DropdownMenuItem>
              </>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(transaction._id)}
                  className="text-[#DC2626] focus:text-[#DC2626]"
                >
                  <FaTrash className="mr-2 h-3 w-3" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </EditorialTd>
    </EditorialTr>
  )
}, (prevProps, nextProps) => {
  return prevProps.transaction._id === nextProps.transaction._id &&
    prevProps.transaction.paymentStatus === nextProps.transaction.paymentStatus &&
    prevProps.transaction.status === nextProps.transaction.status &&
    prevProps.transaction.totalAmount === nextProps.transaction.totalAmount &&
    prevProps.transaction.customerName === nextProps.transaction.customerName &&
    prevProps.transaction.type === nextProps.transaction.type &&
    prevProps.transaction.transactionDate === nextProps.transaction.transactionDate &&
    prevProps.transaction.updatedAt === nextProps.transaction.updatedAt &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.canEdit === nextProps.canEdit &&
    prevProps.canEditDrafts === nextProps.canEditDrafts &&
    prevProps.canDelete === nextProps.canDelete &&
    prevProps.canCreate === nextProps.canCreate
})

TransactionTableRow.displayName = "TransactionTableRow"
