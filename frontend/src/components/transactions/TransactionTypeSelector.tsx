"use client"

import { FaBox, FaFlask, FaCubes, FaStethoscope } from "react-icons/fa"
import { HiOutlinePencilSquare } from "react-icons/hi2"
import { EditorialModal } from "@/components/ui/editorial"

interface TransactionTypeSelectorProps {
  open: boolean
  onClose: () => void
  onSelectType: (type: 'product' | 'blend' | 'bundle' | 'consultation' | 'miscellaneous') => void
}

export function TransactionTypeSelector({ open, onClose, onSelectType }: TransactionTypeSelectorProps) {
  const transactionTypes = [
    { id: 'product', title: 'Product', description: 'Sell individual products from inventory.', icon: FaBox },
    { id: 'blend', title: 'Blend', description: 'Mix custom or pre-defined blends.', icon: FaFlask },
    { id: 'bundle', title: 'Bundle', description: 'Pre-packaged product bundles.', icon: FaCubes },
    { id: 'consultation', title: 'Consultation', description: 'Professional consultation services.', icon: FaStethoscope },
    { id: 'miscellaneous', title: 'Miscellaneous', description: 'Other items (supplies, fees, services).', icon: HiOutlinePencilSquare },
  ] as const

  return (
    <EditorialModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      kicker="New transaction"
      title="What are you selling?"
      description="Pick the line type to add — this scopes the next selector."
      size="lg"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {transactionTypes.map((type) => {
          const Icon = type.icon
          return (
            <button
              key={type.id}
              onClick={() => onSelectType(type.id)}
              className="text-left p-5 border border-[#E5E7EB] hover:border-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
            >
              <Icon className="w-5 h-5 mb-3 text-[#0A0A0A]" />
              <p className="text-[14px] text-[#0A0A0A] font-medium">{type.title}</p>
              <p className="text-[11px] text-[#6B7280] italic font-light mt-1 leading-relaxed">{type.description}</p>
            </button>
          )
        })}
      </div>
    </EditorialModal>
  )
}
