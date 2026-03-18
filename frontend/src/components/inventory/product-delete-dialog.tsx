"use client"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { Product } from "@/types/inventory"
import type { ReferenceConflictDetails } from "@/lib/errors/api-error"

interface ProductDeleteDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onDeactivateInstead?: () => void
  loading?: boolean
  /** Set when deletion was blocked due to a reference conflict */
  conflictDetails?: ReferenceConflictDetails | null
}

export function ProductDeleteDialog({
  product,
  open,
  onOpenChange,
  onConfirm,
  onDeactivateInstead,
  loading,
  conflictDetails,
}: ProductDeleteDialogProps) {
  if (!product) return null

  // ── Conflict state: deletion blocked, offer deactivate instead ──
  if (conflictDetails) {
    const refLabel = conflictDetails.type === 'blend_template' ? 'blend template' : 'bundle'

    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot Delete Product</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  <strong className="text-gray-900">{product.name}</strong> cannot be deleted
                  because it is currently used in the active {refLabel}{" "}
                  <strong className="text-gray-900">&ldquo;{conflictDetails.name}&rdquo;</strong>.
                </p>
                <p>
                  To delete this product, first remove it from the {refLabel}, or deactivate
                  the product to hide it from use without losing its history.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            {onDeactivateInstead && (
              <Button
                variant="outline"
                onClick={onDeactivateInstead}
                disabled={loading}
                className="border-yellow-400 text-yellow-700 hover:bg-yellow-50"
              >
                {loading ? "Deactivating..." : "Deactivate Instead"}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  // ── Normal delete confirmation ──
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Product</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <strong>{product.name}</strong>{" "}
            (SKU: {product.sku})?
            <br />
            <br />
            This action cannot be undone. The product will be permanently removed from your
            inventory, including all stock information and transaction history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? "Deleting..." : "Delete Product"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
