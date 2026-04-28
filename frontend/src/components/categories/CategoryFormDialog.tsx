import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
  EditorialField,
  EditorialInput,
} from "@/components/ui/editorial"
import type { ProductCategory, CreateCategoryRequest, UpdateCategoryRequest, UomType } from "@/types/inventory/category.types"

const UOM_TYPE_OPTIONS: { value: UomType; label: string }[] = [
  { value: 'volume', label: 'Volume (ml, L, fl oz)' },
  { value: 'weight', label: 'Weight (g, kg, mg)' },
  { value: 'count', label: 'Count (pcs, tab, cap, sachet)' },
  { value: 'length', label: 'Length (cm, m, in)' },
]

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  category?: ProductCategory | null
  onSubmit: (data: CreateCategoryRequest | UpdateCategoryRequest) => void
  loading?: boolean
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  mode,
  category,
  onSubmit,
  loading = false,
}: CategoryFormDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: 1,
    isActive: true,
    allowedUomTypes: [] as UomType[],
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (mode === 'edit' && category) {
      setFormData({
        name: category.name,
        description: category.description || '',
        level: category.level ?? 1,
        isActive: category.isActive ?? true,
        allowedUomTypes: (category.allowedUomTypes ?? []) as UomType[],
      })
    } else {
      setFormData({ name: '', description: '', level: 1, isActive: true, allowedUomTypes: [] })
    }
    setErrors({})
  }, [mode, category, open])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    else if (formData.name.length < 2) newErrors.name = 'Name must be at least 2 characters'
    else if (formData.name.length > 200) newErrors.name = 'Name must be 200 characters or less'
    if (formData.description && formData.description.length > 500) newErrors.description = 'Description must be 500 characters or less'
    if (formData.level < 1) newErrors.level = 'Level must be at least 1'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return
    const submitData = mode === 'edit' && category ? { id: category.id, ...formData } : formData
    onSubmit(submitData)
  }

  const handleInputChange = (field: string, value: string | number | boolean | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  return (
    <EditorialModal
      open={open}
      onOpenChange={onOpenChange}
      kicker={mode === 'create' ? 'Categories' : 'Edit category'}
      title={mode === 'create' ? 'New category' : `Edit ${category?.name || 'category'}`}
      description="Categories organise the inventory into structured branches."
    >
      <div className="space-y-6">
        <EditorialField label="Name *">
          <EditorialInput
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Enter category name"
            maxLength={200}
            disabled={loading}
          />
          <div className="flex justify-between mt-1">
            {errors.name ? (
              <p className="text-[11px] text-[#DC2626]">{errors.name}</p>
            ) : <span />}
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#9CA3AF] tabular-nums">{formData.name.length}/200</p>
          </div>
        </EditorialField>

        <EditorialField label="Description">
          <EditorialInput
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Optional"
            maxLength={500}
            disabled={loading}
          />
          <div className="flex justify-between mt-1">
            {errors.description ? (
              <p className="text-[11px] text-[#DC2626]">{errors.description}</p>
            ) : <span />}
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#9CA3AF] tabular-nums">{formData.description.length}/500</p>
          </div>
        </EditorialField>

        <EditorialField label="Level">
          <EditorialInput
            type="number"
            min={1}
            value={formData.level}
            onChange={(e) => handleInputChange('level', Math.max(1, parseInt(e.target.value) || 1))}
            disabled={loading}
          />
          {errors.level && <p className="text-[11px] text-[#DC2626] mt-1">{errors.level}</p>}
        </EditorialField>

        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280] mb-2">Allowed unit types</p>
          <p className="text-[11px] italic font-light text-[#9CA3AF] mb-3">
            Controls which units appear when adding a product in this category.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {UOM_TYPE_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-[13px] text-[#0A0A0A]">
                <input
                  type="checkbox"
                  checked={formData.allowedUomTypes.includes(opt.value)}
                  onChange={(e) => {
                    const updated = e.target.checked
                      ? [...formData.allowedUomTypes, opt.value]
                      : formData.allowedUomTypes.filter(t => t !== opt.value)
                    handleInputChange('allowedUomTypes', updated)
                  }}
                  disabled={loading}
                  className="accent-[#0A0A0A]"
                />
                {opt.label}
              </label>
            ))}
          </div>
          {formData.allowedUomTypes.length === 0 && (
            <p className="text-[11px] text-[#EA580C] italic mt-2">No types selected — all units will be shown.</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Active</p>
          <Switch checked={formData.isActive} onCheckedChange={(checked) => handleInputChange('isActive', checked)} disabled={loading} />
        </div>
      </div>

      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </EditorialButton>
        <EditorialButton variant="primary" arrow onClick={handleSubmit} disabled={loading || !formData.name.trim()}>
          {loading ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>
  )
}
