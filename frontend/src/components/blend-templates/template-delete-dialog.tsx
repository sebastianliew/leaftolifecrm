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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Blend Template</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the template{" "}
            <strong>
              {template.name}
            </strong>?
            {template.usageCount > 0 && (
              <>
                <br />
                <br />
                <span className="text-amber-600">
                  Warning: This template has been used {template.usageCount} time{template.usageCount !== 1 ? 's' : ''}.
                </span>
              </>
            )}
            <br />
            <br />
            This action cannot be undone. The template will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading} className="bg-red-600 hover:bg-red-700">
            {loading ? "Deleting..." : "Delete Template"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}