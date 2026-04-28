"use client"

import { useState, useEffect, useCallback } from 'react'
import { TemplateDeleteDialog } from './template-delete-dialog'
import { HiPencil, HiTrash, HiEye } from 'react-icons/hi2'
import type { BlendTemplate, TemplateFilters } from '@/types/blend'
import { useBlendTemplates } from '@/hooks/useBlendTemplates'
import { useAuth } from '@/hooks/useAuth'
import {
  EditorialTable,
  EditorialTHead,
  EditorialTh,
  EditorialTr,
  EditorialTd,
  EditorialEmptyRow,
  EditorialMeta,
} from '@/components/ui/editorial'

interface TemplateListProps {
  filters: TemplateFilters
  templates?: BlendTemplate[]
  loading?: boolean
  error?: string | null
  onCreateTemplate?: () => void
  onEditTemplate?: (template: BlendTemplate) => void
  onViewTemplate: (template: BlendTemplate) => void
  onDeleteTemplate?: (id: string) => Promise<void>
  canDelete?: boolean
}

export function TemplateList({
  filters,
  templates: propTemplates,
  loading: propLoading,
  error: propError,
  onEditTemplate,
  onViewTemplate,
  onDeleteTemplate,
  canDelete = false,
}: TemplateListProps) {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const isStaff = user?.role === 'staff'

  const {
    templates: hookTemplates,
    loading: hookLoading,
    error: hookError,
    getTemplates,
    deleteTemplate,
  } = useBlendTemplates()

  const templates = propTemplates ?? hookTemplates
  const loading = propLoading ?? hookLoading
  const error = propError ?? hookError

  const [templateToDelete, setTemplateToDelete] = useState<BlendTemplate | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadTemplates = useCallback(async () => {
    if (!propTemplates) {
      try {
        await getTemplates(filters)
      } catch {
        console.error('Failed to load templates')
      }
    }
  }, [getTemplates, filters, propTemplates])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return
    setDeleting(true)
    try {
      if (onDeleteTemplate) {
        await onDeleteTemplate(templateToDelete._id)
      } else {
        await deleteTemplate(templateToDelete._id)
      }
      setTemplateToDelete(null)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Failed to delete template:', errorMessage)
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB')

  const colCount = 6 + (!isStaff ? 2 : 0) + (isSuperAdmin || isStaff ? 1 : 0) + (isSuperAdmin ? 1 : 0)

  return (
    <>
      {error && (
        <div className="mt-6 border-l-2 border-[#DC2626] bg-[#FEF2F2] px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#DC2626]">Error</p>
          <p className="text-[13px] text-[#0A0A0A] mt-2">{error}</p>
        </div>
      )}

      <EditorialTable>
        <EditorialTHead>
          <EditorialTh>Name</EditorialTh>
          {!isStaff && <EditorialTh align="right">Ingredients</EditorialTh>}
          <EditorialTh>Unit</EditorialTh>
          {!isStaff && <EditorialTh align="right">Cost</EditorialTh>}
          {(isSuperAdmin || isStaff) && <EditorialTh align="right">Selling</EditorialTh>}
          {isSuperAdmin && <EditorialTh align="right">Profit</EditorialTh>}
          <EditorialTh align="right">Usage</EditorialTh>
          <EditorialTh>Status</EditorialTh>
          <EditorialTh align="right">Updated</EditorialTh>
          <EditorialTh align="right" className="w-32">Actions</EditorialTh>
        </EditorialTHead>
        <tbody>
          {loading ? (
            <EditorialEmptyRow colSpan={colCount} title="Loading" description="Fetching templates…" />
          ) : templates.length === 0 ? (
            <EditorialEmptyRow
              colSpan={colCount}
              description={
                filters.search || filters.category || filters.isActive !== undefined
                  ? 'No templates match your filters.'
                  : 'No blend templates have been created yet.'
              }
            />
          ) : (
            templates.map((template) => (
              <EditorialTr key={template._id}>
                <EditorialTd size="lg" className="pr-4">
                  <p className="text-[14px] text-[#0A0A0A] font-medium">{template.name}</p>
                  {template.description && (
                    <EditorialMeta className="italic font-light max-w-md truncate">
                      {template.description}
                    </EditorialMeta>
                  )}
                </EditorialTd>
                {!isStaff && (
                  <EditorialTd align="right" className="tabular-nums">
                    {template.ingredients.length}
                  </EditorialTd>
                )}
                <EditorialTd>{template.unitName || '—'}</EditorialTd>
                {!isStaff && (
                  <EditorialTd align="right" size="md" className="tabular-nums">
                    S${template.totalCost?.toFixed(2) || '0.00'}
                  </EditorialTd>
                )}
                {(isSuperAdmin || isStaff) && (
                  <EditorialTd align="right" size="md" className="tabular-nums">
                    S${template.sellingPrice?.toFixed(2) || '0.00'}
                  </EditorialTd>
                )}
                {isSuperAdmin && (
                  <EditorialTd align="right" className="tabular-nums">
                    <span className={template.profit > 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}>
                      ${template.profit?.toFixed(2) || '0.00'}
                    </span>
                    {template.profitMargin > 0 && (
                      <EditorialMeta className="tabular-nums">{template.profitMargin?.toFixed(1)}%</EditorialMeta>
                    )}
                  </EditorialTd>
                )}
                <EditorialTd align="right">
                  <p className="tabular-nums text-[#0A0A0A]">{template.usageCount}</p>
                  <EditorialMeta className="italic font-light">uses</EditorialMeta>
                </EditorialTd>
                <EditorialTd>
                  <span
                    className={`text-[10px] uppercase tracking-[0.28em] ${template.isActive ? 'text-[#16A34A]' : 'text-[#9CA3AF]'}`}
                  >
                    {template.isActive ? 'Active' : 'Inactive'}
                  </span>
                </EditorialTd>
                <EditorialTd align="right" className="tabular-nums">
                  <p>{formatDate(template.updatedAt)}</p>
                  {template.lastUsed && (
                    <EditorialMeta className="italic font-light">last: {formatDate(template.lastUsed)}</EditorialMeta>
                  )}
                </EditorialTd>
                <EditorialTd align="right">
                  <div className="flex items-center justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onViewTemplate(template)}
                      title="View"
                      className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                    >
                      <HiEye className="h-3.5 w-3.5" />
                    </button>
                    {onEditTemplate && (
                      <button
                        onClick={() => onEditTemplate(template)}
                        title="Edit"
                        className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                      >
                        <HiPencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => setTemplateToDelete(template)}
                        title="Delete"
                        className="text-[#6B7280] hover:text-[#DC2626] transition-colors"
                      >
                        <HiTrash className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </EditorialTd>
              </EditorialTr>
            ))
          )}
        </tbody>
      </EditorialTable>

      <TemplateDeleteDialog
        template={templateToDelete}
        open={!!templateToDelete}
        onOpenChange={(open) => !open && setTemplateToDelete(null)}
        onConfirm={handleDeleteTemplate}
        loading={deleting}
      />
    </>
  )
}
