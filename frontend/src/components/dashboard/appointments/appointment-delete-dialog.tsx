"use client"

import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
} from "@/components/ui/editorial"
import type { DashboardAppointment } from "@/types/appointments"
import { format } from "date-fns"

interface AppointmentDeleteDialogProps {
  appointment: DashboardAppointment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading?: boolean
}

export function AppointmentDeleteDialog({
  appointment,
  open,
  onOpenChange,
  onConfirm,
  loading,
}: AppointmentDeleteDialogProps) {
  if (!appointment) return null

  return (
    <EditorialModal
      open={open}
      onOpenChange={onOpenChange}
      kicker="Delete appointment"
      kickerTone="danger"
      title="Remove appointment?"
      description="This action cannot be undone. The appointment will be permanently removed."
    >
      <div className="grid grid-cols-2 gap-10 text-[13px] text-[#0A0A0A]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Patient</p>
          <p className="mt-1">{appointment.patientId || 'Unknown'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Scheduled</p>
          <p className="tabular-nums mt-1">
            {format(new Date(appointment.date), 'dd MMM yyyy')} at {appointment.startTime}
          </p>
        </div>
      </div>

      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </EditorialButton>
        <EditorialButton variant="primary" arrow onClick={onConfirm} disabled={loading}>
          {loading ? 'Deleting…' : 'Delete appointment'}
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>
  )
}
