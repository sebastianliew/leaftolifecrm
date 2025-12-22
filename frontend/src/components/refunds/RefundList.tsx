"use client"

import { useState, useEffect } from 'react'
import { useRefunds } from '@/hooks/queries/use-refund-queries'
import { Refund, RefundStatus, RefundFilters } from '@/types/refund'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, CheckCircle, Clock, XCircle, Plus, RefreshCw } from 'lucide-react'

const statusColors: Record<RefundStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800'
}

const statusIcons: Record<RefundStatus, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  approved: <CheckCircle className="h-4 w-4" />,
  processing: <Clock className="h-4 w-4" />,
  completed: <CheckCircle className="h-4 w-4" />,
  rejected: <XCircle className="h-4 w-4" />,
  cancelled: <AlertTriangle className="h-4 w-4" />
}

interface RefundListProps {
  filters?: RefundFilters
}

export function RefundList({ filters = {} }: RefundListProps) {
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useRefunds({ ...filters, page, limit: 20 })
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [filters])
  
  const refunds = (data?.refunds || []) as Refund[]
  const pagination = data?.pagination

  // Always show the full UI structure
  return (
    <Card>
      <CardHeader>
        <CardTitle>Refunds ({pagination?.total || 0})</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-400" />
            <p className="text-gray-600 mb-4">Unable to load refunds</p>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : refunds.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No refunds found</h3>
            <p className="text-gray-600 mb-4">
              {Object.keys(filters).length > 0 
                ? "No refunds match your current filters."
                : "No refunds have been processed yet."
              }
            </p>
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create New Refund
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {refunds.map((refund) => (
              <div key={refund._id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{refund.refundNumber}</h3>
                      <Badge className={statusColors[refund.status]}>
                        <span className="flex items-center gap-1">
                          {statusIcons[refund.status]}
                          {refund.status}
                        </span>
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Customer:</span>
                        <p>{refund.customerName}</p>
                      </div>
                      <div>
                        <span className="font-medium">Transaction:</span>
                        <p>{refund.originalTransactionNumber}</p>
                      </div>
                      <div>
                        <span className="font-medium">Amount:</span>
                        <p className="font-semibold text-green-600">${refund.refundAmount?.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="font-medium">Date:</span>
                        <p>{new Date(refund.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div className="mt-3 text-sm text-gray-600">
                      <span className="font-medium">Reason:</span> {refund.refundReason?.replace('_', ' ')}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                    
                    {refund.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="text-green-600">
                          Approve
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600">
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}