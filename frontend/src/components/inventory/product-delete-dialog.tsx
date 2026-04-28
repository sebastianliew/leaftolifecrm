"use client"

import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
} from "@/components/ui/editorial"
import type { Product } from "@/types/inventory"
import type { ReferenceConflictDetails } from "@/lib/errors/api-error"

interface ProductDeleteDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onDeactivateInstead?: () => void
  loading?: boolean
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

  if (conflictDetails) {
    const refLabel = conflictDetails.type === 'blend_template' ? 'blend template' : 'bundle'

    return (
      <EditorialModal
        open={open}
        onOpenChange={onOpenChange}
        kicker="Cannot delete"
        kickerTone="warning"
        title={`${product.name} is in use`}
        description={`This product is referenced by an active ${refLabel}.`}
      >
        <div className="space-y-4">
          <div className="border-l-2 border-[#EA580C] bg-[#FFF7ED] px-5 py-4">
            <p className="text-[13px] text-[#0A0A0A] leading-relaxed">
              Currently used by the {refLabel}{' '}
              <span className="font-medium">&ldquo;{conflictDetails.name}&rdquo;</span>.
            </p>
            <p className="text-[13px] text-[#0A0A0A] leading-relaxed mt-3">
              To delete, first remove it from the {refLabel}. Or deactivate the product to hide it from
              future use without losing its history.
            </p>
          </div>
        </div>

        <EditorialModalFooter>
          <EditorialButton variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </EditorialButton>
          {onDeactivateInstead && (
            <EditorialButton variant="primary" arrow onClick={onDeactivateInstead} disabled={loading}>
              {loading ? 'Deactivating…' : 'Deactivate instead'}
            </EditorialButton>
          )}
        </EditorialModalFooter>
      </EditorialModal>
    )
  }

  return (
    <EditorialModal
      open={open}
      onOpenChange={onOpenChange}
      kicker="Delete product"
      kickerTone="danger"
      title={`Remove ${product.name}?`}
      description="This action cannot be undone. The product will be permanently removed from inventory, including stock and transaction history."
    >
      {product.sku && (
        <p className="text-[11px] text-[#9CA3AF] font-mono tracking-wide">SKU · {product.sku}</p>
      )}
      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </EditorialButton>
        <EditorialButton variant="primary" arrow onClick={onConfirm} disabled={loading}>
          {loading ? 'Deleting…' : 'Delete product'}
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>
  )
}
