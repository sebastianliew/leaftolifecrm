"use client"

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from '@/components/blend-templates/PageHeader';
import { FilterPanel } from '@/components/blend-templates/FilterPanel';
import { StatsGrid } from '@/components/blend-templates/StatsGrid';
import { TemplateList } from '@/components/blend-templates/TemplateList';
import { useBlendTemplates } from '@/hooks/useBlendTemplates';
import { useInventory } from '@/hooks/inventory/useInventory';
import { useUnits } from '@/hooks/useUnits';
import { usePermissions } from '@/hooks/usePermissions';
import { useTemplateFilters } from '@/hooks/useTemplateFilters';
import { useTemplateStats } from '@/hooks/useTemplateStats';
import { VIEW_MODES, ViewMode } from '@/constants/blend-templates';
import type { BlendTemplate, CreateBlendTemplateData, UpdateBlendTemplateData } from '@/types/blend';
import { ImSpinner8 } from 'react-icons/im';

// Lazy load the heavy TemplateDialog component
const TemplateDialog = lazy(() => import('@/components/blend-templates/TemplateDialog').then(module => ({ default: module.TemplateDialog })));

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
    nextPage,
    prevPage
  } = useBlendTemplates();

  const { products, getProducts } = useInventory();
  const { units, getUnits } = useUnits();
  const { hasPermission } = usePermissions();
  
  // Check blend permissions
  const canCreateBlends = hasPermission('blends', 'canCreateFixedBlends');
  const canEditBlends = hasPermission('blends', 'canEditFixedBlends');
  const canDeleteBlends = hasPermission('blends', 'canDeleteFixedBlends');
  
  // Use custom hooks
  const { filters, showFilters, toggleFilters, updateFilter, resetFilters } = useTemplateFilters();
  const stats = useTemplateStats(templates);
  
  // Dialog state
  const [view, setView] = useState<ViewMode>(VIEW_MODES.LIST);
  const [selectedTemplate, setSelectedTemplate] = useState<BlendTemplate | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  // Load initial data (products loaded on demand)
  const loadInitialData = useCallback(async () => {
    try {
      await Promise.all([
        getTemplates(),
        getUnits()
      ]);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }, [getTemplates, getUnits]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load products on demand
  const loadProductsIfNeeded = useCallback(async () => {
    if (products.length === 0) {
      await getProducts();
    }
  }, [products.length, getProducts]);

  // Template actions
  const handleCreateTemplate = async () => {
    await loadProductsIfNeeded();
    setSelectedTemplate(null);
    setView(VIEW_MODES.CREATE);
    setShowTemplateDialog(true);
  };

  const handleEditTemplate = async (template: BlendTemplate) => {
    await loadProductsIfNeeded();
    setSelectedTemplate(template);
    setView(VIEW_MODES.EDIT);
    setShowTemplateDialog(true);
  };

  const handleViewTemplate = (template: BlendTemplate) => {
    setSelectedTemplate(template);
    setView(VIEW_MODES.VIEW);
    setShowTemplateDialog(true);
  };

  const handleTemplateSubmit = async (data: CreateBlendTemplateData | UpdateBlendTemplateData) => {
    try {
      if (view === VIEW_MODES.CREATE) {
        await createTemplate(data as CreateBlendTemplateData);
      } else if (view === VIEW_MODES.EDIT && selectedTemplate) {
        await updateTemplate(selectedTemplate._id, data as UpdateBlendTemplateData);
      }
      
      setShowTemplateDialog(false);
      setView(VIEW_MODES.LIST);
      setSelectedTemplate(null);
      
      // Refresh templates list
      await getTemplates(filters, 1, 10);
    } catch (error: unknown) {
      console.error('Error handling template submission:', error);
      throw error;
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteTemplate(id);
      await getTemplates(filters, 1, 10);
    } catch (error) {
      console.error('Failed to delete template:', error);
      throw error;
    }
  };

  const handleApplyFilters = () => {
    getTemplates(filters, 1, 10);
  };

  const handleResetFilters = () => {
    resetFilters();
    getTemplates(undefined, 1, 10);
  };

  const handleDialogClose = () => {
    setShowTemplateDialog(false);
    setView(VIEW_MODES.LIST);
    setSelectedTemplate(null);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader
        onCreateTemplate={canCreateBlends ? handleCreateTemplate : undefined}
        onToggleFilters={toggleFilters}
        showFilters={showFilters}
        canCreate={canCreateBlends}
      />

      {showFilters && (
        <FilterPanel
          filters={filters}
          onFilterChange={updateFilter}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        />
      )}

      <StatsGrid stats={stats} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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

      {/* Pagination Controls */}
      {templates.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} templates
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={prevPage} 
              disabled={pagination.page === 1 || loading}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={nextPage} 
              disabled={pagination.page * pagination.limit >= pagination.total || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Suspense fallback={
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <ImSpinner8 className="h-8 w-8 animate-spin text-white" />
        </div>
      }>
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
    </div>
  );
}