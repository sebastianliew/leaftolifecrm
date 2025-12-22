'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Package, Plus } from 'lucide-react';
import { ProductAdditionMethod } from '@/types/inventory';

interface ProductAddMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMethod: (method: ProductAdditionMethod) => void;
}

export function ProductAddMethodModal({
  isOpen,
  onClose,
  onSelectMethod,
}: ProductAddMethodModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl">Add Product to Inventory</DialogTitle>
          <DialogDescription className="text-base">
            Choose how you want to add products to your inventory
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-6">
          <Button
            variant="outline"
            className="h-auto p-6 justify-start hover:bg-accent transition-colors"
            onClick={() => onSelectMethod('template')}
          >
            <div className="flex items-start gap-4 w-full">
              <Package className="h-8 w-8 mt-1 text-primary flex-shrink-0" />
              <div className="text-left flex-1">
                <h3 className="font-semibold text-base mb-1">Add Stock to Existing Product</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Select a product from your inventory and add more stock
                </p>
              </div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto p-6 justify-start hover:bg-accent transition-colors"
            onClick={() => onSelectMethod('new')}
          >
            <div className="flex items-start gap-4 w-full">
              <Plus className="h-8 w-8 mt-1 text-primary flex-shrink-0" />
              <div className="text-left flex-1">
                <h3 className="font-semibold text-base mb-1">Create New Product</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Add a completely new product to your inventory
                </p>
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}