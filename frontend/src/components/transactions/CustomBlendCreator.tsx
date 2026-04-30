"use client"

import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditorialButton, EditorialModal, EditorialModalFooter } from "@/components/ui/editorial";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FaPlus, FaTrash, FaSearch, FaCheck, FaTimes, FaExclamationTriangle, FaCalculator, FaClipboardList } from 'react-icons/fa';
import { ImSpinner8 } from 'react-icons/im';
import type { Product } from '@/types/inventory';
import type { UnitOfMeasurement } from '@/types/inventory';
import type { 
  BlendIngredient,
  ValidationResult,
  CustomBlendData
} from '@/types/blend';

import type { TransactionItem } from '@/types/transaction';
import { useBlendTemplates } from '@/hooks/useBlendTemplates';
import { useToast } from '@/hooks/use-toast';

import type { CustomBlendHistoryItem, BlendHistoryIngredient } from './BlendHistorySelector';
import { usePermissions } from '@/hooks/usePermissions';
import { perUnitCost, perUnitSellingPrice } from '@/lib/pricing';


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
  const isSuperAdmin = user?.role === 'super_admin';

  const [blendName, setBlendName] = useState('');
  const [preparationNotes, setPreparationNotes] = useState('');
  const [ingredients, setIngredients] = useState<(BlendIngredient & { sellingPricePerUnit?: number })[]>([]);
  // Default pricing mode for NEW blends is 'sellingSum' (Σ ingredient selling
  // prices) — matches how clinic staff price ad-hoc blends and avoids the
  // 2026-04-28 incident where margin=0 silently saved at cost.
  const [pricingMode, setPricingMode] = useState<'manual' | 'sellingSum'>('sellingSum');
  const [manualPrice, setManualPrice] = useState<string>('');
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

          const storedSell = (ingredient as { sellingPricePerUnit?: number }).sellingPricePerUnit;
          const unitCost = currentProduct ? (perUnitCost(currentProduct) ?? ingredient.costPerUnit ?? 0) : (ingredient.costPerUnit ?? 0);
          const unitSell = currentProduct
            ? (perUnitSellingPrice(currentProduct) ?? storedSell ?? 0)
            : (storedSell ?? 0);
          return {
            productId: ingredient.productId,
            name: ingredient.name,
            quantity: ingredient.quantity,
            unitOfMeasurementId: ingredient.unitOfMeasurementId,
            unitName: ingredient.unitName,
            costPerUnit: unitCost,
            availableStock: currentProduct?.currentStock || 0,
            sellingPricePerUnit: unitSell,
            notes: ''
          };
        }));

        const oldUnitPrice = editingBlend.unitPrice || 0;

        // Editing an existing blend keeps the saved price as-is via manual mode
        // — the new sellingSum default is for *new* blends only.
        setPricingMode('manual');
        setManualPrice(oldUnitPrice ? oldUnitPrice.toFixed(2) : '');
        
        setIsLoadingEditData(false);
      }, 300); // Small delay to show loading state
    } else if (!editingBlend) {
      // Reset for new blend only if not editing
      setBlendName('');
      setPreparationNotes('');
      setIngredients([]);
      setManualPrice('');
      setPricingMode('sellingSum');
      setIsLoadingEditData(false);
    } else if (editingBlend) {
      // Fallback: populate with basic item data if customBlendData is missing
      setBlendName(editingBlend.name || 'Custom Blend')
      setManualPrice(editingBlend.unitPrice ? editingBlend.unitPrice.toFixed(2) : '')
      setPricingMode('manual')
      setIngredients([]) // We can't restore ingredients without customBlendData
      setPreparationNotes('Note: Original blend data not available for editing')
      setIsLoadingEditData(false)
    }

    // Mark as initialized after setting up the form
    hasInitializedRef.current = true;
  }, [open, editingBlend, products]);

  const [showProductDialog, setShowProductDialog] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [_validating, setValidating] = useState(false);

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

  // Sum of ingredient selling prices = the default suggested blend price.
  // Recomputed inline so it tracks ingredient edits in sellingSum mode without
  // depending on the table-display memo declared further down.
  const sellingPriceSum = ingredients.reduce(
    (total, ing) => total + (ing.quantity * (ing.sellingPricePerUnit || 0)), 0
  );

  const _resetForm = () => {
    setBlendName('');
    setPreparationNotes('');
    setIngredients([]);
    setPricingMode('sellingSum');
    setManualPrice('');
    setValidation(null);
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
    let costPerUnit = perUnitCost(product) ?? 0;
    let defaultQuantity = 1;
    let availableStock = product.currentStock || 0;

    // For liquid products, the cost price should already be per-ml
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
        // Per-ml cost derived via shared pricing utility.
        costPerUnit = perUnitCost(product) ?? 0;
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

    // Final fallback: product has a plain-string `unitName` field independent of the UOM ref.
    if (!unitName && product.unitName) {
      unitName = product.unitName;
    }

    // Per-base-unit selling price via shared pricing utility.
    const sellingPricePerUnit = perUnitSellingPrice(product) ?? 0;

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

    // Real-time blend cost: sum of (quantity × ingredient cost price).
    const calculatedTotalPrice = ingredients.reduce((total, ingredient) =>
      total + (ingredient.quantity * (ingredient.costPerUnit || 0)), 0
    );

    const calculatedSellingPrice = pricingMode === 'manual'
      ? (parseFloat(manualPrice) || 0)
      : sellingPriceSum;

    // Guard: confirm before saving below ingredient cost. Catches the staff
    // mistake of leaving margin at 0% and saving at cost (the 2026-04-28
    // "herb dampness $12 vs $31.25" incident).
    if (isSuperAdmin && calculatedSellingPrice > 0 && calculatedSellingPrice < calculatedTotalPrice) {
      const confirmed = window.confirm(
        `Final price ($${calculatedSellingPrice.toFixed(2)}) is below the ingredient cost ($${calculatedTotalPrice.toFixed(2)}).\n\n` +
        `Sum of ingredient selling prices is $${sellingPriceSum.toFixed(2)}.\n\n` +
        `Save this blend below cost anyway?`
      );
      if (!confirmed) return;
    }
    
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
        costPerUnit: Number((ing.costPerUnit ?? 0).toFixed(4)),
        sellingPricePerUnit: Number((ing.sellingPricePerUnit ?? 0).toFixed(4))
      })),
      totalIngredientCost: calculatedTotalPrice,
      preparationNotes,
      mixedBy: user?.name || user?.email || 'unknown',
      mixedAt: now,
      marginPercent: calculatedTotalPrice > 0
        ? Math.round(((calculatedSellingPrice - calculatedTotalPrice) / calculatedTotalPrice) * 100)
        : 0,
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
        const match = ingredients.find(i => i.unitName);
        const id = match?.unitOfMeasurementId;
        if (typeof id === 'object' && id !== null) {
          return id._id || id.id || '';
        }
        return id || '';
      })(),
      baseUnit: ingredients.find(i => i.unitName)?.unitName || 'blend',
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
          costPerUnit: ingredient.costPerUnit || 0,
          sellingPricePerUnit: (ingredient as { sellingPricePerUnit?: number }).sellingPricePerUnit || 0
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

  // Alias for clarity in JSX — sellingPriceSum was declared earlier next to
  // the cost-calc effect so it's available there too.
  const totalIngredientPrice = sellingPriceSum;

  // Cost basis used for profit display and below-cost guard.
  const totalIngredientCost = ingredients.reduce((total, ingredient) =>
    total + (ingredient.quantity * (ingredient.costPerUnit || 0)), 0
  );

  return (
    <EditorialModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      kicker="Custom blend"
      title={editingBlend ? 'Edit custom blend' : 'Create custom blend'}
      description="Compose a one-off blend from the available ingredients."
      size="2xl"
    >

        <div className="space-y-0">
          {/* Basic Information */}
          <section className="border-b border-[#E5E7EB] pb-8">
            <p className="text-[10px] uppercase tracking-[0.32em] text-[#6B7280]">Blend information</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-5">
              <div>
                <Label htmlFor="blendName" className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Blend Name *</Label>
                <Input
                  id="blendName"
                  value={blendName}
                  onChange={(e) => setBlendName(e.target.value)}
                  placeholder="e.g., Custom Pain Relief Mix"
                  className={`rounded-none border-0 border-b px-0 focus-visible:ring-0 ${errors.blendName ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                />
                {errors.blendName && <p className="text-sm text-red-500 mt-1">{errors.blendName}</p>}
              </div>
            </div>

            <div className="mt-6">
              <Label htmlFor="preparationNotes" className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Preparation Notes</Label>
              <Textarea
                id="preparationNotes"
                value={preparationNotes}
                onChange={(e) => setPreparationNotes(e.target.value)}
                placeholder="Special mixing instructions, storage notes, etc."
                rows={3}
                className="rounded-none border-0 border-b border-[#E5E7EB] px-0 focus-visible:ring-0 resize-none"
              />
            </div>
          </section>

          {/* Ingredients */}
          <section className="border-b border-[#E5E7EB] py-8">
              <div className="flex justify-between items-center gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-[#6B7280]">Recipe ingredients</p>
                  <p className="text-sm text-[#6B7280] mt-2">Add products and set the amount used in this custom blend.</p>
                </div>
                <EditorialButton type="button" variant="primary" icon={<FaPlus className="h-3.5 w-3.5" />} onClick={() => setShowProductDialog(true)}>
                  Add Ingredient
                </EditorialButton>
                <EditorialModal
                  open={showProductDialog}
                  onOpenChange={setShowProductDialog}
                  kicker="Blend"
                  title="Add ingredient"
                  description="Pick a product to add as a recipe ingredient."
                  size="xl"
                >
                      <div className="space-y-5">
                        <div className="relative">
                          <FaSearch className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                          <Input
                            placeholder="Search products..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="rounded-none border-0 border-b border-[#E5E7EB] pl-7 focus-visible:ring-0"
                          />
                        </div>
                      <div className="border-t border-[#E5E7EB]">
                        {/* Fixed Header */}
                        <div className="bg-white border-b sticky top-0 z-10">
                          <div className="grid grid-cols-5 gap-4 py-3 text-[10px] uppercase tracking-[0.24em] text-[#6B7280]">
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
                              <div key={product._id} className="grid grid-cols-5 gap-4 py-3 items-center hover:bg-[#F9FAFB]">
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
                                    className="rounded-none"
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
                </EditorialModal>
              </div>
              {errors.ingredients && (
                <Alert className="mb-4" variant="destructive">
                  <AlertDescription>{errors.ingredients}</AlertDescription>
                </Alert>
              )}

              {ingredients.length > 0 ? (
                <div className="mt-6 border-t border-[#E5E7EB]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280] font-normal">Ingredient</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280] font-normal">Volume</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280] font-normal">Unit</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280] font-normal">Converted</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280] font-normal">Selling Price</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280] font-normal">Stock</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280] font-normal w-20">Action</TableHead>
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
                            className={`w-24 rounded-none border-0 border-b px-0 focus-visible:ring-0 ${errors[`ingredient_${index}_quantity`] ? 'border-red-500' : 'border-[#E5E7EB]'}`}
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
                            size="sm"
                            onClick={() => removeIngredient(index)}
                            className="rounded-none border border-red-200 bg-white text-red-600 hover:bg-red-50"
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
                <div className="mt-6 text-center py-12 border-y border-dashed border-[#E5E7EB]">
                  <FaClipboardList className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No ingredients added yet</h3>
                  <p className="text-gray-500 mb-4">Start building your custom blend by adding ingredients</p>
                  <EditorialButton type="button" variant="primary" icon={<FaPlus className="h-3.5 w-3.5" />} onClick={() => setShowProductDialog(true)}>
                    Add Your First Ingredient
                  </EditorialButton>
                  <EditorialModal
                    open={showProductDialog}
                    onOpenChange={setShowProductDialog}
                    kicker="Blend"
                    title="Add ingredient"
                    description="Pick a product to add as a recipe ingredient."
                    size="xl"
                  >
                      <div className="space-y-4">
                        <div className="relative">
                          <FaSearch className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
                          <Input
                            placeholder="Search products..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="rounded-none border-0 border-b border-[#E5E7EB] pl-7 focus-visible:ring-0"
                          />
                        </div>
                        <div className="border-t border-[#E5E7EB]">
                          <div className="bg-white border-b sticky top-0 z-10">
                            <div className="grid grid-cols-5 gap-4 py-3 text-[10px] uppercase tracking-[0.24em] text-[#6B7280]">
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
                                <div key={product._id} className="grid grid-cols-5 gap-4 py-3 items-center hover:bg-[#F9FAFB]">
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
                                      className="rounded-none"
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
                  </EditorialModal>
                </div>
              )}
              
              {/* Reference: Σ of ingredient selling prices.
                  Not the saved blend price — the active "Pricing Method" below
                  determines what gets saved. Used as the default when
                  pricing mode is "Sum of Selling Prices". */}
              {ingredients.length > 0 && (
                <div className="mt-6 pt-5 border-t border-[#E5E7EB]">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium text-sm text-gray-700">Σ Ingredient Selling Prices (reference)</h4>
                      <p className="text-xs text-gray-500">Σ (qty × per-unit selling price). Sets the default in &ldquo;Sum of Selling Prices&rdquo; mode.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">S${totalIngredientPrice.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}
          </section>

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
            <section className="border-b border-[#E5E7EB] py-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FaCalculator className="h-4 w-4 text-[#0F172A]" />
                    <p className="text-[10px] uppercase tracking-[0.32em] text-[#6B7280]">Blend pricing</p>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">
                    Choose the price that will be saved to the transaction and printed on the invoice.
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Final selling price</p>
                  <p className="mt-1 text-4xl font-light leading-none text-[#16A34A] tabular-nums">
                    ${pricingMode === 'manual'
                      ? (parseFloat(manualPrice) || 0).toFixed(2)
                      : sellingPriceSum.toFixed(2)
                    }
                  </p>
                  {(() => {
                    const finalSellingPrice = pricingMode === 'manual'
                      ? (parseFloat(manualPrice) || 0)
                      : sellingPriceSum;
                    if (isSuperAdmin && finalSellingPrice > 0 && finalSellingPrice < totalIngredientCost) {
                      return (
                        <p className="mt-2 text-sm font-medium text-red-600">
                          Below ingredient cost (${totalIngredientCost.toFixed(2)}). You will be asked to confirm on save.
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              <div className="mt-8">
                <Label className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Pricing Method</Label>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <EditorialButton
                    type="button"
                    variant={pricingMode === 'sellingSum' ? 'ghost-active' : 'ghost'}
                    onClick={() => setPricingMode('sellingSum')}
                    className="justify-center"
                  >
                    Sum of Selling Prices
                  </EditorialButton>
                  <EditorialButton
                    type="button"
                    variant={pricingMode === 'manual' ? 'ghost-active' : 'ghost'}
                    onClick={() => {
                      setPricingMode('manual');
                      if (!manualPrice) {
                        setManualPrice(sellingPriceSum.toFixed(2));
                      }
                    }}
                    className="justify-center"
                  >
                    Manual Price
                  </EditorialButton>
                </div>
              </div>

              {pricingMode === 'sellingSum' && (
                <div className="mt-6 border-t border-[#E5E7EB] pt-5">
                  <p className="text-sm font-medium text-[#111827]">Sum of Ingredient Selling Prices</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-[#6B7280]">Qty x per-unit selling price</span>
                      <span className="font-medium tabular-nums">${sellingPriceSum.toFixed(2)}</span>
                    </div>
                    {isSuperAdmin && (
                      <div className="flex justify-between gap-4">
                        <span className="text-[#6B7280]">Base cost</span>
                        <span className="tabular-nums">${totalIngredientCost.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {pricingMode === 'manual' && (
                <div className="mt-6 border-t border-[#E5E7EB] pt-5">
                  <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
                    <div>
                      <p className="text-sm font-medium text-[#111827]">Manual Price Configuration</p>
                      <div className="mt-3 space-y-2 text-sm">
                        {isSuperAdmin && (
                          <>
                            <div className="flex justify-between gap-4">
                              <span className="text-[#6B7280]">Base cost</span>
                              <span className="tabular-nums">${totalIngredientCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-[#6B7280]">Profit</span>
                              <span className={`tabular-nums ${(parseFloat(manualPrice) || 0) > totalIngredientCost ? 'text-green-600' : 'text-red-600'}`}>
                                ${((parseFloat(manualPrice) || 0) - totalIngredientCost).toFixed(2)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="manualPrice" className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Set Custom Price</Label>
                      <div className="relative mt-2">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">$</span>
                        <Input
                          id="manualPrice"
                          type="number"
                          step="0.01"
                          min="0"
                          value={manualPrice}
                          onChange={(e) => {
                            setManualPrice(e.target.value);
                          }}
                          placeholder="0.00"
                          className="w-36 rounded-none border-0 border-b border-[#E5E7EB] pl-5 pr-0 text-right focus-visible:ring-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Form Actions */}
          <EditorialModalFooter className="justify-between">
            <EditorialButton type="button" variant="ghost" icon={<FaTimes className="h-3.5 w-3.5" />} onClick={onClose}>
              Cancel
            </EditorialButton>
            <EditorialButton
              type="button"
              variant="primary"
              onClick={handleCreateCustomBlend}
              disabled={parentLoading}
              icon={parentLoading ? <ImSpinner8 className="h-3.5 w-3.5 animate-spin" /> : <FaCheck className="h-3.5 w-3.5" />}
            >
              {editingBlend ? 'Update' : 'Add'} Custom Blend{editingBlend ? '' : ' to Transaction'}
            </EditorialButton>
          </EditorialModalFooter>
        </div>
    </EditorialModal>
  );
}
