'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Search, Package, Plus, ShoppingCart } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useRestock, UseRestockCartItem } from '../../hooks/useRestock';
import { useInventory } from '../../hooks/useInventory';

interface ProductSearchRestockProps {
  onAddToCart?: (item: UseRestockCartItem) => void;
  onQuickRestock?: (result: unknown) => void;
  placeholder?: string;
  className?: string;
}

interface SearchResult {
  _id: string;
  name: string;
  sku: string;
  currentStock: number;
  reorderPoint: number;
  unitOfMeasurement?: {
    name: string;
    abbreviation: string;
  };
  supplier?: {
    _id: string;
    name: string;
  };
  category?: {
    name: string;
  };
  costPrice?: number;
  status: string;
}

export const ProductSearchRestock: React.FC<ProductSearchRestockProps> = ({
  onAddToCart,
  onQuickRestock,
  placeholder = "Search products by name or SKU...",
  className = ""
}) => {
  // Helper function to determine display unit - use category for container-based products
  const getDisplayUnit = (product: SearchResult) => {
    if (!product.category) return product.unitOfMeasurement?.abbreviation || '';
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
    return product.unitOfMeasurement?.abbreviation || '';
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});

  const { restockProduct, isLoading: isRestocking } = useRestock();
  const { getProducts } = useInventory();

  const performSearch = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const allProducts = await getProducts();
      const filteredResults = allProducts.filter((product: SearchResult) => 
        product.status === 'active' && 
        (product.name.toLowerCase().includes(term.toLowerCase()) || 
         product.sku.toLowerCase().includes(term.toLowerCase()))
      );
      setSearchResults(filteredResults);
      setShowResults(true);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [getProducts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, performSearch]);

  const handleQuantityChange = (productId: string, quantity: number) => {
    setSelectedQuantities(prev => ({
      ...prev,
      [productId]: Math.max(0, quantity)
    }));
  };

  const handleQuickRestock = async (product: SearchResult, quantity: number) => {
    try {
      const operation = {
        productId: product._id,
        quantity,
        supplier: product.supplier?._id,
        notes: `Quick restock via search`
      };

      const result = await restockProduct(operation);
      
      if (onQuickRestock) {
        onQuickRestock(result);
      }

      setSelectedQuantities(prev => ({
        ...prev,
        [product._id]: 0
      }));
    } catch (error) {
      console.error('Quick restock failed:', error);
    }
  };

  const handleAddToCart = (product: SearchResult) => {
    const quantity = selectedQuantities[product._id] || 10;
    
    if (!onAddToCart) return;

    const cartItem: UseRestockCartItem = {
      id: `search-${product._id}-${Date.now()}`,
      productId: product._id,
      productName: product.name,
      quantity,
      currentStock: product.currentStock,
      supplier: product.supplier?._id,
      unitCost: product.costPrice,
      notes: `Added via search`,
      estimatedCost: (product.costPrice || 0) * quantity
    };

    onAddToCart(cartItem);
    
    setSelectedQuantities(prev => ({
      ...prev,
      [product._id]: 0
    }));
  };

  const getStockStatus = (product: SearchResult) => {
    if (product.currentStock <= 0) return { label: 'Out of Stock', variant: 'destructive' as const };
    if (product.currentStock <= product.reorderPoint * 0.5) return { label: 'Critical', variant: 'destructive' as const };
    if (product.currentStock <= product.reorderPoint) return { label: 'Low Stock', variant: 'secondary' as const };
    return { label: 'In Stock', variant: 'default' as const };
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={placeholder}
          className="pl-10"
          onFocus={() => searchTerm.length >= 2 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
        />
      </div>

      {showResults && (searchResults.length > 0 || isSearching) && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-96 overflow-y-auto">
          <CardContent className="p-2">
            {isSearching ? (
              <div className="p-4 text-center text-muted-foreground">
                Searching products...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No products found for &quot;{searchTerm}&quot;
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((product) => {
                  const stockStatus = getStockStatus(product);
                  const currentQuantity = selectedQuantities[product._id] || 0;
                  
                  return (
                    <div key={product._id} className="p-3 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium truncate">{product.name}</span>
                            <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
                          </div>
                          
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>SKU: {product.sku} | Stock: {product.currentStock} {getDisplayUnit(product)}</p>
                            {product.supplier && (
                              <p>Supplier: {product.supplier.name}</p>
                            )}
                            {product.category && (
                              <p>Category: {product.category.name}</p>
                            )}
                            {product.costPrice && (
                              <p>Cost: ${product.costPrice.toFixed(2)}</p>
                            )}
                          </div>
                        </div>

                        <div className="ml-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              value={currentQuantity}
                              onChange={(e) => handleQuantityChange(product._id, parseInt(e.target.value) || 0)}
                              placeholder="Qty"
                              className="w-20 h-8"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuantityChange(product._id, 10)}
                            >
                              +10
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuantityChange(product._id, 25)}
                            >
                              +25
                            </Button>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleQuickRestock(product, currentQuantity || 10)}
                              disabled={isRestocking || (currentQuantity <= 0 && !currentQuantity)}
                              className="flex-1"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Restock
                            </Button>
                            
                            {onAddToCart && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddToCart(product)}
                                disabled={currentQuantity <= 0}
                              >
                                <ShoppingCart className="w-3 h-3" />
                              </Button>
                            )}
                          </div>

                          {currentQuantity > 0 && product.costPrice && (
                            <p className="text-xs text-muted-foreground text-right">
                              Est. ${(product.costPrice * currentQuantity).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};