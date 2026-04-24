"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api-client"
import { formatCurrency } from "@/utils/currency"
import type { Transaction } from "@/types/transaction"

interface Props {
  patientId: string
  patientName: string
}

interface TransactionsResponse {
  transactions: Transaction[]
  pagination: { totalCount: number; currentPage: number; totalPages: number }
}

export function PatientInvoicesTab({ patientId, patientName }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includeCancelled, setIncludeCancelled] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const params: Record<string, string> = {
          customerId: patientId,
          limit: "100",
          page: "1",
        }
        if (includeCancelled) params.includeCancelled = "true"
        const res = await api.get("/transactions", params)
        if (!res.ok) throw new Error(res.error || "Failed to load invoices")
        const data = res.data as TransactionsResponse
        if (cancelled) return
        setTransactions(data.transactions || [])
        setTotalCount(data.pagination?.totalCount ?? (data.transactions || []).length)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [patientId, includeCancelled])

  const formatDate = (d?: string | Date) => {
    if (!d) return "—"
    const date = new Date(d)
    if (isNaN(date.getTime())) return "—"
    return date.toLocaleDateString("en-GB")
  }

  const paymentBadgeColor = (s?: string) => {
    switch (s) {
      case "paid":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-amber-100 text-amber-800"
      case "failed":
      case "overdue":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const statusBadgeColor = (s?: string) => {
    switch (s) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "draft":
        return "bg-blue-100 text-blue-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "refunded":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices ({totalCount})</CardTitle>
        <CardDescription>All transactions linked to {patientName}</CardDescription>
        <div className="flex items-center gap-2 mt-2">
          <Checkbox
            id="include-cancelled"
            checked={includeCancelled}
            onCheckedChange={(v) => setIncludeCancelled(!!v)}
          />
          <label htmlFor="include-cancelled" className="text-sm text-gray-700 cursor-pointer">
            Include cancelled / draft invoices
          </label>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading invoices…</div>
        ) : error ? (
          <div className="text-center py-8 text-red-600">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No invoices found for this patient.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => {
                const itemsCount = (t.items || []).reduce((s, i) => s + (i.quantity ?? 0), 0)
                const invoiceLabel =
                  t.invoiceNumber ||
                  t.transactionNumber ||
                  (t._id ? `#${t._id.slice(-6)}` : "—")
                return (
                  <TableRow key={t._id}>
                    <TableCell className="font-mono text-xs">{invoiceLabel}</TableCell>
                    <TableCell>{formatDate(t.transactionDate)}</TableCell>
                    <TableCell>{itemsCount}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(t.totalAmount ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadgeColor(t.status)}>{t.status || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={paymentBadgeColor(t.paymentStatus)}>
                        {t.paymentStatus || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/transactions/${t._id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
