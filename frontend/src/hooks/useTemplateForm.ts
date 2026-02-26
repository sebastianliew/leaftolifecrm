import { useState, useCallback, useEffect } from 'react';
import type { BlendTemplate, BlendIngredient } from '@/types/blend';
import type { Product, UnitOfMeasurement } from '@/types/inventory';
import { extractUnitId, getDefaultUnit } from '@/utils/unit-helpers';
// Container helpers removed — container tracking no longer exists
import { DEFAULT_INGREDIENT_QUANTITY } from '@/constants/blend-templates';

interface FormData {
  name: string;
  description: string;
  category: string;
  unitOfMeasurementId: string;
  createdBy: string;
  sellingPrice: number;
}

const getInitialFormData = (template?: BlendTemplate): FormData => {
  const unitId = template?.unitOfMeasurementId ? extractUnitId(template.unitOfMeasurementId) : '';
  
  return {
    name: template?.name || '',
    description: template?.description || '',
    category: template?.category || '',
    unitOfMeasurementId: unitId,
    createdBy: 'current_user',
    sellingPrice: template?.sellingPrice || 0
  };
};

export function useTemplateForm(template?: BlendTemplate, units: UnitOfMeasurement[] = [], products: Product[] = []) {
  const [formData, setFormData] = useState<FormData>(getInitialFormData(template));
  
  // Enrich existing template ingredients with current stock data
  const initialIngredients = template?.ingredients?.map(ing => {
    // Handle both populated (object) and non-populated (string) productId
    const productId = typeof ing.productId === 'object' && ing.productId !== null 
      ? (ing.productId as { _id?: string; id?: string })._id || (ing.productId as { _id?: string; id?: string }).id
      : ing.productId;
      
    const product = products.find(p => 
      p._id === productId || 
      (p as Product & { id?: string }).id === productId ||
      p._id === productId?.toString() ||
      (p as Product & { id?: string }).id === productId?.toString()
    );
    
    return {
      ...ing,
      availableStock: product?.currentStock || 0
    };
  }) || [];
  
  const [ingredients, setIngredients] = useState<BlendIngredient[]>(initialIngredients);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update ingredients with stock data when products load (handles async loading)
  useEffect(() => {
    if (template?.ingredients && products.length > 0) {
      setIngredients(prevIngredients => 
        prevIngredients.map(ing => {
          // Handle both populated (object) and non-populated (string) productId
          const productId = typeof ing.productId === 'object' && ing.productId !== null 
            ? (ing.productId as { _id?: string; id?: string })._id || (ing.productId as { _id?: string; id?: string }).id
            : ing.productId;
            
          const product = products.find(p => 
            p._id === productId || 
            (p as Product & { id?: string }).id === productId ||
            p._id === productId?.toString() ||
            (p as Product & { id?: string }).id === productId?.toString()
          );
          
          return {
            ...ing,
            availableStock: product?.currentStock || 0
          };
        })
      );
    }
  }, [products, template?._id, template?.ingredients]); // Only re-run when products change or editing a different template

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Template name is required';
    }

    if (!formData.unitOfMeasurementId) {
      newErrors.unitOfMeasurementId = 'Base unit is required';
    }

    if (ingredients.length === 0) {
      newErrors.ingredients = 'At least one ingredient is required';
    }

    const invalidIngredients = ingredients.filter(ing => !ing.unitOfMeasurementId);
    if (invalidIngredients.length > 0) {
      newErrors.ingredients = `The following ingredients are missing unit of measurement: ${invalidIngredients.map(ing => ing.name).join(', ')}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, ingredients]);

  const addIngredient = useCallback((product: Product) => {
    const existingIngredient = ingredients.find(ing => ing.productId === product._id);
    
    if (existingIngredient) {
      return { success: false, error: 'This product is already added as an ingredient' };
    }

    const productUOM = product.unitOfMeasurement;
    let unitId = '';
    let unitName = '';
    const costPerUnit = product.sellingPrice || 0;
    const defaultQuantity = DEFAULT_INGREDIENT_QUANTITY;
    const availableStock = product.currentStock || 0;

    // Use product's unit
    if (!unitId && productUOM) {
      if (typeof productUOM === 'object' && productUOM !== null) {
        // Handle populated unit object
        unitId = productUOM._id || productUOM.id || '';
        unitName = productUOM.name || '';
      } else if (typeof productUOM === 'string') {
        // Handle unit ID reference
        const uom = units.find(u => u._id === productUOM || u.id === productUOM);
        unitId = productUOM;
        unitName = uom?.name || '';
      }
    }

    // If still no unit, log for debugging
    if (!unitId) {
      console.warn('No unit found for product:', {
        productName: product.name,
        productUOM: productUOM,
        units: units.length
      });
      
      // Try to find a default unit as last resort
      const defaultUnit = getDefaultUnit(units);
      if (defaultUnit) {
        unitId = defaultUnit._id || defaultUnit.id || '';
        unitName = defaultUnit.name || '';
        console.log('Using default unit:', unitName);
      } else {
        return { 
          success: false, 
          error: `Cannot add ingredient "${product.name}" - no unit of measurement found` 
        };
      }
    }

    const newIngredient: BlendIngredient = {
      productId: product._id,
      name: product.name,
      quantity: defaultQuantity,
      unitOfMeasurementId: unitId,
      unitName: unitName,
      costPerUnit: costPerUnit,
      availableStock: availableStock
    };

    setIngredients(prev => [...prev, newIngredient]);
    setErrors(prev => {
      const { ingredients: _ingredients, ...rest } = prev;
      return rest;
    });
    return { success: true };
  }, [ingredients, units]);

  const updateIngredient = useCallback((index: number, field: keyof BlendIngredient, value: string | number | boolean | undefined) => {
    setIngredients(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const removeIngredient = useCallback((index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(getInitialFormData());
    setIngredients([]);
    setErrors({});
  }, []);

  return {
    formData,
    setFormData,
    ingredients,
    setIngredients,
    addIngredient,
    updateIngredient,
    removeIngredient,
    errors,
    setErrors,
    validateForm,
    resetForm
  };
}