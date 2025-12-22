"use client"

import React from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { FaEye, FaEdit, FaReceipt, FaTrash } from "react-icons/fa"
import type { Transaction } from "@/types/transaction"

interface TransactionTableRowProps {
  transaction: Transaction
  isSelected: boolean
  onSelect: (transactionId: string, checked: boolean) => void
  onEdit: (transaction: Transaction) => void
  onDelete: (transactionId: string) => void
  onGenerateInvoice: (transactionId: string) => void
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

const getTypeColor = (type: string) => {
  switch (type) {
    case "DRAFT":
      return "bg-yellow-100 text-yellow-800"
    case "COMPLETED":
      return "bg-green-100 text-green-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
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
  onGenerateInvoice
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
        <Badge className={getTypeColor(transaction.type)}>
          {transaction.type}
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
        <div className="flex items-center gap-1">
          <Link href={`/transactions/${transaction._id}`}>
            <Button variant="ghost" size="icon" title="View details">
              <FaEye className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(transaction)}
            title="Edit transaction"
          >
            <FaEdit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onGenerateInvoice(transaction._id)}
            title="Generate invoice"
          >
            <FaReceipt className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(transaction._id)}
            title="Delete transaction"
          >
            <FaTrash className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for performance
  // Return true if props are equal (skip re-render), false if different (re-render)
  return prevProps.transaction._id === nextProps.transaction._id &&
         prevProps.transaction.paymentStatus === nextProps.transaction.paymentStatus &&
         prevProps.transaction.totalAmount === nextProps.transaction.totalAmount &&
         prevProps.transaction.customerName === nextProps.transaction.customerName &&
         prevProps.transaction.type === nextProps.transaction.type &&
         prevProps.transaction.transactionDate === nextProps.transaction.transactionDate &&
         prevProps.transaction.updatedAt === nextProps.transaction.updatedAt &&
         prevProps.isSelected === nextProps.isSelected
})

TransactionTableRow.displayName = 'TransactionTableRow'