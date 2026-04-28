import { HiPencil, HiTrash } from "react-icons/hi2"
import {
  EditorialTr,
  EditorialTd,
  EditorialMeta,
} from "@/components/ui/editorial"
import type { ProductCategory } from "@/types/inventory/category.types"

interface CategoryTableRowProps {
  category: ProductCategory
  onEdit: (category: ProductCategory) => void
  onDelete: (category: ProductCategory) => void
}

export function CategoryTableRow({ category, onEdit, onDelete }: CategoryTableRowProps) {
  const formatDate = (date: string | Date) => {
    try {
      return new Date(date).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return '—'
    }
  }

  return (
    <EditorialTr>
      <EditorialTd size="lg" className="pr-4">
        <p className="text-[14px] text-[#0A0A0A] font-medium">{category.name}</p>
        <EditorialMeta>
          <span className={`text-[10px] uppercase tracking-[0.28em] ${category.isActive ? 'text-[#16A34A]' : 'text-[#9CA3AF]'}`}>
            {category.isActive ? 'Active' : 'Inactive'}
          </span>
        </EditorialMeta>
      </EditorialTd>
      <EditorialTd className="italic font-light max-w-md truncate">
        {category.description || '—'}
      </EditorialTd>
      <EditorialTd align="center" className="tabular-nums">{category.level}</EditorialTd>
      <EditorialTd className="tabular-nums">{formatDate(category.createdAt)}</EditorialTd>
      <EditorialTd align="right">
        <div className="flex items-center justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(category)} title="Edit" className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors">
            <HiPencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(category)} title="Delete" className="text-[#6B7280] hover:text-[#DC2626] transition-colors">
            <HiTrash className="h-3.5 w-3.5" />
          </button>
        </div>
      </EditorialTd>
    </EditorialTr>
  )
}
