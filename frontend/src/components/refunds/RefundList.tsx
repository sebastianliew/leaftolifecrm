"use client"

import { useState, useEffect } from 'react'
import { useRefunds } from '@/hooks/queries/use-refund-queries'
import { Refund, RefundStatus, RefundFilters } from '@/types/refund'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import {
  EditorialTable,
  EditorialTHead,
  EditorialTh,
  EditorialTr,
  EditorialTd,
  EditorialEmptyRow,
  EditorialButton,
  EditorialPagination,
} from '@/components/ui/editorial'

const statusToneMap: Record<RefundStatus, string> = {
  pending: 'text-[#EA580C]',
  approved: 'text-[#0A0A0A]',
  processing: 'text-[#6B7280]',
  completed: 'text-[#16A34A]',
  rejected: 'text-[#DC2626]',
  cancelled: 'text-[#9CA3AF]',
}

interface RefundListProps {
  filters?: RefundFilters
}

export function RefundList({ filters = {} }: RefundListProps) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const { data, isLoading, error, refetch } = useRefunds({ ...filters, page, limit })

  useEffect(() => {
    setPage(1)
  }, [filters])

  const refunds = (data?.refunds || []) as Refund[]
  const rawPagination = (data?.pagination || { total: 0, page: 1, limit: 20 }) as {
    total: number; page: number; limit: number; pages?: number; totalPages?: number
  }
  const pagination = {
    total: rawPagination.total,
    page: rawPagination.page,
    limit: rawPagination.limit,
    pages: rawPagination.pages ?? rawPagination.totalPages ?? 0,
  }

  if (error) {
    return (
      <div className="text-center py-20 mt-8">
        <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-[#DC2626]" />
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#DC2626]">Could not load</p>
        <p className="text-sm italic font-light text-[#6B7280] mt-3 mb-6">There was an error reaching the refund service.</p>
        <EditorialButton variant="primary" arrow onClick={() => refetch()}>
          <RefreshCw className="h-3 w-3" /> Retry
        </EditorialButton>
      </div>
    )
  }

  return (
    <>
      <EditorialTable>
        <EditorialTHead>
          <EditorialTh>Refund #</EditorialTh>
          <EditorialTh>Customer</EditorialTh>
          <EditorialTh>Transaction</EditorialTh>
          <EditorialTh align="right">Amount</EditorialTh>
          <EditorialTh>Reason</EditorialTh>
          <EditorialTh>Status</EditorialTh>
          <EditorialTh align="right">Date</EditorialTh>
          <EditorialTh align="right" className="w-32">Actions</EditorialTh>
        </EditorialTHead>
        <tbody>
          {isLoading ? (
            <EditorialEmptyRow colSpan={8} title="Loading" description="Fetching refund records…" />
          ) : refunds.length === 0 ? (
            <EditorialEmptyRow
              colSpan={8}
              description={Object.keys(filters).length > 0 ? "No refunds match your current filters." : "No refunds have been processed yet."}
            />
          ) : (
            refunds.map((refund) => {
              const tone = statusToneMap[refund.status] || 'text-[#6B7280]'
              return (
                <EditorialTr key={refund._id}>
                  <EditorialTd size="md" className="font-mono tracking-wide">{refund.refundNumber}</EditorialTd>
                  <EditorialTd>{refund.customerName}</EditorialTd>
                  <EditorialTd className="font-mono tracking-wide">{refund.originalTransactionNumber}</EditorialTd>
                  <EditorialTd align="right" size="md" className="tabular-nums">
                    ${refund.refundAmount?.toFixed(2)}
                  </EditorialTd>
                  <EditorialTd className="italic font-light">
                    {refund.refundReason?.replace('_', ' ') || '—'}
                  </EditorialTd>
                  <EditorialTd>
                    <span className={`text-[10px] uppercase tracking-[0.28em] ${tone}`}>{refund.status}</span>
                  </EditorialTd>
                  <EditorialTd align="right" className="tabular-nums">
                    {new Date(refund.createdAt).toLocaleDateString()}
                  </EditorialTd>
                  <EditorialTd align="right">
                    <div className="flex items-center justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                      <button className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280] hover:text-[#0A0A0A] transition-colors">
                        View
                      </button>
                      {refund.status === 'pending' && (
                        <>
                          <button className="text-[10px] uppercase tracking-[0.28em] text-[#16A34A] hover:opacity-80 transition-opacity">
                            Approve
                          </button>
                          <button className="text-[10px] uppercase tracking-[0.28em] text-[#DC2626] hover:opacity-80 transition-opacity">
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </EditorialTd>
                </EditorialTr>
              )
            })
          )}
        </tbody>
      </EditorialTable>

      {pagination.total > 0 && (
        <EditorialPagination
          total={pagination.total}
          page={pagination.page}
          limit={pagination.limit}
          pages={pagination.pages}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1) }}
        />
      )}
    </>
  )
}
