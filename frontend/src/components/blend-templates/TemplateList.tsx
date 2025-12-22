"use client"

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// Dialog components removed - not used
import { TemplateDeleteDialog } from './template-delete-dialog';
// Separator component removed - not used
import { FaPlus, FaEdit, FaTrash, FaEye } from 'react-icons/fa';
import { ImSpinner8 } from 'react-icons/im';
import type { BlendTemplate, TemplateFilters } from '@/types/blend';
import { useBlendTemplates } from '@/hooks/useBlendTemplates';
import { useAuth } from '@/hooks/useAuth';

interface TemplateListProps {
  filters: TemplateFilters;
  templates?: BlendTemplate[];
  loading?: boolean;
  error?: string | null;
  onCreateTemplate?: () => void;
  onEditTemplate?: (template: BlendTemplate) => void;
  onViewTemplate: (template: BlendTemplate) => void;
  onDeleteTemplate?: (id: string) => Promise<void>;
  canDelete?: boolean;
}

export function TemplateList({ 
  filters,
  templates: propTemplates,
  loading: propLoading,
  error: propError,
  onCreateTemplate, 
  onEditTemplate, 
  onViewTemplate,
  onDeleteTemplate,
  canDelete = false
}: TemplateListProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isStaff = user?.role === 'staff';
  
  const { 
    templates: hookTemplates, 
    loading: hookLoading, 
    error: hookError, 
    getTemplates, 
    deleteTemplate
  } = useBlendTemplates();

  // Use props if provided, otherwise fall back to hook values
  const templates = propTemplates ?? hookTemplates;
  const loading = propLoading ?? hookLoading;
  const error = propError ?? hookError;

  const [templateToDelete, setTemplateToDelete] = useState<BlendTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load templates with current filters only if not using prop templates
  const loadTemplates = useCallback(async () => {
    if (!propTemplates) {
      try {
        await getTemplates(filters);
      } catch {
        console.error('Failed to load templates');
      }
    }
  }, [getTemplates, filters, propTemplates]);

  // Load templates on component mount and when filters change only if not using prop templates
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);


  // Handle delete confirmation
  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    setDeleting(true);
    try {
      // Use the prop callback if provided, otherwise use the hook's deleteTemplate
      if (onDeleteTemplate) {
        await onDeleteTemplate(templateToDelete._id);
      } else {
        await deleteTemplate(templateToDelete._id);
      }
      setTemplateToDelete(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Failed to delete template:', errorMessage);
      // Error will be handled by parent component
    } finally {
      setDeleting(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  // Get status badge
  const getStatusBadge = (template: BlendTemplate) => {
    if (!template.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  // Get usage badge
  const getUsageBadge = (usageCount: number) => {
    if (usageCount === 0) {
      return <Badge variant="outline">Unused</Badge>;
    } else if (usageCount < 5) {
      return <Badge variant="secondary">{usageCount} uses</Badge>;
    } else {
      return <Badge variant="default">{usageCount} uses</Badge>;
    }
  };

  return (
    <div className="space-y-6">


      {/* Error Display */}
      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="text-red-600">
              Error: {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle>Templates ({templates.length})</CardTitle>
          <CardDescription>
            {loading ? 'Loading templates...' : `${templates.length} template(s) found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <ImSpinner8 className="h-8 w-8 animate-spin" />
            </div>
          ) : templates.length > 0 ? (
            <>
              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                {templates.map(template => (
                  <Card key={template._id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium">{template.name}</h3>
                          {template.description && (
                            <p className="text-sm text-gray-500 mt-1">
                              {template.description}
                            </p>
                          )}
                        </div>
                        <div className="ml-2">
                          {getStatusBadge(template)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {!isStaff && (
                          <div>
                            <span className="text-gray-500">Ingredients:</span>
                            <Badge variant="secondary" className="ml-1">
                              {template.ingredients.length}
                            </Badge>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Unit:</span>
                          <span className="ml-1">{template.unitName}</span>
                        </div>
                        {!isStaff && (
                          <div>
                            <span className="text-gray-500">Price:</span>
                            <span className="ml-1 font-medium">S${template.totalCost?.toFixed(2) || '0.00'}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Usage:</span>
                          <span className="ml-1">{template.usageCount} times</span>
                        </div>
                      </div>
                      
                      {(isSuperAdmin || isStaff) && (
                        <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                          <div>
                            <span className="text-gray-500">Selling Price:</span>
                            <span className="ml-1 font-medium">S${template.sellingPrice?.toFixed(2) || '0.00'}</span>
                          </div>
                          {!isStaff && (
                            <div>
                              <span className="text-gray-500">Profit:</span>
                              <span className={`ml-1 font-medium ${
                                template.profit > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                S${template.profit?.toFixed(2) || '0.00'}
                                {template.profitMargin > 0 && (
                                  <span className="text-xs text-gray-500 ml-1">
                                    ({template.profitMargin?.toFixed(1)}%)
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-500">
                        Updated: {formatDate(template.updatedAt)}
                        {template.lastUsed && (
                          <span className="ml-2">Last used: {formatDate(template.lastUsed)}</span>
                        )}
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewTemplate(template)}
                          className="flex-1"
                        >
                          <FaEye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {onEditTemplate && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEditTemplate(template)}
                            className="flex-1"
                          >
                            <FaEdit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTemplateToDelete(template)}
                            className="flex-1 text-red-600 hover:text-red-700"
                          >
                            <FaTrash className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              
              {/* Desktop View */}
              <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {!isStaff && <TableHead>Ingredients</TableHead>}
                  <TableHead>Unit</TableHead>
                  {!isStaff && <TableHead>Price</TableHead>}
                  {(isSuperAdmin || isStaff) && (
                    <TableHead>Selling Price</TableHead>
                  )}
                  {isSuperAdmin && (
                    <TableHead>Profit</TableHead>
                  )}
                  <TableHead>Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(template => (
                  <TableRow key={template._id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        {template.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {template.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {!isStaff && (
                      <TableCell>
                        <Badge variant="secondary" className="whitespace-nowrap">
                          {template.ingredients.length} ingredient{template.ingredients.length !== 1 ? 's' : ''}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="text-sm">
                        {template.unitName}
                      </div>
                    </TableCell>
                    {!isStaff && (
                      <TableCell>
                        <div className="text-sm font-medium">
                          S${template.totalCost?.toFixed(2) || '0.00'}
                        </div>
                      </TableCell>
                    )}
                    {(isSuperAdmin || isStaff) && (
                      <TableCell>
                        <div className="text-sm font-medium">
                          S${template.sellingPrice?.toFixed(2) || '0.00'}
                        </div>
                      </TableCell>
                    )}
                    {isSuperAdmin && (
                      <TableCell>
                        <div className={`text-sm font-medium ${
                          template.profit > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${template.profit?.toFixed(2) || '0.00'}
                          {template.profitMargin > 0 && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({template.profitMargin?.toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      {getUsageBadge(template.usageCount)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(template)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(template.updatedAt)}
                      </div>
                      {template.lastUsed && (
                        <div className="text-xs text-gray-500">
                          Last used: {formatDate(template.lastUsed)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewTemplate(template)}
                        >
                          <FaEye className="h-4 w-4" />
                        </Button>
                        {onEditTemplate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditTemplate(template)}
                          >
                            <FaEdit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTemplateToDelete(template)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <FaTrash className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-4">
                {filters.search || filters.category || filters.isActive !== undefined
                  ? 'No templates match your filters'
                  : 'No blend templates found'
                }
              </div>
              {onCreateTemplate && (
                <Button onClick={onCreateTemplate}>
                  <FaPlus className="mr-2 h-4 w-4" />
                  Create Your First Template
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <TemplateDeleteDialog
        template={templateToDelete}
        open={!!templateToDelete}
        onOpenChange={(open) => !open && setTemplateToDelete(null)}
        onConfirm={handleDeleteTemplate}
        loading={deleting}
      />
    </div>
  );
} 