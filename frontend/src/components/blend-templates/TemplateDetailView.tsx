"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency, formatPercentage } from '@/utils/blend-calculations';
import type { BlendTemplate } from '@/types/blend';

interface TemplateDetailViewProps {
  template: BlendTemplate;
  onClose: () => void;
  onEdit?: (template: BlendTemplate) => void;
}

export function TemplateDetailView({ template, onClose, onEdit }: TemplateDetailViewProps) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const isSuperAdmin = user?.role === 'super_admin';
  const isStaff = user?.role === 'staff';
  const canViewFixedBlends = hasPermission('blends', 'canViewFixedBlends');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{template.name}</CardTitle>
          <CardDescription>{template.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Template Name</label>
              <p className="text-sm text-gray-600">{template.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <p className="text-sm text-gray-600">{template.category || 'None'}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Base Unit</label>
              <p className="text-sm text-gray-600">{template.unitName}</p>
            </div>
          </div>

          <Separator />

          {/* Show Ingredients section for super admin, or staff with View Fixed Blends permission */}
          {(!isStaff || (isStaff && canViewFixedBlends)) && (
            <div>
              <h4 className="font-medium mb-2">Ingredients</h4>
              <div className="space-y-2">
                {template.ingredients.map((ingredient, index) => {
                  const ingredientPrice = ingredient.quantity * (ingredient.costPerUnit || 0);
                  return (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <span className="font-medium">{ingredient.name}</span>
                        <div className="text-sm text-gray-600">
                          {ingredient.quantity} {ingredient.unitName} 
                          {!isStaff && (
                            <> @ {formatCurrency(ingredient.costPerUnit || 0)}/{ingredient.unitName}</>
                          )}
                        </div>
                      </div>
                      {!isStaff && (
                        <div className="text-right">
                          <span className="font-medium">{formatCurrency(ingredientPrice)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {!isStaff && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">Total Price</h4>
                    <p className="text-sm text-gray-600">
                      Batch Size: {template.batchSize || 1} {template.unitName}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{formatCurrency(template.totalCost || 0)}</div>
                    <div className="text-sm text-gray-600">{formatCurrency(template.costPerUnit || 0)} per {template.unitName}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Selling Price section for staff */}
          {isStaff && (
            <div>
              <h4 className="font-medium mb-4">Pricing</h4>
              <div className="bg-gray-50 p-3 rounded">
                <label className="text-sm font-medium text-gray-600">Selling Price</label>
                <div className="text-lg font-semibold">{formatCurrency(template.sellingPrice || 0)}</div>
              </div>
            </div>
          )}

          {/* Pricing & Profit Section - Only for Admin and Super Admin */}
          {isSuperAdmin && !isStaff && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-4">Pricing & Profit Analysis</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <label className="text-sm font-medium text-gray-600">Selling Price</label>
                    <div className="text-lg font-semibold">{formatCurrency(template.sellingPrice || 0)}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <label className="text-sm font-medium text-gray-600">Total Cost</label>
                    <div className="text-lg font-semibold">{formatCurrency(template.totalCost || 0)}</div>
                  </div>
                  <div className={`p-3 rounded ${template.profit > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <label className="text-sm font-medium text-gray-600">Profit</label>
                    <div className={`text-lg font-semibold ${template.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(template.profit || 0)}
                    </div>
                  </div>
                  <div className={`p-3 rounded ${template.profitMargin > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <label className="text-sm font-medium text-gray-600">Profit Margin</label>
                    <div className={`text-lg font-semibold ${template.profitMargin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercentage(template.profitMargin || 0)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {onEdit && (
              <Button onClick={() => onEdit(template)}>
                Edit Template
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}