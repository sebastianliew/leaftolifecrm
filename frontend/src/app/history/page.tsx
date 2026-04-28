"use client"

import { useState, useEffect, useCallback } from "react"
import { useTransactions } from "@/hooks/useTransactions"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { HiFunnel } from "react-icons/hi2"
import {
  EditorialPage,
  EditorialMasthead,
  EditorialSearch,
  EditorialButton,
  EditorialFilterRow,
  EditorialField,
  EditorialSelect,
  EditorialTable,
  EditorialTHead,
  EditorialTh,
  EditorialTr,
  EditorialTd,
  EditorialEmptyRow,
  EditorialErrorScreen,
  EditorialMeta,
  EditorialPill,
} from "@/components/ui/editorial"

const statusToneMap: Record<string, "muted" | "ink" | "danger" | "warning" | "ok"> = {
  completed: 'ok',
  pending: 'warning',
  cancelled: 'danger',
  draft: 'muted',
}

export default function HistoryPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showFilters, setShowFilters] = useState(false)

  const { transactions = [], loading, error, getTransactions } = useTransactions()

  const handleSearch = useCallback((term: string) => setSearchTerm(term), [])

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch =
      searchTerm === "" ||
      transaction.transactionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || transaction.status === statusFilter
    return matchesSearch && matchesStatus
  })

  useEffect(() => {
    getTransactions()
  }, [getTransactions])

  if (error) {
    return (
      <EditorialErrorScreen
        title="Could not load history."
        description="There was an error reaching the transaction service."
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <EditorialPage>
      <EditorialMasthead
        kicker="History"
        title="Ledger archive"
        subtitle={
          <>
            <span className="tabular-nums">{filteredTransactions.length}</span> transaction
            {filteredTransactions.length === 1 ? '' : 's'} on file
          </>
        }
      >
        <EditorialSearch onSearch={handleSearch} placeholder="Search history..." />
        <EditorialButton
          variant={showFilters ? 'ghost-active' : 'ghost'}
          icon={<HiFunnel className="h-3 w-3" />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filter
        </EditorialButton>
      </EditorialMasthead>

      {showFilters && (
        <EditorialFilterRow columns={2}>
          <EditorialField label="Status">
            <EditorialSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
              <option value="draft">Draft</option>
            </EditorialSelect>
          </EditorialField>
        </EditorialFilterRow>
      )}

      <EditorialTable>
        <EditorialTHead>
          <EditorialTh>Transaction</EditorialTh>
          <EditorialTh>Date</EditorialTh>
          <EditorialTh>Customer</EditorialTh>
          <EditorialTh align="right">Total</EditorialTh>
          <EditorialTh>Status</EditorialTh>
          <EditorialTh align="right">Items</EditorialTh>
        </EditorialTHead>
        <tbody>
          {loading ? (
            <EditorialEmptyRow colSpan={6} title="Loading" description="Fetching transaction history…" />
          ) : filteredTransactions.length === 0 ? (
            <EditorialEmptyRow colSpan={6} description="No transactions match the current filters." />
          ) : (
            filteredTransactions.map((transaction) => {
              const tone = statusToneMap[transaction.status || ''] || 'muted'
              return (
                <EditorialTr key={transaction._id}>
                  <EditorialTd size="md" className="font-mono tracking-wide">
                    {transaction.transactionNumber || transaction._id}
                  </EditorialTd>
                  <EditorialTd className="tabular-nums">
                    {format(new Date(transaction.createdAt), "MMM dd, yyyy")}
                  </EditorialTd>
                  <EditorialTd size="md" className="pr-4">
                    <p className="text-[14px] text-[#0A0A0A]">{transaction.customerName || 'Unknown'}</p>
                    {transaction.customerEmail && <EditorialMeta>{transaction.customerEmail}</EditorialMeta>}
                  </EditorialTd>
                  <EditorialTd align="right" size="md" className="tabular-nums">
                    {formatCurrency(transaction.totalAmount || 0)}
                  </EditorialTd>
                  <EditorialTd>
                    <EditorialPill tone={tone}>{transaction.status || 'unknown'}</EditorialPill>
                  </EditorialTd>
                  <EditorialTd align="right" className="tabular-nums">
                    {transaction.items?.length || 0}
                  </EditorialTd>
                </EditorialTr>
              )
            })
          )}
        </tbody>
      </EditorialTable>
    </EditorialPage>
  )
}
