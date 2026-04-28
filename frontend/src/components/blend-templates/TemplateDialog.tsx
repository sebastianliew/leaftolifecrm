"use client"

import { TemplateForm } from './TemplateForm'
import { TemplateDetailView } from './TemplateDetailView'
import { ViewMode } from '@/constants/blend-templates'
import type { BlendTemplate, CreateBlendTemplateData, UpdateBlendTemplateData } from '@/types/blend'
import type { Product, UnitOfMeasurement } from '@/types/inventory'
import { EditorialModal } from '@/components/ui/editorial'

interface TemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  view: ViewMode
  template?: BlendTemplate | null
  products: Product[]
  units: UnitOfMeasurement[]
  onSubmit: (data: CreateBlendTemplateData | UpdateBlendTemplateData) => Promise<void>
  onEdit?: (template: BlendTemplate) => void
  loading?: boolean
}

export function TemplateDialog({
  open,
  onOpenChange,
  view,
  template,
  products,
  units,
  onSubmit,
  onEdit,
  loading,
}: TemplateDialogProps) {
  const title =
    view === 'create' ? 'New blend template' : view === 'edit' ? 'Edit blend template' : 'Blend template'
  const description =
    view === 'view'
      ? template?.description || 'Read-only view of this saved formulation.'
      : 'Capture or update the saved formulation.'

  return (
    <EditorialModal
      open={open}
      onOpenChange={onOpenChange}
      kicker="Blend templates"
      title={title}
      description={description}
      size="2xl"
    >
      {open && (
        <>
          {view === 'view' && template ? (
            <TemplateDetailView template={template} onClose={() => onOpenChange(false)} onEdit={onEdit} />
          ) : (
            <TemplateForm
              template={view === 'edit' ? (template ?? undefined) : undefined}
              products={products}
              unitOfMeasurements={units}
              onSubmit={onSubmit}
              onCancel={() => onOpenChange(false)}
              loading={loading}
            />
          )}
        </>
      )}
    </EditorialModal>
  )
}
