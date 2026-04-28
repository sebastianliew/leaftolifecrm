"use client"

import { FaFlask, FaPlusCircle } from "react-icons/fa"
import { EditorialModal } from "@/components/ui/editorial"

interface SimpleBlendSelectorProps {
  open: boolean
  onClose: () => void
  onSelectFixedBlend: () => void
  onSelectCustomBlend: () => void
}

export function SimpleBlendSelector({ open, onClose, onSelectFixedBlend, onSelectCustomBlend }: SimpleBlendSelectorProps) {
  const blendOptions = [
    {
      id: 'fixed',
      title: 'Pre-defined blend',
      description: 'Select from saved blend templates.',
      icon: FaFlask,
      action: onSelectFixedBlend,
    },
    {
      id: 'custom',
      title: 'Custom blend',
      description: 'Create a new blend on the fly.',
      icon: FaPlusCircle,
      action: onSelectCustomBlend,
    },
  ]

  return (
    <EditorialModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      kicker="Blend"
      title="Select blend type"
      description="Pick the kind of blend to add to this transaction."
    >
      <div className="space-y-2">
        {blendOptions.map((option) => {
          const Icon = option.icon
          return (
            <button
              key={option.id}
              onClick={option.action}
              className="w-full text-left p-5 border border-[#E5E7EB] hover:border-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
            >
              <div className="flex items-start gap-4">
                <Icon className="w-5 h-5 text-[#0A0A0A] mt-1" />
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
