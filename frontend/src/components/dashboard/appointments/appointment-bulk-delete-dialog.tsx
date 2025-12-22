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
  loading 
}: AppointmentBulkDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {selectedCount} Appointment{selectedCount !== 1 ? 's' : ''}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <strong>
              {selectedCount} appointment{selectedCount !== 1 ? 's' : ''}
            </strong>?
            <br />
            <br />
            This action cannot be undone. The selected appointment{selectedCount !== 1 ? 's' : ''} will be permanently removed from the system and cancellation notifications will be sent to the patients.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm} 
            disabled={loading} 
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? "Deleting..." : `Delete ${selectedCount} Appointment${selectedCount !== 1 ? 's' : ''}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}