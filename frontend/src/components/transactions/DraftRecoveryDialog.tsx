'use client'

import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Clock, Trash2 } from 'lucide-react'
import type { DraftData } from '@/lib/client/draftStorage'
import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
} from '@/components/ui/editorial'

interface DraftRecoveryDialogProps {
  isOpen: boolean
  onClose: () => void
  drafts: DraftData[]
  onSelectDraft: (draftId: string) => void
  onDeleteDraft: (draftId: string) => void
}

export function DraftRecoveryDialog({
  isOpen,
  onClose,
  drafts,
  onSelectDraft,
  onDeleteDraft,
}: DraftRecoveryDialogProps) {
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)

  const getFormSummary = (formData: Record<string, unknown>) => {
    const items = Array.isArray(formData.items) ? formData.items : []
    const customerName = typeof formData.customerName === 'string' ? formData.customerName : 'No customer'
    const totalAmount = typeof formData.totalAmount === 'number' ? formData.totalAmount : 0
    return { customerName, itemCount: items.length, totalAmount: totalAmount.toFixed(2) }
  }

  const handleContinue = () => {
    if (selectedDraftId) {
      onSelectDraft(selectedDraftId)
      onClose()
    }
  }

  const handleDeleteDraft = (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onDeleteDraft(draftId)
    if (selectedDraftId === draftId) setSelectedDraftId(null)
  }

  return (
    <EditorialModal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      kicker="Drafts found"
      title="Resume an incomplete transaction?"
      description="You have unsaved transaction drafts. Continue working on one or start fresh."
      size="lg"
    >
      <ScrollArea className="max-h-96">
        <div className="space-y-2">
          {drafts.map((draft) => {
            const summary = getFormSummary(draft.formData)
            const isSelected = selectedDraftId === draft.draftId
            return (
              <div
                key={draft.draftId}
                onClick={() => setSelectedDraftId(draft.draftId)}
                className={`px-5 py-4 cursor-pointer transition-colors border-l-2 ${
                  isSelected ? 'border-[#0A0A0A] bg-[#FAFAFA]' : 'border-[#E5E7EB] hover:bg-[#FAFAFA]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="text-[14px] text-[#0A0A0A] font-medium">
                        {draft.draftName || `Draft for ${summary.customerName}`}
                      </p>
                      <span className="text-[10px] uppercase tracking-[0.22em] text-[#6B7280]">
                        {summary.itemCount} item{summary.itemCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-[12px] text-[#6B7280] space-y-1">
                      <p>Customer · {summary.customerName}</p>
                      <p className="tabular-nums">Total · ${summary.totalAmount}</p>
                      <p className="flex items-center gap-1.5 italic font-light">
                        <Clock className="h-3 w-3" />
                        Saved {formatDate(draft.timestamp)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteDraft(draft.draftId, e)}
                    title="Delete draft"
                    className="text-[#6B7280] hover:text-[#DC2626] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={onClose}>
          Start fresh
        </EditorialButton>
        <EditorialButton variant="primary" arrow onClick={handleContinue} disabled={!selectedDraftId}>
          Continue draft
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>
  )
}
