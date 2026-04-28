"use client"

import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
} from "@/components/ui/editorial"

interface AppointmentBulkDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  selectedCount: number
  loading?: boolean
}

export function AppointmentBulkDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  selectedCount,
  loading,
}: AppointmentBulkDeleteDialogProps) {
  const plural = selectedCount !== 1
  return (
    <EditorialModal
      open={open}
      onOpenChange={onOpenChange}
      kicker="Bulk delete"
      kickerTone="danger"
      title={`Remove ${selectedCount} appointment${plural ? 's' : ''}?`}
      description={`This action cannot be undone. The selected appointment${plural ? 's' : ''} will be permanently removed and cancellation notices sent to patients.`}
    >
      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </EditorialButton>
        <EditorialButton variant="primary" arrow onClick={onConfirm} disabled={loading}>
          {loading ? 'Deleting…' : `Delete ${selectedCount} appointment${plural ? 's' : ''}`}
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>
  )
}
