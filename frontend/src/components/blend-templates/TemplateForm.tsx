"use client"

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useTemplateForm } from '@/hooks/useTemplateForm';
import { useToast } from '@/components/ui/use-toast';
import { ProductSelectionDialog } from './ProductSelectionDialog';
import { TemplateFormHeader } from './form/TemplateFormHeader';
import { BasicInfoSection } from './form/BasicInfoSection';
import { IngredientsSection } from './form/IngredientsSection';
import { PricingSection } from './form/PricingSection';
import { FormActions } from './form/FormActions';
import { calculateTotalCost } from '@/utils/blend-calculations';
import { extractUnitId } from '@/utils/unit-helpers';
import { parseApiError } from '@/utils/error-handling';
import { BATCH_SIZE_DEFAULT } from '@/constants/blend-templates';
import type { Product } from '@/types/inventory';
import type { UnitOfMeasurement } from '@/types/inventory';
import type { 
  BlendTemplate, 
  CreateBlendTemplateData, 
  UpdateBlendTemplateData 
} from '@/types/blend';

interface TemplateFormProps {
  template?: BlendTemplate;
  products: Product[];
  unitOfMeasurements: UnitOfMeasurement[];
  onSubmit: (data: CreateBlendTemplateData | UpdateBlendTemplateData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function TemplateForm({ 
  template, 
  products, 
  unitOfMeasurements,
  onSubmit, 
  onCancel, 
  loading 
}: TemplateFormProps) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === 'super_admin';
  const isStaff = user?.role === 'staff';
  const canViewFixedBlends = hasPermission('blends', 'canViewFixedBlends');
  
  const { 
    formData, 
    setFormData, 
    ingredients, 
    addIngredient, 
    removeIngredient, 
    updateIngredient, 
    errors, 
    validateForm 
  } = useTemplateForm(template, unitOfMeasurements, products);
  
  const [showProductDialog, setShowProductDialog] = useState(false);

  const handleProductSelect = (product: Product) => {
    const result = addIngredient(product);
    if (result.success) {
      setShowProductDialog(false);
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Find the selected unit to get its name
    const selectedUnit = unitOfMeasurements.find(u => extractUnitId(u) === formData.unitOfMeasurementId);
    
    if (!selectedUnit) {
      toast({
        title: "Validation Error",
        description: "Please select a base unit for the template",
        variant: "destructive"
      });
      return;
    }
    
    const templateData: CreateBlendTemplateData = {
      name: formData.name.trim(),
      description: formData.description?.trim(),
      category: formData.category?.trim(),
      unitOfMeasurementId: extractUnitId(selectedUnit),
      unitName: selectedUnit.name,
      createdBy: formData.createdBy,
      batchSize: BATCH_SIZE_DEFAULT,
      sellingPrice: (isSuperAdmin || isStaff) ? formData.sellingPrice : undefined,
      ingredients: ingredients.map(ing => ({
        productId: ing.productId,
        name: ing.name,
        quantity: ing.quantity,
        unitOfMeasurementId: ing.unitOfMeasurementId,
        unitName: ing.unitName,
        costPerUnit: ing.costPerUnit,
        notes: ing.notes
      }))
    };

    try {
      await onSubmit(templateData);
      toast({
        title: "Success",
        description: template ? "Template updated successfully" : "Template created successfully",
      });
    } catch (error: unknown) {
      console.error('Error submitting form:', error);
      const { message, field } = parseApiError(error);
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
      
      if (field) {
        // Highlight the field with the error
        setFormData(prev => ({ ...prev })); // Trigger re-render to show error
      }
    }
  };

  const totalCost = calculateTotalCost(ingredients);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <TemplateFormHeader template={template} />
      
      <BasicInfoSection
        formData={formData}
        onChange={(data) => setFormData(prev => ({ ...prev, ...data }))}
        errors={errors}
        units={unitOfMeasurements}
      />
      
      {(!isStaff || (isStaff && canViewFixedBlends)) && (
        <IngredientsSection
          ingredients={ingredients}
          onAdd={() => setShowProductDialog(true)}
          onRemove={removeIngredient}
          onUpdate={updateIngredient}
          errors={errors}
        />
      )}
      
      {(isSuperAdmin || isStaff) && (
        <PricingSection
          sellingPrice={formData.sellingPrice}
          totalCost={totalCost}
          onChange={(price) => setFormData(prev => ({ ...prev, sellingPrice: price }))}
        />
      )}
      
      <FormActions
        loading={loading}
        onCancel={onCancel}
        isEdit={!!template}
      />
      
      <ProductSelectionDialog
        open={showProductDialog}
        onOpenChange={setShowProductDialog}
        onSelectProduct={handleProductSelect}
        selectedProducts={ingredients.map(i => i.productId)}
        products={products}
      />
    </form>
  );
}