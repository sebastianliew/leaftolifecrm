"use client"

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { FaPlus, FaTrash, FaSearch, FaCheck, FaTimes, FaExclamationTriangle, FaCalculator, FaFlask, FaClipboardList } from 'react-icons/fa';
import { ImSpinner8 } from 'react-icons/im';
import type { Product } from '@/types/inventory';
import type { UnitOfMeasurement } from '@/types/inventory';
import type { 
  BlendIngredient,
  ValidationResult,
  CostCalculation,
  PricingSuggestion,
  CustomBlendData
} from '@/types/blend';

import type { TransactionItem } from '@/types/transaction';
import { useBlendTemplates } from '@/hooks/useBlendTemplates';
import { useToast } from '@/hooks/use-toast';

import type { CustomBlendHistoryItem, BlendHistoryIngredient } from './BlendHistorySelector';
import { usePermissions } from '@/hooks/usePermissions';


interface CustomBlendCreatorProps {
  open: boolean;
  onClose: () => void;
  onCreateBlend: (blendItem: TransactionItem) => void;
  onUpdateBlend?: (blendItem: TransactionItem) => void;
  editingBlend?: TransactionItem;
  products: Product[];
  unitOfMeasurements: UnitOfMeasurement[];
  loading?: boolean;
  customerId?: string;
  customerName?: string;
}

export function CustomBlendCreator({
  open,
  onClose,
  onCreateBlend,
  onUpdateBlend,
  editingBlend,
  products,
  unitOfMeasurements,
  loading: parentLoading,
  customerId: _customerId,
  customerName: _customerName
}: CustomBlendCreatorProps) {
  const { validateIngredients } = useBlendTemplates();
  const { user } = usePermissions();
  const { toast } = useToast();
  const _isSuperAdmin = user?.role === 'super_admin';

  const [blendName, setBlendName] = useState('');
  const [preparationNotes, setPreparationNotes] = useState('');
  const [ingredients, setIngredients] = useState<(BlendIngredient & { sellingPricePerUnit?: number })[]>([]);
  const [marginPercent, setMarginPercent] = useState(0);
  const [finalPrice, setFinalPrice] = useState<string>('');
  const [pricingMode, setPricingMode] = useState<'margin' | 'manual'>('margin');
  const [manualPrice, setManualPrice] = useState<string>('');
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [_isLoadingEditData, setIsLoadingEditData] = useState(false);

  // Track if form has been initialized for current dialog session
  const hasInitializedRef = useRef(false);

  // Reset form when dialog opens/closes or load editing data
  useEffect(() => {
    // Reset initialization flag when dialog closes
    if (!open) {
      hasInitializedRef.current = false;
      return;
    }

    // Skip if already initialized for this session (prevents form reset on dependency changes)
    if (hasInitializedRef.current && !editingBlend) {
      return;
    }
    
    if (editingBlend && editingBlend.customBlendData) {
      setIsLoadingEditData(true);
      
      // Simulate async loading to show placeholder
      setTimeout(() => {
        // Load existing blend data for editing
        const blendData = editingBlend.customBlendData;
        if (!blendData) return; // Type guard to ensure blendData exists
        
        setBlendName(blendData.name);
        setPreparationNotes(blendData.preparationNotes || '');

        // Set ingredients from blend data and find current product info
        setIngredients(blendData.ingredients?.map(ingredient => {
          // Find the product from the products array to get current stock and price
          const currentProduct = products.find(p => p._id === ingredient.productId);

          return {
            productId: ingredient.productId,
            name: ingredient.name,
            quantity: ingredient.quantity,
            unitOfMeasurementId: ingredient.unitOfMeasurementId,
            unitName: ingredient.unitName,
            costPerUnit: currentProduct?.sellingPrice || ingredient.costPerUnit || 0,
            availableStock: currentProduct?.currentStock || 0,
            sellingPricePerUnit: currentProduct?.sellingPrice || 0,
            notes: ''
          };
        }));

        // Calculate and restore the original margin ratio so price recalculates with fresh ingredient costs
        const oldTotalIngredientCost = blendData.totalIngredientCost || 0;
        const oldUnitPrice = editingBlend.unitPrice || 0;

        if (oldTotalIngredientCost > 0 && oldUnitPrice > 0) {
          // Calculate what margin was used: margin = ((price / cost) - 1) * 100
          const calculatedMargin = ((oldUnitPrice / oldTotalIngredientCost) - 1) * 100;
          setMarginPercent(Math.round(calculatedMargin));
        } else if (blendData.marginPercent) {
          // Fallback: use stored margin if available
          setMarginPercent(blendData.marginPercent);
        }

        // Don't set finalPrice from old unitPrice - let margin-based pricingSuggestion recalculate
        // with fresh ingredient prices. This ensures the final price reflects current inventory costs.
        
        setIsLoadingEditData(false);
      }, 300); // Small delay to show loading state
    } else if (!editingBlend) {
      // Reset for new blend only if not editing
      setBlendName('');
      setPreparationNotes('');
      setIngredients([]);
      setMarginPercent(0);
      setFinalPrice('');
      setIsLoadingEditData(false);
    } else if (editingBlend) {
      // Fallback: populate with basic item data if customBlendData is missing
      setBlendName(editingBlend.name || 'Custom Blend')
      setFinalPrice(editingBlend.unitPrice ? editingBlend.unitPrice.toString() : '')
      setIngredients([]) // We can't restore ingredients without customBlendData
      setPreparationNotes('Note: Original blend data not available for editing')
      setIsLoadingEditData(false)
    }

    // Mark as initialized after setting up the form
    hasInitializedRef.current = true;
  }, [open, editingBlend, products]);

  // Pricing calculation function (base calculation uses selling prices of ingredients)
  const calculateCost = async (ingredients: BlendIngredient[], margin: number) => {
    // Sum up selling prices of all ingredients (costPerUnit field contains selling price)
    const totalSellingPrice = ingredients.reduce((sum, ing) => {
      return sum + (ing.quantity * (ing.costPerUnit || 0));
    }, 0);

    const markupAmount = totalSellingPrice * (margin / 100);
    const suggestedPrice = totalSellingPrice + markupAmount;
    const minimumPrice = totalSellingPrice * 1.1; // 10% minimum margin

    return {
      cost: {
        totalCost: totalSellingPrice,
        breakdown: ingredients.map(ing => ({
          ingredientId: ing.productId,
          ingredientName: ing.name,
          quantity: ing.quantity,
          unitCost: ing.costPerUnit || 0,
          totalCost: ing.quantity * (ing.costPerUnit || 0)
        }))
      },
      pricing: {
        suggestedPrice,
        minimumPrice,
        profitMargin: margin,
        breakdown: {
          cost: totalSellingPrice,
          markup: markupAmount,
          suggestedMarkupPercent: margin
        }
      }
    };
  };

  const [showProductDialog, setShowProductDialog] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [_costCalculation, setCostCalculation] = useState<CostCalculation | null>(null);
  const [pricingSuggestion, setPricingSuggestion] = useState<PricingSuggestion | null>(null);
  const [_validating, setValidating] = useState(false);
  const [_calculating, setCalculating] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});


  // Auto-validate ingredients when they change
  useEffect(() => {
    const runValidation = async () => {
      if (ingredients.length > 0) {
        setValidating(true);
        try {
          const result = await validateIngredients(ingredients, 1);
          setValidation(result);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          console.error(`Validation failed: ${errorMessage}`);
          setValidation(null);
        } finally {
          setValidating(false);
        }
      } else {
        setValidation(null);
      }
    };

    runValidation();
  }, [ingredients, validateIngredients]);

  // Auto-calculate cost when ingredients or margin change
  useEffect(() => {
    const runCostCalculation = async () => {
      if (ingredients.length > 0) {
        setCalculating(true);
        try {
          const result = await calculateCost(ingredients, marginPercent);
          setCostCalculation(result.cost);
          setPricingSuggestion(result.pricing);
          
          // Update manual price when margin changes if in margin mode and not manually updating
          if (pricingMode === 'margin' && !isUpdatingPrice) {
            setManualPrice(result.pricing.suggestedPrice.toFixed(2));
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          console.error(`Cost calculation failed: ${errorMessage}`);
          setCostCalculation(null);
          setPricingSuggestion(null);
        } finally {
          setCalculating(false);
        }
      } else {
        setCostCalculation(null);
        setPricingSuggestion(null);
      }
    };

    runCostCalculation();
  }, [ingredients, marginPercent, pricingMode, isUpdatingPrice]);

  const _resetForm = () => {
    setBlendName('');
    setPreparationNotes('');
    setIngredients([]);
    setMarginPercent(0);
    setPricingMode('margin');
    setManualPrice('');
    setIsUpdatingPrice(false);
    setValidation(null);
    setCostCalculation(null);
    setPricingSuggestion(null);
    setErrors({});
  };

  // Filter products for search - allow all products (similar to blend templates)
  const filteredProducts = products.filter(product => {
    if (!product.isActive) return false;
    
    // Filter by search term
    const matchesSearch = product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                         product.sku.toLowerCase().includes(productSearch.toLowerCase());
    
    return matchesSearch;
  });

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const errorMessages: string[] = [];

    if (!blendName.trim()) {
      newErrors.blendName = 'Blend name is required';
      errorMessages.push('Blend name is required');
    }

    if (ingredients.length === 0) {
      newErrors.ingredients = 'At least one ingredient is required';
      errorMessages.push('At least one ingredient is required');
    }

    // Validate each ingredient
    ingredients.forEach((ingredient, index) => {
      if (ingredient.quantity <= 0) {
        newErrors[`ingredient_${index}_quantity`] = 'Quantity must be greater than 0';
        errorMessages.push(`${ingredient.name}: Quantity must be greater than 0`);
      }
    });

    setErrors(newErrors);

    // Show toast notification if there are errors
    if (errorMessages.length > 0) {
      toast({
        title: 'Validation Error',
        description: errorMessages.length === 1
          ? errorMessages[0]
          : `Please fix the following issues:\n${errorMessages.join('\n')}`,
        variant: 'destructive'
      });
    }

    return Object.keys(newErrors).length === 0;
  };

  // Add ingredient
  const addIngredient = (product: Product) => {
    const existingIngredient = ingredients.find(ing => ing.productId === product._id);
    
    if (existingIngredient) {
      toast({
        title: 'Duplicate Ingredient',
        description: `${product.name} is already added as an ingredient`,
        variant: 'destructive'
      });
      return;
    }

    const productUOM = product.unitOfMeasurement;
    let unitId = '';
    let unitName = '';
    let costPerUnit = product.sellingPrice || 0;
    let defaultQuantity = 1;
    let availableStock = product.currentStock || 0;

    // For liquid products, the selling price should already be per-ml
    // Just need to set the correct unit of measurement to ml
    
    // Check if this is a liquid product (likely measured in ml)
    const isLiquidProduct = product.name.includes('ML') || product.name.includes('ml') || 
                           (productUOM && typeof productUOM === 'object' && productUOM.name && 
                            productUOM.name.toLowerCase().includes('ml'));
    
    if (isLiquidProduct) {
      // Find ml unit of measurement
      const mlUOM = unitOfMeasurements.find(u => 
        u.name.toLowerCase().includes('milliliter') || u.name.toLowerCase().includes('ml')
      );
      
      if (mlUOM) {
        unitId = mlUOM._id || '';
        unitName = mlUOM.name || 'ml';
        // For liquid products, cost is already per ml
        costPerUnit = product.sellingPrice || 0;
        // Set a reasonable default quantity
        defaultQuantity = 1;
        // Available stock is already in the correct units
        availableStock = product.currentStock || 0;
      } else {
        // Fallback to original logic
        if (typeof productUOM === 'object' && productUOM !== null) {
          unitId = productUOM._id || '';
          unitName = productUOM.name || '';
        } else if (typeof productUOM === 'string') {
          const uom = unitOfMeasurements.find(u => u._id === productUOM);
          unitId = productUOM;
          unitName = uom?.name || '';
        }
      }
    } else {
      // Non-liquid product - use original logic
      if (typeof productUOM === 'object' && productUOM !== null) {
        unitId = productUOM._id || '';
        unitName = productUOM.name || '';
      } else if (typeof productUOM === 'string') {
        const uom = unitOfMeasurements.find(u => u._id === productUOM);
        unitId = productUOM;
        unitName = uom?.name || '';
      }
    }


    // Calculate selling price per unit - for now just use the product selling price
    const sellingPricePerUnit = product.sellingPrice || 0;

    const newIngredient: BlendIngredient & { sellingPricePerUnit?: number } = {
      productId: product._id,
      name: product.name,
      quantity: defaultQuantity,
      unitOfMeasurementId: unitId,
      unitName: unitName,
      costPerUnit: Number(costPerUnit.toFixed(4)), // Ensure it's always a number and rounded to 4 decimal places
      availableStock: availableStock,
      sellingPricePerUnit: sellingPricePerUnit // Actually use the variable
    };

    setIngredients([...ingredients, newIngredient]);
    setShowProductDialog(false);
    setProductSearch('');
  };

  // Update ingredient
  const updateIngredient = (index: number, field: keyof (BlendIngredient & { sellingPricePerUnit?: number }), value: string | number) => {
    const updatedIngredients = [...ingredients];
    updatedIngredients[index] = { ...updatedIngredients[index], [field]: value };
    setIngredients(updatedIngredients);
  };

  // Remove ingredient
  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  // Load blend from history
  const _handleLoadFromHistory = (blend: CustomBlendHistoryItem) => {
    setBlendName(blend.blendName);
    setPreparationNotes(blend.preparationNotes || '');
    // TODO: Set container type from blend history if available
    setMarginPercent(blend.marginPercent);
    
    // Convert history ingredients to current format
    const convertedIngredients: (BlendIngredient & { sellingPricePerUnit?: number })[] = blend.ingredients.map((ing: BlendHistoryIngredient) => ({
      productId: ing.productId,
      name: ing.name,
      quantity: ing.quantity,
      unitOfMeasurementId: typeof ing.unitOfMeasurementId === 'object' && ing.unitOfMeasurementId !== null
        ? ing.unitOfMeasurementId._id || ing.unitOfMeasurementId.id || ''
        : ing.unitOfMeasurementId || '',
      unitName: ing.unitName,
      costPerUnit: ing.costPerUnit,
      sellingPricePerUnit: 0, // Will need to be recalculated from product
      availableStock: 0 // Will be updated when product is found
    }));
    
    setIngredients(convertedIngredients);
  };




  // Handle blend creation
  const handleCreateCustomBlend = () => {
    if (!validateForm()) {
      return;
    }

    // Use real-time calculated total price (sum of selling prices)
    const calculatedTotalPrice = ingredients.reduce((total, ingredient) => 
      total + (ingredient.quantity * (ingredient.costPerUnit || 0)), 0 // costPerUnit contains selling price
    );
    
    // Use pricing based on selected mode
    const parsedFinalPrice = finalPrice ? parseFloat(finalPrice) : null;
    const calculatedSellingPrice = pricingMode === 'manual' 
      ? (parseFloat(manualPrice) || 0)
      : (parsedFinalPrice || pricingSuggestion?.suggestedPrice || (calculatedTotalPrice * 2));
    
    const now = new Date();

    const customBlendData: CustomBlendData = {
      name: blendName,
      ingredients: ingredients.map(ing => ({
        productId: ing.productId,
        name: ing.name,
        quantity: ing.quantity,
        unitOfMeasurementId: typeof ing.unitOfMeasurementId === 'object' && ing.unitOfMeasurementId !== null
          ? ing.unitOfMeasurementId._id || ing.unitOfMeasurementId.id || ''
          : ing.unitOfMeasurementId || '',
        unitName: ing.unitName,
        costPerUnit: Number((ing.costPerUnit ?? 0).toFixed(4))
      })),
      totalIngredientCost: calculatedTotalPrice, // Note: field name is 'Cost' but contains sum of selling prices
      preparationNotes,
      mixedBy: user?.name || user?.email || 'unknown',
      mixedAt: now,
      marginPercent: marginPercent, // Store margin for future edits
    };

    const blendItem: TransactionItem = {
      id: editingBlend?.id || `custom_blend_${Date.now()}`,
      productId: editingBlend?.productId || `custom_blend_${Date.now()}`,
      name: blendName,
      description: preparationNotes || 'Custom blend',
      quantity: editingBlend?.quantity || 1,
      unitPrice: calculatedSellingPrice,
      totalPrice: calculatedSellingPrice * (editingBlend?.quantity || 1),
      discountAmount: editingBlend?.discountAmount || 0,
      isService: false,
      saleType: 'quantity',
      unitOfMeasurementId: (() => {
        const firstIngredientUnitId = ingredients[0]?.unitOfMeasurementId;
        if (typeof firstIngredientUnitId === 'object' && firstIngredientUnitId !== null) {
          return firstIngredientUnitId._id || firstIngredientUnitId.id || '';
        }
        return firstIngredientUnitId || '';
      })(),
      baseUnit: ingredients[0]?.unitName || 'unit',
      convertedQuantity: editingBlend?.quantity || 1,
      itemType: 'custom_blend',
      customBlendData: {
        name: customBlendData.name,
        totalIngredientCost: customBlendData.totalIngredientCost,
        preparationNotes: customBlendData.preparationNotes,
        mixedBy: customBlendData.mixedBy,
        mixedAt: customBlendData.mixedAt,
        marginPercent: customBlendData.marginPercent,
        ingredients: customBlendData.ingredients.map(ingredient => ({
          productId: ingredient.productId,
          name: ingredient.name,
          quantity: ingredient.quantity,
          unitOfMeasurementId: ingredient.unitOfMeasurementId as string,
          unitName: ingredient.unitName,
          costPerUnit: ingredient.costPerUnit || 0
        }))
      }
    };

    if (editingBlend && onUpdateBlend) {
      onUpdateBlend(blendItem);
      toast({
        title: 'Success',
        description: `${blendName} has been updated`
      });
    } else {
      onCreateBlend(blendItem);
      toast({
        title: 'Success',
        description: `${blendName} has been added to the transaction`
      });
    }
  };

  // Calculate total ingredient price (sum of selling prices)
  const totalIngredientPrice = ingredients.reduce((total, ingredient) => 
    total + (ingredient.quantity * (ingredient.costPerUnit || 0)), 0 // costPerUnit contains selling price
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FaFlask className="h-5 w-5" />
            {editingBlend ? 'Edit' : 'Create'} Custom Blend
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Blend Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="blendName">Blend Name *</Label>
                  <Input
                    id="blendName"
                    value={blendName}
                    onChange={(e) => setBlendName(e.target.value)}
                    placeholder="e.g., Custom Pain Relief Mix"
                    className={errors.blendName ? 'border-red-500' : ''}
                  />
                  {errors.blendName && <p className="text-sm text-red-500 mt-1">{errors.blendName}</p>}
                </div>

              </div>

              <div className="mt-4">
                <Label htmlFor="preparationNotes">Preparation Notes</Label>
                <Textarea
                  id="preparationNotes"
                  value={preparationNotes}
                  onChange={(e) => setPreparationNotes(e.target.value)}
                  placeholder="Special mixing instructions, storage notes, etc."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Ingredients */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FaClipboardList className="h-4 w-4 text-green-600" />
                  <CardTitle className="text-lg">Recipe Ingredients</CardTitle>
                </div>
                <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
                  <DialogTrigger asChild>
                    <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700">
                      <FaPlus className="mr-2 h-4 w-4" />
                      Add Ingredient
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Select Product as Ingredient</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="relative">
                        <FaSearch className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search products..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <div className="border rounded-lg">
                        {/* Fixed Header */}
                        <div className="bg-white border-b sticky top-0 z-10">
                          <div className="grid grid-cols-5 gap-4 p-3 font-medium text-sm">
                            <div>Name</div>
                            <div>Category</div>
                            <div>Stock</div>
                            <div>Selling Price</div>
                            <div>Action</div>
                          </div>
                        </div>
                        
                        {/* Scrollable Body */}
                        <div className="max-h-96 overflow-y-auto">
                          <div className="divide-y">
                            {filteredProducts.map(product => (
                              <div key={product._id} className="grid grid-cols-5 gap-4 p-3 items-center hover:bg-gray-50">
                                <div className="font-medium">{product.name}</div>
                                <div className="text-sm text-gray-600">{product.category?.name || 'N/A'}</div>
                                <div className="text-sm">
                                  <Badge
                                    variant={product.currentStock && product.currentStock > 0 ? 'default' : 'secondary'}
                                    className={product.currentStock && product.currentStock <= 0 ? 'bg-yellow-100 text-yellow-800' : ''}
                                  >
                                    {product.currentStock || 0}
                                    {product.currentStock && product.currentStock <= 0 && (
                                      <span className="ml-1 text-xs">⚠</span>
                                    )}
                                  </Badge>
                                </div>
                                <div className="text-sm">${product.sellingPrice?.toFixed(2) || '0.00'}</div>
                                <div>
                                  <Button
                                    size="sm"
                                    onClick={() => addIngredient(product)}
                                    disabled={ingredients.some(ing => ing.productId === product._id)}
                                  >
                                    {ingredients.some(ing => ing.productId === product._id) ? 'Added' : 'Add'}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {errors.ingredients && (
                <Alert className="mb-4" variant="destructive">
                  <AlertDescription>{errors.ingredients}</AlertDescription>
                </Alert>
              )}

              {ingredients.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Ingredient</TableHead>
                        <TableHead className="font-semibold">Volume</TableHead>
                        <TableHead className="font-semibold">Unit</TableHead>
                        <TableHead className="font-semibold">Converted</TableHead>
                        <TableHead className="font-semibold">Selling Price</TableHead>
                        <TableHead className="font-semibold">Stock</TableHead>
                        <TableHead className="font-semibold w-20">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {ingredients.map((ingredient, index) => (
                      <TableRow key={index}>
                        <TableCell>{ingredient.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ingredient.quantity}
                            onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className={`w-24 ${errors[`ingredient_${index}_quantity`] ? 'border-red-500' : ''}`}
                          />
                          {errors[`ingredient_${index}_quantity`] && (
                            <p className="text-xs text-red-500 mt-1">{errors[`ingredient_${index}_quantity`]}</p>
                          )}
                        </TableCell>
                        <TableCell>{ingredient.unitName}</TableCell>
                        <TableCell>
                          {(() => {
                            const unit = ingredient.unitName?.toLowerCase() || '';
                            const quantity = ingredient.quantity || 0;
                            
                            if (unit.includes('ml') || unit.includes('milliliter')) {
                              // Convert ml to drops (20 drops per 1ml)
                              const drops = (quantity * 20).toFixed(1);
                              return `${drops} drops`;
                            } else if (unit.includes('drop')) {
                              // Convert drops to ml (1 drop = 1/20 ml = 0.05ml)
                              const ml = (quantity / 20).toFixed(2);
                              return `${ml} ml`;
                            } else if (unit.includes('mg') || unit.includes('milligram')) {
                              // Convert mg to ml first: mg ÷ 1000 = ml
                              // Then ml to drops: ml × 20 = drops
                              // Combined: (mg ÷ 1000) × 20 = mg ÷ 50
                              const drops = (quantity / 50).toFixed(1);
                              return `${drops} drops`;
                            } else {
                              return '-';
                            }
                          })()
                        }
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            ${((ingredient.quantity || 0) * (ingredient.sellingPricePerUnit || 0)).toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={ingredient.availableStock && ingredient.availableStock > 0 ? 'default' : 'secondary'}
                            className={ingredient.availableStock && ingredient.availableStock <= 0 ? 'bg-yellow-100 text-yellow-800' : ''}
                          >
                            {ingredient.availableStock || 0}
                            {ingredient.availableStock && ingredient.availableStock <= 0 && (
                              <span className="ml-1 text-xs">⚠</span>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeIngredient(index)}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <FaTrash className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                  <FaClipboardList className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No ingredients added yet</h3>
                  <p className="text-gray-500 mb-4">Start building your custom blend by adding ingredients</p>
                  <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
                    <DialogTrigger asChild>
                      <Button type="button" className="bg-green-600 hover:bg-green-700">
                        <FaPlus className="mr-2 h-4 w-4" />
                        Add Your First Ingredient
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>Select Product as Ingredient</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="relative">
                          <FaSearch className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search products..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <div className="border rounded-lg">
                          <div className="bg-white border-b sticky top-0 z-10">
                            <div className="grid grid-cols-5 gap-4 p-3 font-medium text-sm">
                              <div>Name</div>
                              <div>Category</div>
                              <div>Stock</div>
                              <div>Price</div>
                              <div>Action</div>
                            </div>
                          </div>
                          <div className="max-h-96 overflow-y-auto">
                            <div className="divide-y">
                              {filteredProducts.map(product => (
                                <div key={product._id} className="grid grid-cols-5 gap-4 p-3 items-center hover:bg-gray-50">
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-sm text-gray-600">{product.category?.name || 'N/A'}</div>
                                  <div className="text-sm">
                                    <Badge variant={product.currentStock && product.currentStock > 0 ? 'default' : 'destructive'}>
                                      {product.currentStock || 0}
                                    </Badge>
                                  </div>
                                  <div className="text-sm">${product.sellingPrice?.toFixed(2) || '0.00'}</div>
                                  <div>
                                    <Button
                                      size="sm"
                                      onClick={() => addIngredient(product)}
                                      disabled={ingredients.some(ing => ing.productId === product._id)}
                                    >
                                      {ingredients.some(ing => ing.productId === product._id) ? 'Added' : 'Add'}
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
              
              {/* Selling Price Display */}
              {ingredients.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium text-sm text-gray-700">Total Ingredient Price</h4>
                      <p className="text-xs text-gray-500">Sum of all ingredient prices</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">S${totalIngredientPrice.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validation Results - Show as warning, not error */}
          {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
            <Alert variant="default" className="border-yellow-500 bg-yellow-50">
              <FaExclamationTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <div className="text-yellow-800">
                  {validation.errors.length > 0 && (
                    <div>
                      <p className="font-medium">Stock Notice:</p>
                      <ul className="mt-1 text-sm">
                        {validation.errors.map((error, index) => (
                          <li key={index}>
                            • {error.ingredientName}: {error.error === 'Insufficient stock'
                              ? `Out of stock (Available: ${error.availableQuantity}, Required: ${error.requiredQuantity}) - Sale will proceed with negative stock`
                              : error.error}
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm mt-2 font-medium">✓ Transaction will proceed - inventory can be reconciled later</p>
                    </div>
                  )}
                  {validation.warnings.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">Warnings:</p>
                      <ul className="text-sm">
                        {validation.warnings.map((warning, index) => (
                          <li key={index}>
                            • {warning.ingredientName}: {warning.warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Pricing Configuration */}
          {ingredients.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FaCalculator className="h-5 w-5" />
                  Blend Pricing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  {/* Pricing Mode Toggle */}
                  <div className="mb-4">
                    <Label>Pricing Method</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Button
                        type="button"
                        variant={pricingMode === 'margin' ? 'default' : 'outline'}
                        onClick={() => setPricingMode('margin')}
                        className="w-full"
                      >
                        Margin-Based
                      </Button>
                      <Button
                        type="button"
                        variant={pricingMode === 'manual' ? 'default' : 'outline'}
                        onClick={() => setPricingMode('manual')}
                        className="w-full"
                      >
                        Manual Price
                      </Button>
                    </div>
                  </div>

                  {/* Margin-Based Pricing */}
                  {pricingMode === 'margin' && pricingSuggestion && (
                    <>
                      <h4 className="font-medium mb-2">Margin-Based Configuration</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Base Cost (Ingredients):</span>
                          <span>${totalIngredientPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Margin ({marginPercent}%):</span>
                          <span>${(totalIngredientPrice * marginPercent / 100).toFixed(2)}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between">
                          <span>Calculated Price:</span>
                          <span className="text-lg font-semibold text-green-600">${pricingSuggestion.suggestedPrice.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <Label htmlFor="marginPercent">Profit Margin %</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            id="marginPercent"
                            type="number"
                            min="0"
                            value={marginPercent}
                            onChange={(e) => {
                              const newMargin = parseInt(e.target.value) || 0;
                              setMarginPercent(newMargin);
                            }}
                            className="w-24"
                          />
                          <span className="text-sm text-gray-500">Adjust to change selling price</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Manual Pricing */}
                  {pricingMode === 'manual' && (
                    <>
                      <h4 className="font-medium mb-2">Manual Price Configuration</h4>
                      <div className="space-y-1 text-sm mb-4">
                        <div className="flex justify-between">
                          <span>Base Cost (Ingredients):</span>
                          <span>${totalIngredientPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Profit:</span>
                          <span className={parseFloat(manualPrice) > totalIngredientPrice ? 'text-green-600' : 'text-red-600'}>
                            ${((parseFloat(manualPrice) || 0) - totalIngredientPrice).toFixed(2)}
                            {manualPrice && ` (${(((parseFloat(manualPrice) - totalIngredientPrice) / totalIngredientPrice) * 100).toFixed(0)}%)`}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <Label htmlFor="manualPrice">Set Custom Price</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <Input
                              id="manualPrice"
                              type="number"
                              step="0.01"
                              min="0"
                              value={manualPrice}
                              onChange={(e) => {
                                setIsUpdatingPrice(true);
                                setManualPrice(e.target.value);
                                
                                // Calculate and update margin percentage based on manual price
                                const newPrice = parseFloat(e.target.value) || 0;
                                if (newPrice > 0 && totalIngredientPrice > 0) {
                                  const newMargin = Math.round(((newPrice - totalIngredientPrice) / totalIngredientPrice) * 100);
                                  setMarginPercent(Math.max(0, newMargin));
                                }
                                
                                setTimeout(() => setIsUpdatingPrice(false), 100);
                              }}
                              placeholder="0.00"
                              className="pl-8 w-32"
                            />
                          </div>
                          <span className="text-sm text-gray-500">
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Final Price Display */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Final Selling Price:</span>
                      <span className="text-xl font-bold text-green-600">
                        ${pricingMode === 'manual' 
                          ? (parseFloat(manualPrice) || 0).toFixed(2)
                          : (pricingSuggestion?.suggestedPrice || 0).toFixed(2)
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Form Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose}>
              <FaTimes className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={handleCreateCustomBlend}
              disabled={parentLoading}
            >
              {parentLoading ? (
                <ImSpinner8 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FaCheck className="mr-2 h-4 w-4" />
              )}
              {editingBlend ? 'Update' : 'Add'} Custom Blend{editingBlend ? '' : ' to Transaction'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}