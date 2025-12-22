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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Patient</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete patient{" "}
            <strong>
              {patient.firstName} {patient.lastName}
            </strong>{" "}
            (ID: {patient.id})?
            <br />
            <br />
            This action cannot be undone. All patient data, including medical records, allergies, and preferences will
            be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading} className="bg-red-600 hover:bg-red-700">
            {loading ? "Deleting..." : "Delete Patient"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
