"use client"

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/ui/date-input";
// Separator component removed - not used
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FaPlus, FaTimes, FaSearch, FaBox } from "react-icons/fa";
import { ImSpinner8 } from "react-icons/im";
import type { Bundle, BundleFormData, BundleProduct, BundlePricingCalculation } from '@/types/bundle';
import type { Product } from '@/types/inventory';
import type { BlendTemplate } from '@/types/blend';

interface BundleFormProps {
  bundle?: Bundle;
  products: Product[];
  blendTemplates: BlendTemplate[];
  categories: string[];
  onSubmit: (data: BundleFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  canManagePricing?: boolean;
}

export function BundleForm({
  bundle,
  products,
  blendTemplates,
  categories,
  onSubmit,
  onCancel,
  loading = false,
  canManagePricing: _canManagePricing = false
}: BundleFormProps) {
  const [formData, setFormData] = useState<BundleFormData>(() => ({
    name: bundle?.name || '',
    description: bundle?.description || '',
    category: bundle?.category || 'none',
    bundleProducts: bundle?.bundleProducts || [],
    bundlePrice: bundle?.bundlePrice || 0,  // Keep 0 as default for calculations but display will show empty

    isActive: bundle?.isActive ?? true,
    isPromoted: bundle?.isPromoted || false,
    promotionText: bundle?.promotionText || '',
    validFrom: bundle?.validFrom ? (() => {
      try {
        const date = bundle.validFrom instanceof Date ? bundle.validFrom : new Date(bundle.validFrom);
        return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
      } catch {
        return '';
      }
    })() : '',
    validUntil: bundle?.validUntil ? (() => {
      try {
        const date = bundle.validUntil instanceof Date ? bundle.validUntil : new Date(bundle.validUntil);
        return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
      } catch {
        return '';
      }
    })() : '',
    tags: bundle?.tags || [],
    internalNotes: bundle?.internalNotes || ''
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pricingCalculation, setPricingCalculation] = useState<BundlePricingCalculation | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductType, setSelectedProductType] = useState<'product' | 'fixed_blend'>('product');
  const [newTag, setNewTag] = useState('');

  // Update form data when bundle prop changes
  useEffect(() => {
    if (bundle) {
      setFormData({
        name: bundle.name || '',
        description: bundle.description || '',
        category: bundle.category || 'none',
        bundleProducts: bundle.bundleProducts || [],
        bundlePrice: bundle.bundlePrice || 0,
        isActive: bundle.isActive ?? true,
        isPromoted: bundle.isPromoted || false,
        promotionText: bundle.promotionText || '',
        validFrom: bundle.validFrom ? (() => {
          try {
            const date = bundle.validFrom instanceof Date ? bundle.validFrom : new Date(bundle.validFrom);
            return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
          } catch {
            return '';
          }
        })() : '',
        validUntil: bundle.validUntil ? (() => {
          try {
            const date = bundle.validUntil instanceof Date ? bundle.validUntil : new Date(bundle.validUntil);
            return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
          } catch {
            return '';
          }
        })() : '',
        tags: bundle.tags || [],
        internalNotes: bundle.internalNotes || ''
      });
    }
  }, [bundle]);

  const calculatePricing = useCallback(() => {
    const breakdown = formData.bundleProducts.map(product => ({
      productId: product.productId,
      name: product.name,
      quantity: product.quantity,
      individualPrice: product.individualPrice,
      totalPrice: product.quantity * product.individualPrice
    }));

    const individualTotal = breakdown.reduce((sum, item) => sum + item.totalPrice, 0);
    const savings = Math.max(0, individualTotal - formData.bundlePrice);
    const savingsPercentage = individualTotal > 0 ? Math.round((savings / individualTotal) * 100) : 0;

    setPricingCalculation({
      individualTotal,
      bundlePrice: formData.bundlePrice,
      savings,
      savingsPercentage,
      breakdown
    });
  }, [formData.bundleProducts, formData.bundlePrice]);

  // Calculate pricing whenever bundle products or price changes
  useEffect(() => {
    // Always calculate pricing, even with 0 values to show the summary
    calculatePricing();
  }, [formData.bundleProducts, formData.bundlePrice, calculatePricing]);

  const handleInputChange = (field: keyof BundleFormData, value: string | number | boolean | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAddProduct = (product: Product | BlendTemplate, type: 'product' | 'fixed_blend') => {
    // Removed duplicate check - allow adding the same product multiple times
    // This enables flexible bundles like "Buy 3 get 20% off" deals

    // Adding product to bundle
    
    let extractedUnitId = '';
    
    if (type === 'product') {
      const uom = (product as Product).unitOfMeasurement;
      
      if (typeof uom === 'string') {
        extractedUnitId = uom;
      } else if (uom && typeof uom === 'object') {
        // Try multiple ways to extract the ID
        if ('_id' in uom && typeof uom._id === 'string') {
          extractedUnitId = uom._id;
        } else if ('id' in uom && typeof uom.id === 'string') {
          extractedUnitId = uom.id;
        } else {
          // Try to find any string property that looks like an ID
          for (const key of Object.keys(uom)) {
            const value = (uom as unknown as Record<string, unknown>)[key];
            if (typeof value === 'string' && (key === '_id' || key === 'id' || key.includes('id') || key.includes('Id'))) {
              extractedUnitId = value;
              break;
            }
          }
        }
      }
    } else {
      // For blend templates
      const unitId = (product as BlendTemplate).unitOfMeasurementId;
      
      if (typeof unitId === 'string') {
        extractedUnitId = unitId;
      } else if (unitId && typeof unitId === 'object') {
        const objId = unitId as { _id?: string; id?: string };
        extractedUnitId = objId._id || objId.id || '';
      }
    }
    
    
    const bundleProduct: BundleProduct = {
      productId: String(product._id),
      name: product.name,
      quantity: 1,
      productType: type,
      blendTemplateId: type === 'fixed_blend' ? String(product._id) : undefined,
      unitOfMeasurementId: extractedUnitId || undefined, // Set to undefined if empty
      unitName: type === 'product'
        ? (product as Product).unitOfMeasurement?.name || 'unit'
        : (product as BlendTemplate).unitName,
      individualPrice: type === 'product'
        ? (product as Product).sellingPrice || 0
        : (product as BlendTemplate).sellingPrice || 0
    };

    setFormData(prev => ({
      ...prev,
      bundleProducts: [...prev.bundleProducts, bundleProduct]
    }));

    setShowProductDialog(false);
    setProductSearch('');
  };

  const handleRemoveProduct = (index: number) => {
    setFormData(prev => ({
      ...prev,
      bundleProducts: prev.bundleProducts.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateProductQuantity = (index: number, quantity: number) => {
    setFormData(prev => ({
      ...prev,
      bundleProducts: prev.bundleProducts.map((product, i) => 
        i === index ? { ...product, quantity: Math.max(1, quantity) } : product
      )
    }));
  };

  const handleUpdateProductPrice = (index: number, price: number) => {
    setFormData(prev => ({
      ...prev,
      bundleProducts: prev.bundleProducts.map((product, i) => 
        i === index ? { ...product, individualPrice: Math.max(0, price) } : product
      )
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate bundle name
    if (!formData.name || !formData.name.trim()) {
      newErrors.name = 'Bundle name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Bundle name must be at least 3 characters long';
    }

    // Validate bundle products
    if (!formData.bundleProducts || formData.bundleProducts.length < 1) {
      newErrors.bundleProducts = 'Bundle must contain at least 1 product';
    } else {
      // Check if all products have valid data
      const invalidProducts = formData.bundleProducts.filter(product => 
        !product.productId || 
        !product.name || 
        product.quantity <= 0 || 
        product.individualPrice < 0 ||
        !product.unitOfMeasurementId
      );
      
      if (invalidProducts.length > 0) {
        console.log('Invalid products found:', invalidProducts.map(p => ({
          name: p.name || 'MISSING_NAME',
          productId: p.productId || 'MISSING_ID',
          quantity: p.quantity,
          individualPrice: p.individualPrice,
          unitOfMeasurementId: p.unitOfMeasurementId || 'MISSING_UNIT_ID'
        })));
        newErrors.bundleProducts = `${invalidProducts.length} product(s) have invalid data (missing ID, name, quantity, or unit)`;
      }
    }

    // Validate bundle price
    if (!formData.bundlePrice || formData.bundlePrice <= 0) {
      newErrors.bundlePrice = 'Bundle price must be greater than 0';
    } else if (formData.bundlePrice > 999999) {
      newErrors.bundlePrice = 'Bundle price cannot exceed S$999,999';
    }



    // Validate date range
    if (formData.validFrom && formData.validUntil) {
      const fromDate = new Date(formData.validFrom);
      const untilDate = new Date(formData.validUntil);
      
      if (isNaN(fromDate.getTime())) {
        newErrors.validFrom = 'Invalid "Valid From" date';
      }
      
      if (isNaN(untilDate.getTime())) {
        newErrors.validUntil = 'Invalid "Valid Until" date';
      }
      
      if (fromDate >= untilDate) {
        newErrors.validUntil = 'Valid until date must be after valid from date';
      }
      
      // Check if valid from is in the past (warn but don't block)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (fromDate < today) {
        // This is just a warning, not an error
        // Bundle valid from date is in the past - allowed but noted
      }
    }

    // Removed duplicate product check - bundles can now contain duplicate products
    // This allows for flexible bundle configurations like "Buy 3 of the same item" deals

    // Validate description length
    if (formData.description && formData.description.length > 1000) {
      newErrors.description = 'Description cannot exceed 1000 characters';
    }

    // Validate promotion text
    if (formData.isPromoted && formData.promotionText && formData.promotionText.length > 200) {
      newErrors.promotionText = 'Promotion text cannot exceed 200 characters';
    }

    // Validate internal notes
    if (formData.internalNotes && formData.internalNotes.length > 500) {
      newErrors.internalNotes = 'Internal notes cannot exceed 500 characters';
    }

    // Validate tags
    if (formData.tags && formData.tags.length > 20) {
      newErrors.tags = 'Cannot have more than 20 tags';
    }

    // Form validation completed

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Bundle form validation and submission
    
    if (!validateForm()) {
      // Form validation failed - errors are already set in state
      const firstErrorField = Object.keys(errors)[0];
      
      // Scroll to first error
      const errorElement = document.querySelector(`[data-error="${firstErrorField}"]`) || 
                          document.querySelector('.border-red-500');
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      return;
    }

    try {
      // Form validation passed, processing submission
      
      // Process form data before submission
      const processedData = {
        ...formData,
        category: formData.category === 'none' ? undefined : formData.category,
        // Ensure proper data types
        bundlePrice: Number(formData.bundlePrice),
        // Clean up empty fields
        description: formData.description.trim() || '',
        promotionText: formData.promotionText.trim() || '',
        internalNotes: formData.internalNotes.trim() || '',
        // Ensure tags are clean
        tags: formData.tags.filter(tag => tag.trim().length > 0),
        // Clean bundle products - ensure all IDs are strings
        bundleProducts: formData.bundleProducts.map((product) => {
          // Helper function to extract ID from various formats
          const extractId = (value: unknown): string => {
            
            if (!value) {
              return '';
            }
            
            if (typeof value === 'string') {
              return value;
            }
            
            if (typeof value === 'object' && value !== null) {
              const obj = value as Record<string, unknown>;
              
              // Try different ways to get the ID
              let id = '';
              if (obj._id && typeof obj._id === 'string') {
                id = obj._id;
              } else if (obj.id && typeof obj.id === 'string') {
                id = obj.id;
              } else {
                // Last resort - check all properties
                for (const key of Object.keys(obj)) {
                  if ((key === '_id' || key === 'id') && typeof obj[key] === 'string') {
                    id = obj[key];
                    break;
                  }
                }
              }
              
              if (!id) {
                // CRITICAL: Never use String(obj) as it creates "[object Object]"
                // Return empty string instead
                return '';
              }
              
              return id;
            }
            
            return '';
          };
          
          const cleanedProductId = extractId(product.productId);
          const cleanedUnitId = product.unitOfMeasurementId ? extractId(product.unitOfMeasurementId) : '';
          const cleanedBlendId = product.blendTemplateId ? extractId(product.blendTemplateId) : '';
          
          const cleaned = {
            ...product,
            productId: cleanedProductId,
            unitOfMeasurementId: cleanedUnitId || undefined,
            blendTemplateId: cleanedBlendId || undefined
          };
          
          return cleaned;
        })
      };
      
      
      // Submit the processed bundle data
      await onSubmit(processedData);
      // Bundle submission completed successfully
      
    } catch (error: unknown) {
      console.error('❌ Error submitting bundle:', error);
      
      // Enhanced error handling
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
        
        // Handle specific error types
        if (error.message.includes('Validation failed')) {
          setErrors({ general: `Validation Error: ${error.message}` });
        } else if (error.message.includes('Product not found')) {
          setErrors({ 
            bundleProducts: 'One or more selected products no longer exist. Please refresh and try again.',
            general: error.message 
          });
        } else if (error.message.includes('Blend template not found')) {
          setErrors({ 
            bundleProducts: 'One or more selected blend templates no longer exist. Please refresh and try again.',
            general: error.message 
          });
        } else if (error.message.includes('connect') || error.message.includes('network')) {
          setErrors({ general: 'Network connection error. Please check your internet connection and try again.' });
        } else if (error.message.includes('duplicate') || error.message.includes('already exists')) {
          setErrors({ 
            name: 'A bundle with this name may already exist',
            general: error.message 
          });
        } else {
          setErrors({ general: `Error: ${error.message}` });
        }
      } else {
        console.error('Unknown error type:', typeof error, error);
        setErrors({ general: 'An unexpected error occurred. Please try again.' });
      }
      
      // Scroll to error display
      setTimeout(() => {
        const errorElement = document.querySelector('[data-error="general"]');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  // Filter products for selection
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredBlendTemplates = blendTemplates.filter(template =>
    template.name.toLowerCase().includes(productSearch.toLowerCase()) &&
    template.isActive
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FaBox className="w-5 h-5" />
            Bundle Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Bundle Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter bundle name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                                      <SelectItem value="none">No Category</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter bundle description"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bundle Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Bundle Products</span>
            <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
              <DialogTrigger asChild>
                <Button type="button" size="sm">
                  <FaPlus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Product to Bundle</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search products..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={selectedProductType} onValueChange={(value: 'product' | 'fixed_blend') => setSelectedProductType(value)}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product">Single Products</SelectItem>
                        <SelectItem value="fixed_blend">Blend Templates</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-3 max-h-96 overflow-y-auto">
                    {selectedProductType === 'product' ? (
                      filteredProducts.map(product => (
                        <Card key={product._id} className="cursor-pointer hover:shadow-md" onClick={() => handleAddProduct(product, 'product')}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h3 className="font-medium">{product.name}</h3>
                                <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                                <p className="text-sm text-gray-600">Stock: {product.currentStock}</p>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-green-600">
                                  S${product.sellingPrice?.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      filteredBlendTemplates.map(template => (
                        <Card key={template._id} className="cursor-pointer hover:shadow-md" onClick={() => handleAddProduct(template, 'fixed_blend')}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h3 className="font-medium">{template.name}</h3>
                                <p className="text-sm text-gray-600">{template.description}</p>
                                <p className="text-sm text-gray-600">Batch Size: {template.batchSize || 1}</p>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-green-600">
                                  S${template.sellingPrice?.toFixed(2) || '0.00'}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {formData.bundleProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No products added to bundle yet. Click &quot;Add Product&quot; to get started.
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Price per Unit</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.bundleProducts.map((product, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.unitName}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.productType === 'product' ? 'default' : 'secondary'}>
                          {product.productType === 'product' ? 'Product' : 'Blend'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={product.quantity || ''}
                          placeholder="1"
                          onChange={(e) => handleUpdateProductQuantity(index, parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={product.individualPrice || ''}
                          placeholder="0.00"
                          onChange={(e) => handleUpdateProductPrice(index, parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          S${(product.quantity * product.individualPrice).toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveProduct(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <FaTimes className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {errors.bundleProducts && (
                <p className="text-sm text-red-500">{errors.bundleProducts}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bundlePrice">Bundle Price *</Label>
              <Input
                id="bundlePrice"
                type="number"
                min="0"
                step="0.01"
                value={formData.bundlePrice || ''}
                onChange={(e) => handleInputChange('bundlePrice', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className={errors.bundlePrice ? 'border-red-500' : ''}
              />
              {errors.bundlePrice && <p className="text-sm text-red-500">{errors.bundlePrice}</p>}
            </div>


          </div>

          {/* Pricing Calculation Display - Always show */}
          <div className="bg-gray-50 p-4 rounded-md mt-4">
            <h4 className="font-medium mb-3">Pricing Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Individual Total:</span>
                <div className="font-semibold text-gray-800">
                  S${pricingCalculation?.individualTotal?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Bundle Price:</span>
                <div className="font-semibold text-green-600">
                  S${pricingCalculation?.bundlePrice?.toFixed(2) || formData.bundlePrice?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Savings:</span>
                <div className="font-semibold text-red-500">
                  S${pricingCalculation?.savings?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Savings %:</span>
                <div className="font-semibold text-red-500">
                  {pricingCalculation?.savingsPercentage || 0}%
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bundle Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Bundle Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="isActive">Active</Label>
                  <p className="text-sm text-gray-600">Bundle is available for sale</p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="isPromoted">Promoted</Label>
                  <p className="text-sm text-gray-600">Show as promoted bundle</p>
                </div>
                <Switch
                  id="isPromoted"
                  checked={formData.isPromoted}
                  onCheckedChange={(checked) => handleInputChange('isPromoted', checked)}
                />
              </div>

              {formData.isPromoted && (
                <div className="space-y-2">
                  <Label htmlFor="promotionText">Promotion Text</Label>
                  <Input
                    id="promotionText"
                    value={formData.promotionText}
                    onChange={(e) => handleInputChange('promotionText', e.target.value)}
                    placeholder="Enter promotion text"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="validFrom">Valid From</Label>
                <DateInput
                  id="validFrom"
                  value={formData.validFrom ? new Date(formData.validFrom) : undefined}
                  onChange={(date) => handleInputChange('validFrom', date ? date.toISOString().split('T')[0] : '')}
                  placeholder="DD/MM/YYYY"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="validUntil">Valid Until</Label>
                <DateInput
                  id="validUntil"
                  value={formData.validUntil ? new Date(formData.validUntil) : undefined}
                  onChange={(date) => handleInputChange('validUntil', date ? date.toISOString().split('T')[0] : '')}
                  placeholder="DD/MM/YYYY"
                  className={errors.validUntil ? 'border-red-500' : ''}
                />
                {errors.validUntil && <p className="text-sm text-red-500">{errors.validUntil}</p>}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2 flex-wrap mb-2">
              {formData.tags.map(tag => (
                <Badge key={tag} variant="outline" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                  {tag}
                  <FaTimes className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              />
              <Button type="button" onClick={handleAddTag} size="sm">
                <FaPlus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Internal Notes */}
          <div className="space-y-2">
            <Label htmlFor="internalNotes">Internal Notes</Label>
            <Textarea
              id="internalNotes"
              value={formData.internalNotes}
              onChange={(e) => handleInputChange('internalNotes', e.target.value)}
              placeholder="Internal notes (not visible to customers)"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {errors.general && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{errors.general}</p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || formData.bundleProducts.length < 1}>
          {loading ? (
            <>
              <ImSpinner8 className="w-4 h-4 mr-2 animate-spin" />
              {bundle ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            bundle ? 'Update Bundle' : 'Create Bundle'
          )}
        </Button>
      </div>
    </form>
  );
}