"use client"

import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
} from "@/components/ui/editorial"
import type { Patient } from "@/types/patient"

interface PatientDeleteDialogProps {
  patient: Patient | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading?: boolean
}

export function PatientDeleteDialog({ patient, open, onOpenChange, onConfirm, loading }: PatientDeleteDialogProps) {
  if (!patient) return null

  return (
    <EditorialModal
      open={open}
      onOpenChange={onOpenChange}
      kicker="Deactivate patient"
      kickerTone="danger"
      title={`Deactivate ${patient.firstName} ${patient.lastName}?`}
      description="The patient will be set to inactive and hidden from default views. Their data and transaction history are preserved."
    >
      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </EditorialButton>
        <EditorialButton variant="primary" arrow onClick={onConfirm} disabled={loading}>
          {loading ? "Deactivating…" : "Deactivate patient"}
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>
  )
}
