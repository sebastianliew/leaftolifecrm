"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  loading 
}: AppointmentDeleteDialogProps) {
  if (!appointment) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Appointment</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the appointment for{" "}
            <strong>
              {appointment.patientId || "Unknown Patient"}
            </strong>{" "}
            scheduled on{" "}
            <strong>
              {format(new Date(appointment.date), 'dd MMM yyyy')} at {appointment.startTime}
            </strong>?
            <br />
            <br />
            This action cannot be undone. The appointment will be permanently removed from the system.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm} 
            disabled={loading} 
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? "Deleting..." : "Delete Appointment"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}