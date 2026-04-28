"use client"

import { useState, useMemo, useCallback } from 'react'
import { RefundList } from '@/components/refunds/RefundList'
import { RefundFilters } from '@/components/refunds/RefundFilters'
import { HiPlus, HiFunnel } from 'react-icons/hi2'
import type { RefundFilters as RefundFiltersType, RefundStatus } from '@/types/refund'
import { usePermissions } from '@/hooks/usePermissions'
import {
  EditorialPage,
  EditorialMasthead,
  EditorialSearch,
  EditorialButton,
  EditorialFilterRow,
  EditorialField,
  EditorialSelect,
} from '@/components/ui/editorial'

export default function RefundsPage() {
  const { hasPermission } = usePermissions()
  const canProcessRefunds = hasPermission('transactions', 'canRefundTransactions')

  const [searchTerm, setSearchTerm] = useState('')
  const [quickStatusFilter, setQuickStatusFilter] = useState<RefundStatus | 'all'>('all')
  const [advancedFilters, setAdvancedFilters] = useState<RefundFiltersType>({})
  const [showFilters, setShowFilters] = useState(false)

  const combinedFilters = useMemo(() => {
    const filters: RefundFiltersType = { ...advancedFilters }
    if (searchTerm.trim()) filters.searchTerm = searchTerm.trim()
    if (quickStatusFilter && quickStatusFilter !== 'all') filters.status = quickStatusFilter
    return filters
  }, [searchTerm, quickStatusFilter, advancedFilters])

  const handleSearch = useCallback((term: string) => setSearchTerm(term), [])

  const handleQuickStatusChange = (status: string) => {
    setQuickStatusFilter(status as RefundStatus | 'all')
    if (status !== 'all' && advancedFilters.status && advancedFilters.status !== status) {
      setAdvancedFilters(prev => ({ ...prev, status: undefined }))
    }
  }

  return (
    <EditorialPage>
      <EditorialMasthead
        kicker="Refunds"
        title="Ledger"
        subtitle="Track and manage customer refunds"
      >
        <EditorialSearch onSearch={handleSearch} placeholder="Search refunds..." />
        <EditorialButton
          variant={showFilters ? 'ghost-active' : 'ghost'}
          icon={<HiFunnel className="h-3 w-3" />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filter
        </EditorialButton>
        {canProcessRefunds && (
          <EditorialButton variant="primary" icon={<HiPlus className="h-3 w-3" />} arrow>
            New refund
          </EditorialButton>
        )}
      </EditorialMasthead>

      {showFilters && (
        <EditorialFilterRow columns={2}>
          <EditorialField label="Status">
            <EditorialSelect value={quickStatusFilter} onChange={(e) => handleQuickStatusChange(e.target.value)}>
              <option value="all">All status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </EditorialSelect>
          </EditorialField>
        </EditorialFilterRow>
      )}

      {showFilters && <RefundFilters onFiltersChange={setAdvancedFilters} />}

      <RefundList filters={combinedFilters} />
    </EditorialPage>
  )
}
