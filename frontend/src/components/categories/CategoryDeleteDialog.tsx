import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
} from "@/components/ui/editorial"
import type { ProductCategory } from "@/types/inventory/category.types"

interface CategoryDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: ProductCategory | null
  onConfirm: () => void
  loading?: boolean
}

export function CategoryDeleteDialog({
  open,
  onOpenChange,
  category,
  onConfirm,
  loading = false,
}: CategoryDeleteDialogProps) {
  if (!category) return null

  return (
    <EditorialModal
      open={open}
      onOpenChange={onOpenChange}
      kicker="Delete category"
      kickerTone="danger"
      title={`Remove ${category.name}?`}
      description="This action cannot be undone."
    >
      <div className="space-y-4">
        {category.description && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Description</p>
            <p className="text-sm text-[#0A0A0A] mt-1 italic font-light">{category.description}</p>
          </div>
        )}

        <div className="flex items-center gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Level</p>
            <p className="text-sm tabular-nums text-[#0A0A0A] mt-1">{category.level}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Status</p>
            <p className={`text-[10px] uppercase tracking-[0.28em] mt-1 ${category.isActive ? 'text-[#16A34A]' : 'text-[#9CA3AF]'}`}>
              {category.isActive ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>

        <div className="border-l-2 border-[#EA580C] bg-[#FFF7ED] px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#EA580C]">Warning</p>
          <p className="text-[13px] text-[#0A0A0A] mt-2">
            If this category is used by products or other categories, the deletion may fail. Ensure no
            dependencies exist before proceeding.
          </p>
        </div>
      </div>

      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </EditorialButton>
        <EditorialButton variant="primary" arrow onClick={onConfirm} disabled={loading}>
          {loading ? 'Deleting…' : 'Delete category'}
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>
  )
}
