'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProductTemplate, StockAdditionData } from '@/types/inventory';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';

interface StockAdditionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: StockAdditionData) => void;
  selectedProduct: ProductTemplate | null;
  isSubmitting: boolean;
}

export function StockAdditionForm({
  isOpen,
  onClose,
  onSubmit,
  selectedProduct,
  isSubmitting,
}: StockAdditionFormProps) {
  const [quantity, setQuantity] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ quantity?: string }>({});

  // Helper function to determine display unit - use category for container-based products
  const getDisplayUnit = (product: ProductTemplate) => {
    // Check if category name contains "bottle" or other container types (case insensitive)
    const categoryName = product.category.name.toLowerCase();
    if (categoryName.includes('bottle') || 
        categoryName.includes('pack') || 
        categoryName.includes('container') ||
        categoryName.includes('jar') ||
        categoryName.includes('tube') ||
        categoryName.includes('box')) {
      return product.category.name;
    }
    // For volume/weight based products, use unit of measurement
    return product.unitOfMeasurement.abbreviation;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: { quantity?: string } = {};
    const quantityNum = Number(quantity);
    
    if (!quantity || quantityNum <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    if (selectedProduct) {
      onSubmit({
        productId: selectedProduct._id,
        quantity: quantityNum,
        batchNumber: batchNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    }
  };

  const handleClose = () => {
    setQuantity('');
    setBatchNumber('');
    setNotes('');
    setErrors({});
    onClose();
  };

  if (!selectedProduct) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Stock</DialogTitle>
            <DialogDescription>
              Add stock to the selected product
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold">{selectedProduct.name}</h4>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-center gap-4">
                  <span>SKU: {selectedProduct.sku}</span>
                  <Badge variant="outline">{selectedProduct.category.name}</Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span>Current Stock: <span className="font-medium">{selectedProduct.currentStock} {getDisplayUnit(selectedProduct)}</span></span>
                  <span>Price: <span className="font-medium">{formatCurrency(selectedProduct.sellingPrice)}</span></span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">
                Quantity to Add <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setErrors({});
                  }}
                  placeholder="Enter quantity"
                  className={errors.quantity ? 'border-destructive' : ''}
                  min="0"
                  step="0.01"
                />
                <span className="text-sm text-muted-foreground">
                  {getDisplayUnit(selectedProduct)}
                </span>
              </div>
              {errors.quantity && (
                <p className="text-sm text-destructive">{errors.quantity}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="batchNumber">Batch/Lot Number (Optional)</Label>
              <Input
                id="batchNumber"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="Enter batch or lot number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes about this stock addition"
                rows={3}
              />
            </div>

            {selectedProduct.currentStock > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  After adding, total stock will be:{' '}
                  <span className="font-semibold">
                    {selectedProduct.currentStock + (Number(quantity) || 0)} {getDisplayUnit(selectedProduct)}
                  </span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding Stock...' : 'Add Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}