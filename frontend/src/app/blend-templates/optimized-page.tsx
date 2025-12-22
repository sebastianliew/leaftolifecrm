"use client"

import { useState, useCallback, lazy, Suspense } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from '@/components/blend-templates/PageHeader';
import { FilterPanel } from '@/components/blend-templates/FilterPanel';
import { StatsGrid } from '@/components/blend-templates/StatsGrid';
import { TemplateList } from '@/components/blend-templates/TemplateList';
import { useBlendTemplatesOptimized } from '@/hooks/useBlendTemplatesOptimized';
import { useInventoryOptimized } from '@/hooks/useInventoryOptimized';
import { useUnits } from '@/hooks/useUnits';
import { usePermissions } from '@/hooks/usePermissions';
import { useTemplateFilters } from '@/hooks/useTemplateFilters';
import { useTemplateStats } from '@/hooks/useTemplateStats';
import { VIEW_MODES, ViewMode } from '@/constants/blend-templates';
import type { BlendTemplate, CreateBlendTemplateData, UpdateBlendTemplateData } from '@/types/blend';
import { ImSpinner8 } from 'react-icons/im';
import { Button } from '@/components/ui/button';

// Lazy load the heavy TemplateDialog component
const TemplateDialog = lazy(() => import('@/components/blend-templates/TemplateDialog').then(module => ({ default: module.TemplateDialog })));

export default function BlendTemplatesPageOptimized() {
  const { 
    templates,
    loading,
    error,
    pagination,
    getTemplatesPaginated,
    loadMore,
    searchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    hasMore
  } = useBlendTemplatesOptimized({
    initialLimit: 10,
    enableCache: true,
    searchDebounce: 300
  });

  const { 
    products, 
    getProductsPaginated 
  } = useInventoryOptimized({
    enableCache: true,
    context: 'blends',
    initialLimit: 50
  });

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

  // Load products and units on demand when dialog opens
  const loadDialogDependencies = useCallback(async () => {
    await Promise.all([
      products.length === 0 ? getProductsPaginated(1) : Promise.resolve(),
      units.length === 0 ? getUnits() : Promise.resolve()
    ]);
  }, [products.length, units.length, getProductsPaginated, getUnits]);

  // Template actions
  const handleCreateTemplate = async () => {
    await loadDialogDependencies();
    setSelectedTemplate(null);
    setView(VIEW_MODES.CREATE);
    setShowTemplateDialog(true);
  };

  const handleEditTemplate = async (template: BlendTemplate) => {
    await loadDialogDependencies();
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
    } catch (error: unknown) {
      console.error('Error handling template submission:', error);
      throw error;
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteTemplate(id);
    } catch (error) {
      console.error('Failed to delete template:', error);
      throw error;
    }
  };

  const handleApplyFilters = () => {
    getTemplatesPaginated(1, filters);
  };

  const handleResetFilters = () => {
    resetFilters();
    getTemplatesPaginated(1);
  };

  const handleSearch = (searchTerm: string) => {
    updateFilter('search', searchTerm);
    searchTemplates(searchTerm);
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
          onSearch={handleSearch}
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

      {/* Load More Button */}
      {hasMore && !loading && templates.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? (
              <>
                <ImSpinner8 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              `Load More (${templates.length} of ${pagination.total})`
            )}
          </Button>
        </div>
      )}

      {/* Lazy-loaded Dialog */}
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