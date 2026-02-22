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
          <AlertDialogTitle>Deactivate Patient</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to deactivate patient{" "}
            <strong>
              {patient.firstName} {patient.lastName}
            </strong>
            ?
            <br />
            <br />
            The patient will be set to inactive and hidden from default views. Their data and transaction history will be preserved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading} className="bg-red-600 hover:bg-red-700">
            {loading ? "Deactivating..." : "Deactivate Patient"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
