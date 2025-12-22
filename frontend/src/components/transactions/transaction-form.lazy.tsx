"use client"

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { TransactionFormProps } from './transaction-form-refactored'

export const TransactionForm = dynamic<TransactionFormProps>(
  () => import('./transaction-form-refactored').then(mod => ({ default: mod.TransactionForm })),
  {
    loading: () => <TransactionFormSkeleton />,
    ssr: false
  }
)

function TransactionFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-96" />
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}