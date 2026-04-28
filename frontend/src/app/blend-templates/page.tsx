"use client"

import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { PageHeader } from '@/components/blend-templates/PageHeader'
import { FilterPanel } from '@/components/blend-templates/FilterPanel'
import { StatsGrid } from '@/components/blend-templates/StatsGrid'
import { TemplateList } from '@/components/blend-templates/TemplateList'
import { useBlendTemplates } from '@/hooks/useBlendTemplates'
import { useInventory } from '@/hooks/inventory/useInventory'
import { useUnits } from '@/hooks/useUnits'
import { usePermissions } from '@/hooks/usePermissions'
import { useTemplateFilters } from '@/hooks/useTemplateFilters'
import { useTemplateStats } from '@/hooks/useTemplateStats'
import { VIEW_MODES, ViewMode } from '@/constants/blend-templates'
import type { BlendTemplate, CreateBlendTemplateData, UpdateBlendTemplateData } from '@/types/blend'
import { ImSpinner8 } from 'react-icons/im'
import { EditorialPage, EditorialPagination } from '@/components/ui/editorial'

const TemplateDialog = lazy(() => import('@/components/blend-templates/TemplateDialog').then(module => ({ default: module.TemplateDialog })))

export default function BlendTemplatesPage() {
  const {
    templates,
    loading,
    error,
    pagination,
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useBlendTemplates()

  const { products, getProducts } = useInventory()
  const { units, getUnits } = useUnits()
  const { hasPermission } = usePermissions()

  const canCreateBlends = hasPermission('blends', 'canCreateFixedBlends')
  const canEditBlends = hasPermission('blends', 'canEditFixedBlends')
  const canDeleteBlends = hasPermission('blends', 'canDeleteFixedBlends')

  const { filters, showFilters, toggleFilters, updateFilter, resetFilters } = useTemplateFilters()
  const stats = useTemplateStats(templates)

  const [view, setView] = useState<ViewMode>(VIEW_MODES.LIST)
  const [selectedTemplate, setSelectedTemplate] = useState<BlendTemplate | null>(null)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)

  const loadInitialData = useCallback(async () => {
    try {
      await Promise.all([getTemplates(), getUnits()])
    } catch (error) {
      console.error('Failed to load initial data:', error)
    }
  }, [getTemplates, getUnits])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const loadProductsIfNeeded = useCallback(async () => {
    if (products.length === 0) await getProducts()
  }, [products.length, getProducts])

  const handleCreateTemplate = async () => {
    await loadProductsIfNeeded()
    setSelectedTemplate(null)
    setView(VIEW_MODES.CREATE)
    setShowTemplateDialog(true)
  }

  const handleEditTemplate = async (template: BlendTemplate) => {
    await loadProductsIfNeeded()
    setSelectedTemplate(template)
    setView(VIEW_MODES.EDIT)
    setShowTemplateDialog(true)
  }

  const handleViewTemplate = (template: BlendTemplate) => {
    setSelectedTemplate(template)
    setView(VIEW_MODES.VIEW)
    setShowTemplateDialog(true)
  }

  const handleTemplateSubmit = async (data: CreateBlendTemplateData | UpdateBlendTemplateData) => {
    try {
      if (view === VIEW_MODES.CREATE) {
        await createTemplate(data as CreateBlendTemplateData)
      } else if (view === VIEW_MODES.EDIT && selectedTemplate) {
        await updateTemplate(selectedTemplate._id, data as UpdateBlendTemplateData)
      }
      setShowTemplateDialog(false)
      setView(VIEW_MODES.LIST)
      setSelectedTemplate(null)
      await getTemplates(filters, 1, 10)
    } catch (error: unknown) {
      console.error('Error handling template submission:', error)
      throw error
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteTemplate(id)
      await getTemplates(filters, 1, 10)
    } catch (error) {
      console.error('Failed to delete template:', error)
      throw error
    }
  }

  const handleApplyFilters = () => {
    getTemplates(filters, 1, 10)
  }

  const handleResetFilters = () => {
    resetFilters()
    getTemplates(undefined, 1, 10)
  }

  const handleDialogClose = () => {
    setShowTemplateDialog(false)
    setView(VIEW_MODES.LIST)
    setSelectedTemplate(null)
  }

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit))

  return (
    <EditorialPage>
      <PageHeader
        onCreateTemplate={canCreateBlends ? handleCreateTemplate : undefined}
        onToggleFilters={toggleFilters}
        showFilters={showFilters}
        canCreate={canCreateBlends}
        total={pagination.total}
      />

      <StatsGrid stats={stats} />

      {showFilters && (
        <FilterPanel
          filters={filters}
          onFilterChange={updateFilter}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        />
      )}

      <TemplateList
        filters={filters}
        templates={templates}
        loading={loading}
        error={error}
        onCreateTemplate={canCreateBlends ? handleCreateTemplate : undefined}
        onEditTemplate={canEditBlends ? handleEditTemplate : undefined}
        onViewTemplate={handleViewTemplate}
        onDeleteTemplate={canDeleteBlends ? handleDeleteTemplate : undefined}
        canDelete={canDeleteBlends}
      />

      {templates.length > 0 && (
        <EditorialPagination
          total={pagination.total}
          page={pagination.page}
          limit={pagination.limit}
          pages={totalPages}
          onPageChange={(p) => getTemplates(filters, p, pagination.limit)}
          onLimitChange={(l) => getTemplates(filters, 1, l)}
        />
      )}

      <Suspense
        fallback={
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <ImSpinner8 className="h-8 w-8 animate-spin text-white" />
          </div>
        }
      >
        <TemplateDialog
          open={showTemplateDialog}
          onOpenChange={handleDialogClose}
          view={view}
          template={selectedTemplate}
          products={products}
          units={units}
          onSubmit={handleTemplateSubmit}
          onEdit={canEditBlends ? handleEditTemplate : undefined}
          loading={loading}
        />
      </Suspense>
    </EditorialPage>
  )
}
