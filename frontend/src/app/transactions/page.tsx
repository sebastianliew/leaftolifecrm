"use client"

import { CreateTransactionButton } from '@/components/transactions/CreateTransactionButton'
import { TransactionList } from '@/components/transactions/TransactionList'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { usePermissions } from '@/hooks/usePermissions'

export default function TransactionsPage() {
  const { hasPermission } = usePermissions()
  const canCreateTransactions = hasPermission('transactions', 'canCreateTransactions')

  return (
    <AuthGuard>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Transaction Management</h1>
            <p className="text-sm text-gray-600">Process sales and manage transactions</p>
          </div>

          {canCreateTransactions && <CreateTransactionButton />}
        </div>

        <TransactionList />
      </div>
    </AuthGuard>
  )
}