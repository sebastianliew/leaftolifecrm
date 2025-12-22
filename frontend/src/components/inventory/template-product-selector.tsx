'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package } from 'lucide-react';
import { ProductTemplate } from '@/types/inventory';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

interface TemplateProductSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: ProductTemplate) => void;
  products: ProductTemplate[];
  isLoading: boolean;
}

export function TemplateProductSelector({
  isOpen,
  onClose,
  onSelectProduct,
  products,
  isLoading,
}: TemplateProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<ProductTemplate[]>([]);

  useEffect(() => {
    const filtered = products.filter((product) => {
      if (!product || !product.name) return false;
      
      const query = searchQuery.toLowerCase();
      return (
        product.name.toLowerCase().includes(query) ||
        (product.sku?.toLowerCase().includes(query) ?? false) ||
        (product.category?.name?.toLowerCase().includes(query) ?? false) ||
        (product.brand?.name?.toLowerCase().includes(query) ?? false)
      );
    });
    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Select Product to Restock</DialogTitle>
          <DialogDescription>
            Search and select a product from your inventory to add more stock
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name, SKU, category, or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="h-[400px] max-h-[60vh] border rounded-md overflow-y-auto overflow-x-hidden bg-background">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Loading products...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <Package className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No products found matching your search' : 'No products available'}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-2 w-full overflow-hidden">
                {filteredProducts.map((product) => {
                  if (!product || !product._id || !product.name) return null;
                  
                  return (
                    <div key={product._id} className="w-full overflow-hidden">
                      <Button
                        variant="outline"
                        className="w-full p-3 h-auto justify-start hover:bg-accent transition-colors text-left"
                        onClick={() => onSelectProduct(product)}
                      >
                        <div className="flex items-start justify-between w-full gap-2">
                          <div className="flex-1 min-w-0 space-y-1">
                            <h4 className="font-semibold truncate pr-2">{product.name}</h4>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                              {product.sku && (
                                <span className="truncate" style={{ maxWidth: '120px' }}>SKU: {product.sku}</span>
                              )}
                              {product.sku && product.category?.name && <span className="text-muted-foreground">•</span>}
                              {product.category?.name && (
                                <span className="truncate" style={{ maxWidth: '120px' }}>{product.category.name}</span>
                              )}
                              {product.category?.name && product.brand?.name && <span className="text-muted-foreground">•</span>}
                              {product.brand?.name && (
                                <span className="truncate" style={{ maxWidth: '120px' }}>{product.brand.name}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                              <span className="flex-shrink-0">
                                Stock: <span className="font-medium">{product.currentStock || 0}</span>
                                {product.unitOfMeasurement?.abbreviation && ` ${product.unitOfMeasurement.abbreviation}`}
                              </span>
                              <span className="flex-shrink-0">
                                Price: <span className="font-medium">{formatCurrency(product.sellingPrice || 0)}</span>
                              </span>
                            </div>
                          </div>
                          <Badge 
                            variant={(product.currentStock || 0) > 0 ? 'default' : 'destructive'}
                            className="flex-shrink-0"
                          >
                            {(product.currentStock || 0) > 0 ? 'In Stock' : 'Out of Stock'}
                          </Badge>
                        </div>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}