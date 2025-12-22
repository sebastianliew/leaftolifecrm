"use client"

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FaPlus, FaSearch } from 'react-icons/fa';
import { TemplateList } from '@/components/blend-templates/TemplateList';
import { TemplateForm } from '@/components/blend-templates/TemplateForm';
import { useBlendTemplates } from '@/hooks/useBlendTemplates';
import { useInventory } from '@/hooks/inventory/useInventory';
import { useUnits } from '@/hooks/useUnits';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import type { BlendTemplate, CreateBlendTemplateData, UpdateBlendTemplateData, TemplateFilters } from '@/types/blend';

export default function BlendTemplatesPage() {
  const { 
    templates,
    loading,
    error,
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate
  } = useBlendTemplates();

  const { products, getProducts } = useInventory();
  const { units, getUnits } = useUnits();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  // Check blend permissions
  const canCreateBlends = hasPermission('blends', 'canCreateFixedBlends');
  const canEditBlends = hasPermission('blends', 'canEditFixedBlends');
  const canDeleteBlends = hasPermission('blends', 'canDeleteFixedBlends');
  const _canViewBlends = hasPermission('blends', 'canViewFixedBlends');
  

  const [view, setView] = useState<'list' | 'create' | 'edit' | 'view'>('list');
  const [selectedTemplate, setSelectedTemplate] = useState<BlendTemplate | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [filters, setFilters] = useState<TemplateFilters>({
    search: '',
    category: undefined,
    isActive: undefined
  });
  const [showFilters, setShowFilters] = useState(false);


  const loadInitialData = useCallback(async () => {
    try {
      await Promise.all([
        getTemplates(),
        getProducts(),
        getUnits()
      ]);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }, [getTemplates, getProducts, getUnits]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle create template
  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setView('create');
    setShowTemplateDialog(true);
  };

  // Handle edit template
  const handleEditTemplate = (template: BlendTemplate) => {
    setSelectedTemplate(template);
    setView('edit');
    setShowTemplateDialog(true);
  };

  // Handle view template
  const handleViewTemplate = (template: BlendTemplate) => {
    setSelectedTemplate(template);
    setView('view');
    setShowTemplateDialog(true);
  };

  // Handle template form submission
  const handleTemplateSubmit = async (data: CreateBlendTemplateData | UpdateBlendTemplateData) => {
    try {
      if (view === 'create') {
        await createTemplate(data as CreateBlendTemplateData);
      } else if (view === 'edit' && selectedTemplate) {
        await updateTemplate(selectedTemplate._id, data as UpdateBlendTemplateData);
      }
      
      setShowTemplateDialog(false);
      setView('list');
      setSelectedTemplate(null);
      
      // Refresh templates list to show the new/updated template
      await getTemplates(filters);
    } catch (error: unknown) {
      console.error('Error handling template submission:', error);
      throw error; // Let the form handle the error display
    }
  };

  // Handle delete template
  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteTemplate(id);
      // Refresh templates list after deletion
      await getTemplates(filters);
    } catch (error) {
      console.error('Failed to delete template:', error);
      throw error; // Re-throw to let TemplateList handle the error
    }
  };

  // Handle dialog close
  const handleDialogClose = () => {
    setShowTemplateDialog(false);
    setView('list');
    setSelectedTemplate(null);
  };

  // Get dialog title
  const getDialogTitle = () => {
    switch (view) {
      case 'create':
        return 'Create New Blend Template';
      case 'edit':
        return 'Edit Blend Template';
      case 'view':
        return 'View Blend Template';
      default:
        return 'Blend Template';
    }
  };

  // Calculate stats
  const stats = {
    totalTemplates: templates.length,
    activeTemplates: templates.filter(t => t.isActive).length,
    totalUsage: templates.reduce((sum, t) => sum + t.usageCount, 0),
    categoriesCount: new Set(templates.map(t => t.category).filter(Boolean)).size
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Blend Templates</h1>
          <p className="text-gray-600 mt-2">
            Create and manage reusable blend formulations for consistent mixing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          {canCreateBlends && (
            <Button onClick={handleCreateTemplate}>
              <FaPlus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <FaSearch className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search templates..."
                    value={filters.search || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>


              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={filters.isActive === undefined ? 'all' : filters.isActive.toString()}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    isActive: value === 'all' ? undefined : value === 'true'
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-2">
                <Button onClick={() => getTemplates(filters)} className="flex-1">
                  Apply Filters
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setFilters({
                      search: '',
                      isActive: undefined
                    });
                    getTemplates();
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer transition-all hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-24px font-bold mb-2">
                {stats.totalTemplates.toLocaleString('en-GB')}
              </div>
              <div className="flex flex-col">
                <h3 className="text-sm font-medium">Total Templates</h3>
                <p className="text-xs text-muted-foreground">
                  {stats.activeTemplates} active
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer transition-all hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-24px font-bold mb-2">
                {stats.categoriesCount.toLocaleString('en-GB')}
              </div>
              <div className="flex flex-col">
                <h3 className="text-sm font-medium">Categories</h3>
                <p className="text-xs text-muted-foreground">
                  Different blend types
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer transition-all hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-24px font-bold mb-2">
                {stats.totalUsage.toLocaleString('en-GB')}
              </div>
              <div className="flex flex-col">
                <h3 className="text-sm font-medium">Total Usage</h3>
                <p className="text-xs text-muted-foreground">
                  Times templates used
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer transition-all hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-24px font-bold mb-2">
                {stats.totalTemplates > 0 ? (stats.totalUsage / stats.totalTemplates).toFixed(1) : '0'}
              </div>
              <div className="flex flex-col">
                <h3 className="text-sm font-medium">Avg Usage</h3>
                <p className="text-xs text-muted-foreground">
                  Per template
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Templates List */}
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

      {/* Template Form Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-6xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
          </DialogHeader>
          {showTemplateDialog && (
            <>
              {view === 'view' && selectedTemplate ? (
                <div className="space-y-6">
                  {/* Template Details View */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{selectedTemplate.name}</CardTitle>
                      <CardDescription>{selectedTemplate.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Template Name</label>
                          <p className="text-sm text-gray-600">{selectedTemplate.name}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Category</label>
                          <p className="text-sm text-gray-600">{selectedTemplate.category || 'None'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Base Unit</label>
                          <p className="text-sm text-gray-600">{selectedTemplate.unitName}</p>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium mb-2">Ingredients</h4>
                        <div className="space-y-2">
                          {selectedTemplate.ingredients.map((ingredient, index) => {
                            const ingredientCost = ingredient.quantity * (ingredient.costPerUnit || 0);
                            return (
                              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                <div className="flex-1">
                                  <span className="font-medium">{ingredient.name}</span>
                                  <div className="text-sm text-gray-600">
                                    {ingredient.quantity} {ingredient.unitName} @ ${(ingredient.costPerUnit || 0).toFixed(2)}/{ingredient.unitName}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="font-medium">${ingredientCost.toFixed(2)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-4 pt-4 border-t flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">Total Cost</h4>
                            <p className="text-sm text-gray-600">
                              Batch Size: {selectedTemplate.batchSize || 1} {selectedTemplate.unitName}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold">${selectedTemplate.totalCost?.toFixed(2) || '0.00'}</div>
                            <div className="text-sm text-gray-600">${selectedTemplate.costPerUnit?.toFixed(2) || '0.00'} per {selectedTemplate.unitName}</div>
                          </div>
                        </div>
                      </div>

                      {/* Pricing & Profit Section - Only for Super Admin */}
                      {isSuperAdmin && (
                        <>
                          <Separator />
                          <div>
                            <h4 className="font-medium mb-4">Pricing & Profit Analysis</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="bg-gray-50 p-3 rounded">
                                <label className="text-sm font-medium text-gray-600">Selling Price</label>
                                <div className="text-lg font-semibold">${selectedTemplate.sellingPrice?.toFixed(2) || '0.00'}</div>
                              </div>
                              <div className="bg-gray-50 p-3 rounded">
                                <label className="text-sm font-medium text-gray-600">Total Cost</label>
                                <div className="text-lg font-semibold">${selectedTemplate.totalCost?.toFixed(2) || '0.00'}</div>
                              </div>
                              <div className={`p-3 rounded ${selectedTemplate.profit > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                                <label className="text-sm font-medium text-gray-600">Profit</label>
                                <div className={`text-lg font-semibold ${selectedTemplate.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ${selectedTemplate.profit?.toFixed(2) || '0.00'}
                                </div>
                              </div>
                              <div className={`p-3 rounded ${selectedTemplate.profitMargin > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                                <label className="text-sm font-medium text-gray-600">Profit Margin</label>
                                <div className={`text-lg font-semibold ${selectedTemplate.profitMargin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {selectedTemplate.profitMargin?.toFixed(1) || '0.0'}%
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={handleDialogClose}>
                          Close
                        </Button>
                        <Button onClick={() => handleEditTemplate(selectedTemplate)}>
                          Edit Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <TemplateForm
                  template={selectedTemplate || undefined}
                  products={products}
                  unitOfMeasurements={units}
                  onSubmit={handleTemplateSubmit}
                  onCancel={handleDialogClose}
                  loading={loading}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 