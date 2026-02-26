'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Minus, Calculator, Eye, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import UnitConversionService from '@/lib/unit-conversion';

/**
 * Determines the content unit based on container type.
 * Returns 'g' for jars, 'ml' for bottles, tubes, and everything else.
 */
function getContentUnit(containerType?: string | { name?: string } | null): string {
  const ct = (typeof containerType === 'string' ? containerType : containerType?.name || '').toLowerCase();
  if (ct.includes('jar')) return 'g';
  return 'ml'; // default for bottles, tubes, and everything else
}

interface Product {
  _id: string;
  name: string;
  unitName: string;
  currentStock: number;
  totalQuantity: number;
  sellingPrice: number;
  costPrice: number;
  containerCapacity?: number;
  containerType?: string;
  discountFlags?: {
    discountableInBlends: boolean;
  };
}

interface BlendIngredient {
  productId: string;
  product: Product;
  quantity: number;
  unit: string;
  costPerUnit: number;
  notes?: string;
}

interface QuickBlendCreatorProps {
  products: Product[];
  onSave: (blend: {
    blendName: string;
    targetSize: number;
    targetUnit: string;
    ingredients: Array<{
      productId: string;
      name: string;
      quantity: number;
      unitName: string;
      costPerUnit: number;
      notes: string;
    }>;
    totalCost: number;
    suggestedPrice: number;
    notes: string;
  }) => Promise<void>;
  onCancel: () => void;
  initialData?: {
    blendName?: string;
    targetSize?: number;
    targetUnit?: string;
    ingredients?: BlendIngredient[];
    notes?: string;
  };
  className?: string;
}

export default function QuickBlendCreator({
  products,
  onSave,
  onCancel,
  initialData,
  className = ''
}: QuickBlendCreatorProps) {
  const [blendName, setBlendName] = useState(initialData?.blendName || '');
  const [targetSize, setTargetSize] = useState(initialData?.targetSize || 100);
  const [targetUnit, setTargetUnit] = useState(initialData?.targetUnit || 'ml');
  const [ingredients, setIngredients] = useState<BlendIngredient[]>(initialData?.ingredients || []);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [notes, setNotes] = useState(initialData?.notes || '');

  // Available units based on selected products
  const availableUnits = useMemo(() => {
    const units = new Set(['ml', 'l', 'g', 'kg', 'drops', 'units']);
    ingredients.forEach(ing => {
      units.add(ing.product.unitName);
      units.add(ing.unit);
    });
    return Array.from(units);
  }, [ingredients]);

  // Blend calculations
  const blendCalculations = useMemo(() => {
    try {
      const totalQuantity = UnitConversionService.calculateBlendTotal(
        ingredients.map(ing => ({ quantity: ing.quantity, unit: ing.unit })),
        targetUnit
      );

      const totalCost = ingredients.reduce((sum, ing) => sum + (ing.quantity * ing.costPerUnit), 0);
      const suggestedPrice = totalCost * 2.5; // 150% markup
      
      return {
        totalQuantity: totalQuantity.value,
        totalCost,
        suggestedPrice,
        valid: totalQuantity.value > 0,
        error: null
      };
    } catch (error) {
      return {
        totalQuantity: 0,
        totalCost: 0,
        suggestedPrice: 0,
        valid: false,
        error: error instanceof Error ? error.message : 'Calculation error'
      };
    }
  }, [ingredients, targetUnit]);

  // Validate blend
  const validateBlend = useCallback(() => {
    const newErrors: string[] = [];
    
    if (!blendName.trim()) {
      newErrors.push('Blend name is required');
    }
    
    if (ingredients.length === 0) {
      newErrors.push('At least one ingredient is required');
    }
    
    if (targetSize <= 0) {
      newErrors.push('Target size must be greater than 0');
    }

    // Check if total exceeds target size significantly
    if (blendCalculations.valid && blendCalculations.totalQuantity > targetSize * 1.1) {
      newErrors.push(`Total ingredients (${blendCalculations.totalQuantity.toFixed(2)} ${targetUnit}) exceed target size`);
    }

    // Check stock availability
    ingredients.forEach(ing => {
      try {
        const containerUnits = ['bottle', 'bottles', 'box', 'boxes', 'container', 'containers', 'pack', 'packs'];
        const isContainerBased = ing.product.unitName && containerUnits.includes(ing.product.unitName.toLowerCase());
        
        if (isContainerBased && ing.product.containerCapacity) {
          // For container-based products, we need to check available content
          const availableContent = ing.product.currentStock * ing.product.containerCapacity;
          const contentUnit = getContentUnit(ing.product.containerType);
          
          // Convert needed quantity to content unit if necessary
          let neededContent = ing.quantity;
          if (ing.unit !== contentUnit) {
            const converted = UnitConversionService.convert(ing.quantity, ing.unit, contentUnit);
            neededContent = converted.value;
          }
          
          if (neededContent > availableContent) {
            newErrors.push(`Insufficient stock for ${ing.product.name}: need ${neededContent} ${contentUnit}, have ${availableContent} ${contentUnit} (${ing.product.currentStock} ${ing.product.unitName})`);
          }
        } else {
          // Standard unit-based products
          const neededInProductUnit = UnitConversionService.convert(
            ing.quantity,
            ing.unit,
            ing.product.unitName
          );
          
          if (neededInProductUnit.value > ing.product.totalQuantity) {
            newErrors.push(`Insufficient stock for ${ing.product.name}: need ${neededInProductUnit.value} ${ing.product.unitName}, have ${ing.product.totalQuantity}`);
          }
        }
      } catch (error) {
        console.warn(`Unit conversion failed for ${ing.product.name}: ${ing.unit} to ${ing.product.unitName}`, error);
        // Skip validation for incompatible units rather than blocking the entire process
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [blendName, ingredients, targetSize, targetUnit, blendCalculations]);

  const addIngredient = () => {
    if (!selectedProductId) return;
    
    const product = products.find(p => p._id === selectedProductId);
    if (!product) return;

    // Check if ingredient already exists
    if (ingredients.some(ing => ing.productId === selectedProductId)) {
      setErrors(['Product already added to blend']);
      return;
    }

    // Calculate correct cost per unit based on container information
    let costPerUnit = product.costPrice || 0;
    let defaultUnit = product.unitName || 'units';
    let defaultQuantity = 10;

    // Handle container-based products
    const containerUnits = ['bottle', 'bottles', 'box', 'boxes', 'container', 'containers', 'pack', 'packs'];
    const isContainerBased = product.unitName && containerUnits.includes(product.unitName.toLowerCase());
    
    if (isContainerBased && product.containerCapacity) {
      // Product is tracked in containers but we want to use content units
      // Determine the content unit (usually ml for bottles, g for boxes)
      const contentUnit = getContentUnit(product.containerType);
      
      defaultUnit = contentUnit;
      defaultQuantity = Math.min(50, product.containerCapacity / 4); // Suggest 1/4 of container or 50 units
      costPerUnit = product.costPrice / product.containerCapacity; // Cost per content unit
    }

    const newIngredient: BlendIngredient = {
      productId: selectedProductId,
      product,
      quantity: defaultQuantity,
      unit: defaultUnit,
      costPerUnit,
      notes: ''
    };

    setIngredients([...ingredients, newIngredient]);
    setSelectedProductId('');
    setErrors([]);
  };

  const updateIngredient = (index: number, field: keyof BlendIngredient, value: BlendIngredient[keyof BlendIngredient]) => {
    const updated = [...ingredients];
    const ingredient = updated[index];
    
    // If unit is changing, recalculate cost per unit
    if (field === 'unit' && value !== ingredient.unit) {
      const containerUnits = ['bottle', 'bottles', 'box', 'boxes', 'container', 'containers', 'pack', 'packs'];
      const isContainerBased = ingredient.product.unitName && containerUnits.includes(ingredient.product.unitName.toLowerCase());
      
      if (isContainerBased && ingredient.product.containerCapacity) {
        const contentUnit = getContentUnit(ingredient.product.containerType);
        
        // Calculate cost per unit for the new unit
        let newCostPerUnit = ingredient.product.costPrice / ingredient.product.containerCapacity;
        
        // If the new unit is different from content unit, convert the cost
        if (value !== contentUnit) {
          try {
            const conversion = UnitConversionService.convert(1, contentUnit, String(value));
            newCostPerUnit = newCostPerUnit / conversion.value;
          } catch {
            // If conversion fails, keep original cost calculation
            newCostPerUnit = ingredient.costPerUnit;
          }
        }
        
        updated[index] = { ...updated[index], [field]: value as string, costPerUnit: newCostPerUnit };
      } else {
        updated[index] = { ...updated[index], [field]: value as string };
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    
    setIngredients(updated);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!validateBlend()) return;

    const blendData = {
      blendName,
      targetSize,
      targetUnit,
      ingredients: ingredients.map(ing => ({
        productId: ing.productId,
        name: ing.product.name,
        quantity: ing.quantity,
        unitName: ing.unit,
        costPerUnit: ing.costPerUnit,
        notes: ing.notes || ''
      })),
      totalCost: blendCalculations.totalCost,
      suggestedPrice: blendCalculations.suggestedPrice,
      notes
    };

    try {
      await onSave(blendData);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Save failed']);
    }
  };

  const reset = () => {
    setBlendName('');
    setTargetSize(100);
    setTargetUnit('ml');
    setIngredients([]);
    setNotes('');
    setErrors([]);
  };

  const suggestOptimalQuantities = () => {
    if (ingredients.length === 0) return;

    const equalPortion = targetSize / ingredients.length;
    const updated = ingredients.map(ing => ({
      ...ing,
      quantity: Math.round(equalPortion * 100) / 100
    }));
    setIngredients(updated);
  };

  const IngredientRow = ({ ingredient, index }: { ingredient: BlendIngredient; index: number }) => {
    const [quantity, setQuantity] = useState(ingredient.quantity.toString());
    const [unit, setUnit] = useState(ingredient.unit);

    const handleQuantityChange = (value: string) => {
      setQuantity(value);
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        updateIngredient(index, 'quantity', numValue);
      }
    };

    const handleUnitChange = (newUnit: string) => {
      setUnit(newUnit);
      updateIngredient(index, 'unit', newUnit);
    };

    // Check stock status
    const stockStatus = useMemo(() => {
      try {
        const containerUnits = ['bottle', 'bottles', 'box', 'boxes', 'container', 'containers', 'pack', 'packs'];
        const isContainerBased = ingredient.product.unitName && containerUnits.includes(ingredient.product.unitName.toLowerCase());
        
        if (isContainerBased && ingredient.product.containerCapacity) {
          // For container-based products
          const availableContent = ingredient.product.currentStock * ingredient.product.containerCapacity;
          const contentUnit = getContentUnit(ingredient.product.containerType);
          
          let neededContent = ingredient.quantity;
          if (ingredient.unit !== contentUnit) {
            const converted = UnitConversionService.convert(ingredient.quantity, ingredient.unit, contentUnit);
            neededContent = converted.value;
          }
          
          if (neededContent > availableContent) {
            return { 
              status: 'insufficient', 
              available: availableContent, 
              needed: neededContent, 
              unit: contentUnit,
              containerInfo: `${ingredient.product.currentStock || 0} ${ingredient.product.unitName || 'units'}`
            };
          } else if (neededContent > availableContent * 0.8) {
            return { 
              status: 'low', 
              available: availableContent, 
              needed: neededContent, 
              unit: contentUnit,
              containerInfo: `${ingredient.product.currentStock || 0} ${ingredient.product.unitName || 'units'}`
            };
          }
          return { 
            status: 'ok', 
            available: availableContent, 
            needed: neededContent, 
            unit: contentUnit,
            containerInfo: `${ingredient.product.currentStock || 0} ${ingredient.product.unitName || 'units'}`
          };
        } else {
          // Standard unit-based products
          const neededInProductUnit = UnitConversionService.convert(
            ingredient.quantity,
            ingredient.unit,
            ingredient.product.unitName || 'units'
          );
          
          const available = ingredient.product.totalQuantity || 0;
          const needed = neededInProductUnit.value;
          
          if (needed > available) {
            return { status: 'insufficient', available, needed, unit: ingredient.product.unitName || 'units' };
          } else if (needed > available * 0.8) {
            return { status: 'low', available, needed, unit: ingredient.product.unitName || 'units' };
          }
          return { status: 'ok', available, needed, unit: ingredient.product.unitName || 'units' };
        }
      } catch {
        return { status: 'error', available: 0, needed: 0, unit: ingredient.product.unitName || 'units' };
      }
    }, [ingredient]);

    return (
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{ingredient.product.name}</div>
          <div className="text-xs text-gray-500">
            Stock: {stockStatus.available} {stockStatus.unit}
            {stockStatus.containerInfo && (
              <span className="ml-1">({stockStatus.containerInfo})</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={quantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            className="w-20 h-8 text-sm"
            min="0"
            step="0.1"
          />
          
          <Select value={unit} onValueChange={handleUnitChange}>
            <SelectTrigger className="w-20 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.map(u => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          {stockStatus.status === 'insufficient' && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Low
            </Badge>
          )}
          {stockStatus.status === 'low' && (
            <Badge variant="outline" className="text-xs">
              Limited
            </Badge>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeIngredient(index)}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
          >
            <Minus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    validateBlend();
  }, [ingredients, blendName, targetSize, targetUnit, validateBlend]);

  return (
    <div className={`max-w-4xl mx-auto space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Quick Blend Creator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="blendName">Blend Name</Label>
              <Input
                id="blendName"
                value={blendName}
                onChange={(e) => setBlendName(e.target.value)}
                placeholder="Enter blend name"
              />
            </div>
            
            <div>
              <Label htmlFor="targetSize">Target Size</Label>
              <Input
                id="targetSize"
                type="number"
                value={targetSize}
                onChange={(e) => setTargetSize(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.1"
              />
            </div>
            
            <div>
              <Label htmlFor="targetUnit">Unit</Label>
              <Select value={targetUnit} onValueChange={setTargetUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableUnits.map(unit => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Ingredient */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Ingredients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a product to add" />
              </SelectTrigger>
              <SelectContent>
                {products
                  .filter(p => !ingredients.some(ing => ing.productId === p._id))
                  .map(product => {
                    const containerUnits = ['bottle', 'bottles', 'box', 'boxes', 'container', 'containers', 'pack', 'packs'];
                    const isContainerBased = product.unitName && containerUnits.includes(product.unitName.toLowerCase());
                    
                    let displayText = product.name;
                    if (isContainerBased && product.containerCapacity) {
                      const contentUnit = getContentUnit(product.containerType);
                      const totalContent = product.currentStock * product.containerCapacity;
                      displayText += ` (${product.currentStock || 0} ${product.unitName || 'units'}, ${totalContent} ${contentUnit})`;
                    } else {
                      displayText += ` (${product.totalQuantity || 0} ${product.unitName || 'units'})`;
                    }
                    
                    return (
                      <SelectItem key={product._id} value={product._id}>
                        {displayText}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
            
            <Button onClick={addIngredient} disabled={!selectedProductId}>
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients List */}
      {ingredients.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Ingredients ({ingredients.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={suggestOptimalQuantities}>
                <Calculator className="w-4 h-4 mr-2" />
                Equal Portions
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {ingredients.map((ingredient, index) => (
              <IngredientRow key={ingredient.productId} ingredient={ingredient} index={index} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Blend Summary */}
      {ingredients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Blend Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Total Quantity</div>
                <div className="font-medium">
                  {blendCalculations.totalQuantity.toFixed(2)} {targetUnit}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Target Size</div>
                <div className="font-medium">{targetSize} {targetUnit}</div>
              </div>
              <div>
                <div className="text-gray-500">Total Cost</div>
                <div className="font-medium">${blendCalculations.totalCost.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-500">Suggested Price</div>
                <div className="font-medium">${blendCalculations.suggestedPrice.toFixed(2)}</div>
              </div>
            </div>

            {blendCalculations.error && (
              <Alert className="mt-4">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{blendCalculations.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any preparation notes or special instructions..."
            className="w-full h-20 p-3 border rounded-md resize-none"
          />
        </CardContent>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!blendName.trim() || ingredients.length === 0 || targetSize <= 0}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Blend
          </Button>
        </div>
      </div>
    </div>
  );
}