"use client"

import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
} from "@/components/ui/editorial"
import type { BlendTemplate } from '@/types/blend'

interface TemplateDeleteDialogProps {
  template: BlendTemplate | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading?: boolean
}

export function TemplateDeleteDialog({ template, open, onOpenChange, onConfirm, loading }: TemplateDeleteDialogProps) {
  if (!template) return null

  return (
    <EditorialModal
      open={open}
      onOpenChange={onOpenChange}
      kicker="Delete template"
      kickerTone="danger"
      title={`Remove ${template.name}?`}
      description="This action cannot be undone. The template will be permanently removed."
    >
      {template.usageCount > 0 && (
        <div className="border-l-2 border-[#EA580C] bg-[#FFF7ED] px-5 py-4 mb-6">
          <p className="text-[13px] text-[#0A0A0A] leading-relaxed">
            This template has been used <span className="tabular-nums font-medium">{template.usageCount}</span>{' '}
            time{template.usageCount !== 1 ? 's' : ''}. Existing transactions will retain a snapshot, but
            this template will no longer be usable in new sales.
          </p>
        </div>
      )}
      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </EditorialButton>
        <EditorialButton variant="primary" arrow onClick={onConfirm} disabled={loading}>
          {loading ? 'Deleting…' : 'Delete template'}
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>
  )
}
