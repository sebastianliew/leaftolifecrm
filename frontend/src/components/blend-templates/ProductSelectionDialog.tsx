"use client"

import { useState, memo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FaSearch } from 'react-icons/fa';
import { ImSpinner8 } from 'react-icons/im';
import { useInventoryOptimized } from '@/hooks/useInventoryOptimized';
import type { Product } from '@/types/inventory';

interface ProductSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProduct: (product: Product) => void;
  selectedProducts?: string[];
  products?: Product[]; // Made optional for backward compatibility
  useOptimizedSearch?: boolean;
}

const ProductRow = memo(({ 
  product, 
  onSelect, 
  isSelected 
}: { 
  product: Product; 
  onSelect: () => void; 
  isSelected: boolean;
}) => (
  <div className="p-3 hover:bg-gray-50">
    {/* Mobile Layout */}
    <div className="md:hidden space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium">{product.name}</div>
          <div className="text-sm text-gray-600">{product.category?.name || 'N/A'}</div>
          <div className="text-xs text-gray-500 mt-1">SKU: {product.sku}</div>
        </div>
        <Button
          size="sm"
          onClick={onSelect}
          disabled={isSelected}
        >
          {isSelected ? 'Added' : 'Add'}
        </Button>
      </div>
      <div className="flex gap-4 text-sm">
        <span>Stock: {product.currentStock || 0}</span>
        <span>Selling: S${product.sellingPrice || 0}</span>
      </div>
    </div>
    
    {/* Desktop Layout */}
    <div className="hidden md:grid md:grid-cols-6 gap-4 items-center">
      <div className="font-medium">{product.name}</div>
      <div className="text-sm text-gray-600">{product.category?.name || 'N/A'}</div>
      <div className="text-sm">{product.currentStock || 0}</div>
      <div className="text-sm">S${product.sellingPrice || 0}</div>
      <div className="text-xs text-gray-500">{product.sku}</div>
      <div>
        <Button
          size="sm"
          onClick={onSelect}
          disabled={isSelected}
        >
          {isSelected ? 'Added' : 'Add'}
        </Button>
      </div>
    </div>
  </div>
));

ProductRow.displayName = 'ProductRow';

export function ProductSelectionDialog({
  open,
  onOpenChange,
  onSelectProduct,
  selectedProducts = [],
  products: propProducts,
  useOptimizedSearch = true
}: ProductSelectionDialogProps) {
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  
  // Use optimized hook for search
  const {
    products: searchedProducts,
    loading,
    searchProducts,
    getProductsPaginated,
    loadMore,
    hasMore
  } = useInventoryOptimized({
    enableCache: true,
    searchDebounce: 300,
    initialLimit: 50,
    context: 'blends' // Use optimized response for blend context
  });

  // Use either prop products or searched products
  const products = useOptimizedSearch ? searchedProducts : (propProducts || []);

  // Load initial products when dialog opens
  useEffect(() => {
    if (open && useOptimizedSearch && products.length === 0) {
      getProductsPaginated(1);
    }
  }, [open, useOptimizedSearch, products.length, getProductsPaginated]);

  // Handle search
  const handleSearch = (value: string) => {
    setLocalSearchTerm(value);
    if (useOptimizedSearch) {
      searchProducts(value);
    }
  };

  // Filter products for non-optimized mode
  const displayProducts = useOptimizedSearch
    ? products
    : products.filter(product =>
        product.name.toLowerCase().includes(localSearchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(localSearchTerm.toLowerCase())
      );

  const handleSelectProduct = (product: Product) => {
    onSelectProduct(product);
    setLocalSearchTerm('');
    if (useOptimizedSearch) {
      searchProducts(''); // Reset search
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Select Product as Ingredient</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search products..."
              value={localSearchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="border rounded-lg">
            {/* Fixed Header - Desktop Only */}
            <div className="hidden md:block bg-white border-b sticky top-0 z-10">
              <div className="grid grid-cols-6 gap-4 p-3 font-medium text-sm">
                <div>Name</div>
                <div>Category</div>
                <div>Stock</div>
                <div>Selling</div>
                <div>SKU</div>
                <div>Action</div>
              </div>
            </div>
            
            {/* Scrollable Body */}
            <div className="max-h-96 overflow-y-auto">
              {loading && products.length === 0 ? (
                <div className="flex justify-center items-center py-8">
                  <ImSpinner8 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : displayProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {localSearchTerm ? 'No products found matching your search' : 'No products available'}
                </div>
              ) : (
                <>
                  <div className="divide-y">
                    {displayProducts.map(product => (
                      <ProductRow
                        key={product._id || `product-${product.name}-${Math.random()}`}
                        product={product}
                        onSelect={() => handleSelectProduct(product)}
                        isSelected={selectedProducts.includes(product._id)}
                      />
                    ))}
                  </div>
                  {useOptimizedSearch && hasMore && (
                    <div className="p-4 text-center border-t">
                      <Button
                        variant="outline"
                        onClick={loadMore}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <ImSpinner8 className="mr-2 h-4 w-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          'Load More Products'
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}