"use client"

import React from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  canDelete?: boolean
  canCreate?: boolean
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800"
    case "pending":
      return "bg-yellow-100 text-yellow-800"
    case "partial":
      return "bg-blue-100 text-blue-800"
    case "overdue":
    case "failed":
      return "bg-red-100 text-red-800"
    case "refunded":
      return "bg-purple-100 text-purple-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

const getTypeColor = (type: string, status?: string) => {
  // Check status first for cancelled transactions
  if (status === "cancelled") {
    return "bg-red-100 text-red-800"
  }
  switch (type) {
    case "DRAFT":
      return "bg-yellow-100 text-yellow-800"
    case "COMPLETED":
      return "bg-green-100 text-green-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

const getTypeLabel = (type: string, status?: string) => {
  if (status === "cancelled") {
    return "CANCELLED"
  }
  return type
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-GB')
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'SGD'
  }).format(amount)
}

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
  canDelete = false,
  canCreate = false
}: TransactionTableRowProps) => {
  const itemCount = transaction.items.reduce((sum, item) => sum + item.quantity, 0)
  
  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell className="w-12">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(transaction._id, checked as boolean)}
        />
      </TableCell>
      <TableCell className="font-medium">
        {transaction.transactionNumber}
      </TableCell>
      <TableCell>{formatDate(transaction.transactionDate)}</TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{transaction.customerName}</div>
          {transaction.customerEmail && (
            <div className="text-sm text-gray-500">{transaction.customerEmail}</div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge className={getTypeColor(transaction.type, transaction.status)}>
          {getTypeLabel(transaction.type, transaction.status)}
        </Badge>
      </TableCell>
      <TableCell className="text-center">{itemCount}</TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(transaction.totalAmount)}
      </TableCell>
      <TableCell>
        <Badge className={getStatusColor(transaction.paymentStatus)}>
          {transaction.paymentStatus}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/transactions/${transaction._id}`}>
                <FaEye className="mr-2 h-4 w-4" />
                View details
              </Link>
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onClick={() => onEdit(transaction)}>
                <FaEdit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {canCreate && onDuplicate && (
              <DropdownMenuItem onClick={() => onDuplicate(transaction)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onGenerateInvoice(transaction._id)}>
              <FaReceipt className="mr-2 h-4 w-4" />
              Generate invoice
            </DropdownMenuItem>
            {transaction.status === 'draft' && onCancelDraft && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onCancelDraft(transaction)}
                  className="text-orange-600 focus:text-orange-600"
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Cancel Draft
                </DropdownMenuItem>
              </>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(transaction._id)}
                  className="text-red-600 focus:text-red-600"
                >
                  <FaTrash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for performance
  // Return true if props are equal (skip re-render), false if different (re-render)
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
         prevProps.canDelete === nextProps.canDelete &&
         prevProps.canCreate === nextProps.canCreate
})

TransactionTableRow.displayName = 'TransactionTableRow'