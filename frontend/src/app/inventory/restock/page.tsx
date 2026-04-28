'use client'

import { useState } from 'react'
import { RestockCart } from '../../../components/inventory/RestockCart'
import { EditorialPage, EditorialMasthead, EditorialButton } from '@/components/ui/editorial'

export default function RestockDashboard() {
  const [tab, setTab] = useState<'cart' | 'history'>('cart')

  return (
    <EditorialPage>
      <EditorialMasthead
        kicker="Inventory · Restock"
        title="Replenishment"
        subtitle="Build a restock cart and process products in bulk."
      >
        <EditorialButton variant={tab === 'cart' ? 'ghost-active' : 'ghost'} onClick={() => setTab('cart')}>
          Cart
        </EditorialButton>
        <EditorialButton variant={tab === 'history' ? 'ghost-active' : 'ghost'} onClick={() => setTab('history')}>
          History
        </EditorialButton>
      </EditorialMasthead>

      {tab === 'cart' && (
        <section className="mt-8">
          <RestockCart onProcessComplete={() => { /* no-op */ }} />
        </section>
      )}

      {tab === 'history' && (
        <section className="mt-8 text-center py-20">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">History</p>
          <p className="text-sm italic font-light text-[#6B7280] mt-3">
            Past restock operations and audit trails coming soon.
          </p>
        </section>
      )}
    </EditorialPage>
  )
}
