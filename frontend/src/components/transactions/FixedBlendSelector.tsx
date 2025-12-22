"use client"

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FaSearch, FaFlask, FaCheck, FaTimes } from 'react-icons/fa';
import { ImSpinner8 } from 'react-icons/im';
import type { BlendTemplate } from '@/types/blend';
import type { TransactionItem } from '@/types/transaction';
import { useBlendTemplates } from '@/hooks/useBlendTemplates';

interface FixedBlendSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectBlend: (blendItem: TransactionItem) => void;
  onUpdateBlend?: (updatedBlend: TransactionItem) => void;
  editingBlend?: TransactionItem;
  loading?: boolean;
}

export function FixedBlendSelector({
  open,
  onClose,
  onSelectBlend,
  onUpdateBlend,
  editingBlend,
  loading: parentLoading
}: FixedBlendSelectorProps) {
  const { 
    templates, 
    loading, 
    error, 
    getTemplates
  } = useBlendTemplates();

  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<BlendTemplate | null>(null);
  const [quantity, setQuantity] = useState(1);

  const isEditing = !!editingBlend;

  const loadData = useCallback(async () => {
    try {
      await getTemplates({ isActive: true });
    } catch (error) {
      console.error('Failed to load blend templates:', error);
    }
  }, [getTemplates]);

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  // Initialize editing mode
  useEffect(() => {
    if (editingBlend && templates.length > 0) {
      // Find the template for the editing blend
      const template = templates.find(t => t._id === editingBlend.blendTemplateId);
      if (template) {
        setSelectedTemplate(template);
        setQuantity(editingBlend.quantity);
      }
    } else if (!editingBlend) {
      // Clear when not editing
      setSelectedTemplate(null);
      setQuantity(1);
    }
  }, [editingBlend, templates]);


  // Filter templates based on search only
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !search || 
      template.name.toLowerCase().includes(search.toLowerCase()) ||
      template.description?.toLowerCase().includes(search.toLowerCase());
    
    return template.isActive && matchesSearch;
  });

  // Handle template selection
  const handleTemplateSelect = (template: BlendTemplate) => {
    setSelectedTemplate(template);
  };


  // Handle blend confirmation
  const handleConfirmBlend = () => {
    if (!selectedTemplate) return;

    // Use selling price from template
    const unitPrice = selectedTemplate.sellingPrice || 0;
    const totalPrice = unitPrice * quantity;

    // Use batchSize if available, fallback to 1 for recipe-only templates
    const batchSize = selectedTemplate.batchSize || 1;

    const blendItem: TransactionItem = {
      id: isEditing ? editingBlend!.id : `blend_${Date.now()}`,
      productId: selectedTemplate._id,
      name: `${selectedTemplate.name} (${quantity}x ${quantity === 1 ? 'unit' : 'units'})`,
      description: selectedTemplate.description,
      quantity: quantity,
      unitPrice: unitPrice,
      totalPrice: totalPrice,
      discountAmount: 0,
      isService: false,
      saleType: 'quantity',
      unitOfMeasurementId: typeof selectedTemplate.unitOfMeasurementId === 'object' && selectedTemplate.unitOfMeasurementId !== null
        ? selectedTemplate.unitOfMeasurementId._id || selectedTemplate.unitOfMeasurementId.id || ''
        : selectedTemplate.unitOfMeasurementId || '',
      baseUnit: selectedTemplate.unitName,
      convertedQuantity: quantity * batchSize,
      itemType: 'fixed_blend',
      blendTemplateId: selectedTemplate._id
    };

    if (isEditing && onUpdateBlend) {
      onUpdateBlend(blendItem);
    } else {
      onSelectBlend(blendItem);
    }
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedTemplate(null);
    setQuantity(1);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FaFlask className="h-5 w-5" />
            {isEditing ? 'Edit Fixed Blend' : 'Select Fixed Blend Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-y-auto">
          {/* Left Column - Blend List */}
          <div className="space-y-4 flex flex-col h-full">
            {/* Simple Search */}
            <div>
              <Label htmlFor="search">Search Templates</Label>
              <div className="relative">
                <FaSearch className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by name or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Templates List */}
            {loading ? (
              <div className="flex justify-center py-8">
                <ImSpinner8 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredTemplates.length > 0 ? (
              <div className="space-y-2 overflow-y-auto flex-1 pr-2 min-h-0">
                {filteredTemplates.map(template => (
                  <Card 
                    key={template._id}
                    className={`cursor-pointer transition-all ${
                      selectedTemplate?._id === template._id 
                        ? 'ring-2 ring-blue-500 bg-blue-50' 
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <CardContent className="p-3">
                      <div className="grid grid-cols-5 gap-2 items-center text-xs">
                        {/* Name */}
                        <div className="col-span-2">
                          <h3 className="font-medium text-sm truncate">{template.name}</h3>
                        </div>
                        
                        {/* Category */}
                        <div className="text-center">
                          {template.category && (
                            <Badge variant="outline" className="text-xs h-4 px-1">
                              {template.category}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Ingredients Count */}
                        <div className="text-center">
                          <span className="text-gray-600">{template.ingredients.length} items</span>
                        </div>
                        
                        {/* Price */}
                        <div className="text-right">
                          <div className="font-semibold text-green-600">
                            S${(template.sellingPrice || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {search ? 'No templates match your search' : 'No active templates found'}
              </div>
            )}
          </div>

          {/* Right Column - Selected Blend Details */}
          <div className="flex flex-col h-full">
            <Card className="flex-1 overflow-hidden flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="text-lg">Blend Details</CardTitle>
              </CardHeader>
              <CardContent className="overflow-y-auto flex-1">
                {selectedTemplate ? (
                  <div className="space-y-4">
                    {/* Template Info */}
                    <div>
                      <h3 className="font-medium text-lg">{selectedTemplate.name}</h3>
                      {selectedTemplate.description && (
                        <p className="text-gray-600 text-sm mt-1">{selectedTemplate.description}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {selectedTemplate.ingredients.length} ingredients
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {selectedTemplate.usageCount}x used
                        </Badge>
                      </div>
                    </div>

                    {/* Ingredients List */}
                    {selectedTemplate.ingredients && selectedTemplate.ingredients.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">Ingredients:</Label>
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                          {selectedTemplate.ingredients.map((ingredient, index) => (
                            <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                              <span>{ingredient.name}</span>
                              <span className="text-gray-600 ml-2">({ingredient.quantity} {ingredient.unitName})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quantity and Price */}
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          max="100"
                          value={quantity}
                          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Price per unit:</span>
                          <span>S${(selectedTemplate.sellingPrice || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Quantity:</span>
                          <span>{quantity}</span>
                        </div>
                        <div className="border-t pt-1 mt-1">
                          <div className="flex justify-between font-medium">
                            <span>Total:</span>
                            <span className="text-lg text-green-600">
                              S${((selectedTemplate.sellingPrice || 0) * quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={handleConfirmBlend}
                      disabled={parentLoading}
                      className="w-full"
                    >
                      {parentLoading ? (
                        <ImSpinner8 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FaCheck className="mr-2 h-4 w-4" />
                      )}
                      {isEditing ? 'Update Blend' : 'Add to Transaction'}
                    </Button>

                    <Button variant="outline" onClick={handleClearSelection} className="w-full">
                      <FaTimes className="mr-2 h-4 w-4" />
                      Clear Selection
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Select a blend template to view details
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end pt-4 flex-shrink-0 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 