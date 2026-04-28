'use client'

import { Package, Plus } from 'lucide-react'
import { ProductAdditionMethod } from '@/types/inventory'
import { EditorialModal } from '@/components/ui/editorial'

interface ProductAddMethodModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectMethod: (method: ProductAdditionMethod) => void
}

export function ProductAddMethodModal({ isOpen, onClose, onSelectMethod }: ProductAddMethodModalProps) {
  const options = [
    {
      id: 'template' as ProductAdditionMethod,
      icon: Package,
      title: 'Add stock to existing product',
      description: 'Pick a product already in inventory and increase its stock.',
    },
    {
      id: 'new' as ProductAdditionMethod,
      icon: Plus,
      title: 'Create new product',
      description: 'Add a brand-new SKU to inventory from scratch.',
    },
  ]

  return (
    <EditorialModal
      open={isOpen}
      onOpenChange={(o) => !o && onClose()}
      kicker="Inventory"
      title="Add product"
      description="Choose how you want to add product to inventory."
    >
      <div className="space-y-2">
        {options.map((option) => {
          const Icon = option.icon
          return (
            <button
              key={option.id}
              onClick={() => onSelectMethod(option.id)}
              className="w-full text-left p-5 border border-[#E5E7EB] hover:border-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
            >
              <div className="flex items-start gap-4">
                <Icon className="h-5 w-5 text-[#0A0A0A] mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-[14px] text-[#0A0A0A] font-medium">{option.title}</p>
                  <p className="text-[11px] text-[#6B7280] italic font-light mt-1 leading-relaxed">{option.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </EditorialModal>
  )
}
