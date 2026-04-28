"use client"

import { CreateTransactionButton } from '@/components/transactions/CreateTransactionButton'
import { TransactionList } from '@/components/transactions/TransactionList'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { usePermissions } from '@/hooks/usePermissions'
import { EditorialPage, EditorialMasthead } from '@/components/ui/editorial'

export default function TransactionsPage() {
  const { hasPermission } = usePermissions()
  const canCreateTransactions = hasPermission('transactions', 'canCreateTransactions')

  return (
    <AuthGuard>
      <EditorialPage>
        <EditorialMasthead
          kicker="Transactions"
          title="Sales journal"
          subtitle="Process sales and manage transactions."
        >
          {canCreateTransactions && <CreateTransactionButton />}
        </EditorialMasthead>

        <TransactionList />
      </EditorialPage>
    </AuthGuard>
  )
}
