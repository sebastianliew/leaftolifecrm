"use client"

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FaSearch, FaBox, FaTag, FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";
import { useBundles } from "@/hooks/useBundles";
import { useUnitsQuery } from "@/hooks/queries/use-units-query";
import type { Bundle, BundleAvailability } from "@/types/bundle";
import type { TransactionItem } from "@/types/transaction";

interface BundleSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectBundle: (bundleItem: TransactionItem) => void;
  loading?: boolean;
}

export function BundleSelector({
  open,
  onClose,
  onSelectBundle,
  loading: parentLoading
}: BundleSelectorProps) {
  const { 
    bundles, 
    loading, 
    error, 
    categories,
    getAllBundles,
    getCategories,
    checkAvailability 
  } = useBundles(true); // Skip initial load for transaction bundle selection

  // Fetch units using TanStack Query
  const { data: units = [] } = useUnitsQuery();
  
  // Calculate default unit ID with guaranteed fallback
  const defaultUnitId = useMemo(() => {
    if (!units.length) {
      // Units still loading - return null to indicate not ready yet
      return null;
    }

    // Find a default unit for bundles (prefer count-based units)
    const defaultUnit = units.find((u) =>
      u.type === 'count' ||
      u.name.toLowerCase().includes('unit') ||
      u.name.toLowerCase().includes('piece') ||
      u.name.toLowerCase().includes('each')
    );

    if (defaultUnit) {
      return defaultUnit.id || defaultUnit._id;
    }

    // Fallback to first available unit (guaranteed to exist if units.length > 0)
    return units[0].id || units[0]._id;
  }, [units]);

  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [availability, setAvailability] = useState<BundleAvailability | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showPromotedOnly, setShowPromotedOnly] = useState(false);

  const handleAvailabilityCheck = useCallback(async () => {
    if (!selectedBundle) return;
    
    setCheckingAvailability(true);
    try {
      const result = await checkAvailability(selectedBundle._id, quantity);
      setAvailability(result);
    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailability(null);
    } finally {
      setCheckingAvailability(false);
    }
  }, [selectedBundle, quantity, checkAvailability]);

  // Fetch all bundles and categories when component opens
  useEffect(() => {
    if (open) {
      getAllBundles();
      getCategories();
    }
  }, [open, getAllBundles, getCategories]);

  // Check availability when bundle or quantity changes
  useEffect(() => {
    if (selectedBundle && quantity > 0) {
      handleAvailabilityCheck();
    }
  }, [selectedBundle, quantity, handleAvailabilityCheck]);

  // Filter bundles based on search and filters
  const filteredBundles = (bundles || []).filter(bundle => {
    const matchesSearch = bundle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bundle.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (bundle.bundleProducts?.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) || false);

    const matchesCategory = selectedCategory === 'all' || bundle.category === selectedCategory;
    const matchesPromotion = !showPromotedOnly || bundle.isPromoted;

    return matchesSearch && matchesCategory && matchesPromotion;
  });

  const handleBundleSelection = (bundle: Bundle) => {
    setSelectedBundle(bundle);
    setQuantity(1);
    setCustomPrice(null);
    setAvailability(null);
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (!selectedBundle) return;
    
    const validQuantity = Math.max(1, newQuantity);
    setQuantity(validQuantity);
  };

  const handleConfirmBundle = () => {
    if (!selectedBundle) return; // Allow bundles even when items are out of stock

    // CRITICAL: Ensure units are loaded before proceeding
    if (!defaultUnitId) {
      console.error('Units not loaded yet - cannot create bundle item');
      return;
    }

    const unitPrice = customPrice || selectedBundle.bundlePrice;
    const totalPrice = unitPrice * quantity;

    // Bundle creation with proper unit of measurement

    const bundleItem: TransactionItem = {
      id: `bundle_${Date.now()}`,
      productId: selectedBundle._id,
      name: `${selectedBundle.name} (${quantity}x Bundle)`,
      description: selectedBundle.description,
      quantity: quantity,
      unitPrice: unitPrice,
      totalPrice: totalPrice,
      discountAmount: 0,
      isService: false,
      saleType: 'quantity',
      unitOfMeasurementId: defaultUnitId, // Guaranteed to be valid here
      baseUnit: 'bundle',
      convertedQuantity: quantity,
      itemType: 'bundle',
      bundleId: selectedBundle._id,
      bundleData: {
        bundleId: selectedBundle._id,
        bundleName: selectedBundle.name,
        bundleProducts: (selectedBundle.bundleProducts || []).map(bp => ({
          productId: bp.productId,
          name: bp.name,
          quantity: bp.quantity,
          productType: bp.productType,
          blendTemplateId: bp.blendTemplateId,
          individualPrice: bp.individualPrice,
          selectedContainers: [] // This would be populated during container selection
        })),
        individualTotalPrice: selectedBundle.individualTotalPrice,
        savings: selectedBundle.savings,
        savingsPercentage: selectedBundle.savingsPercentage
      }
    };

    onSelectBundle(bundleItem);
    handleClearSelection();
  };

  const handleClearSelection = () => {
    setSelectedBundle(null);
    setQuantity(1);
    setCustomPrice(null);
    setAvailability(null);
    setSearchTerm('');
    setSelectedCategory('all');
    setShowPromotedOnly(false);
  };

  const handleClose = () => {
    handleClearSelection();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FaBox className="w-5 h-5" />
            Select Bundle
          </DialogTitle>
        </DialogHeader>

        {/* Discount Notice */}
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
          <div className="flex items-start gap-2">
            <span className="text-blue-500 text-sm">ℹ️</span>
            <div className="text-sm text-blue-700">
              <strong>Discount Policy:</strong> Patient-level discounts do not apply to bundles.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bundle Selection Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search and Filters */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search bundles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {(categories || []).map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant={showPromotedOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowPromotedOnly(!showPromotedOnly)}
                >
                  <FaTag className="w-3 h-3 mr-1" />
                  Promoted Only
                </Button>
              </div>
            </div>

            {/* Bundle Grid */}
            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">Loading bundles...</div>
              ) : error ? (
                <div className="text-center py-8 text-red-500">Error: {error}</div>
              ) : filteredBundles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No bundles found</div>
              ) : (
                filteredBundles.map((bundle) => (
                  <Card 
                    key={bundle._id} 
                    className={`cursor-pointer transition-all ${
                      selectedBundle?._id === bundle._id 
                        ? 'ring-2 ring-blue-500 bg-blue-50' 
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => handleBundleSelection(bundle)}
                  >
                    <CardContent className="p-3">
                      <div className="grid grid-cols-6 gap-3 items-center text-xs">
                        {/* Bundle Name & Description */}
                        <div className="col-span-2">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm">{bundle.name}</h3>
                            {!bundle.isActive && (
                              <Badge variant="secondary" className="text-xs h-4 px-1 bg-gray-200 text-gray-600">
                                Inactive
                              </Badge>
                            )}
                            {bundle.isPromoted && (
                              <Badge variant="default" className="text-xs h-4 px-1">
                                <FaTag className="w-2 h-2 mr-1" />
                                Promoted
                              </Badge>
                            )}
                            {bundle.category && (
                              <Badge variant="outline" className="text-xs h-4 px-1">
                                {bundle.category}
                              </Badge>
                            )}
                          </div>
                          {bundle.description && (
                            <p className="text-xs text-gray-600 truncate">{bundle.description}</p>
                          )}
                        </div>

                        {/* Bundle Price */}
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Bundle Price</div>
                          <div className="font-semibold text-sm text-green-600">
                            ${(bundle.bundlePrice || 0).toFixed(2)}
                          </div>
                        </div>

                        {/* Individual Total */}
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Individual Total</div>
                          <div className="text-sm text-gray-400 line-through">
                            ${(bundle.individualTotalPrice || 0).toFixed(2)}
                          </div>
                        </div>

                        {/* You Save */}
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">You Save</div>
                          <div className="font-semibold text-sm text-red-500">
                            ${(bundle.savings || 0).toFixed(2)} ({bundle.savingsPercentage || 0}%)
                          </div>
                        </div>

                        {/* Contains & Includes */}
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Contains</div>
                          <div className="font-medium text-sm mb-2">
                            {bundle.bundleProducts?.length || 0} products
                          </div>
                          {bundle.bundleProducts && bundle.bundleProducts.length > 0 && (
                            <div className="space-y-1">
                              {bundle.bundleProducts.slice(0, 2).map((product, index) => (
                                <div key={index} className="text-xs text-gray-600">
                                  {product.quantity}x {product.name.length > 15 ? product.name.substring(0, 15) + '...' : product.name}
                                </div>
                              ))}
                              {bundle.bundleProducts.length > 2 && (
                                <div className="text-xs text-gray-500">
                                  +{bundle.bundleProducts.length - 2} more...
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Bundle Configuration Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configure Bundle</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedBundle ? (
                  <div className="space-y-4">
                    {/* Bundle Info */}
                    <div>
                      <h3 className="font-medium text-lg">{selectedBundle.name}</h3>
                      {selectedBundle.description && (
                        <p className="text-gray-600 text-sm mt-1">{selectedBundle.description}</p>
                      )}
                    </div>

                    {/* Quantity Configuration */}
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                      />
                    </div>

                    {/* Custom Pricing */}
                    <div className="space-y-2">
                      <Label htmlFor="customPrice">Custom Price (optional)</Label>
                      <Input
                        id="customPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={customPrice || ''}
                        onChange={(e) => setCustomPrice(parseFloat(e.target.value) || null)}
                        placeholder={`Default: $${(selectedBundle.bundlePrice || 0).toFixed(2)}`}
                      />
                    </div>

                    {/* Pricing Summary */}
                    <div className="bg-gray-50 p-3 rounded-md space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Price per bundle:</span>
                        <span className="font-medium">
                          ${(customPrice || selectedBundle.bundlePrice || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Quantity:</span>
                        <span className="font-medium">{quantity}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Total:</span>
                        <span className="text-lg">
                          ${((customPrice || selectedBundle.bundlePrice || 0) * quantity).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Total Savings:</span>
                        <span className="font-medium">
                          ${((selectedBundle.savings || 0) * quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Availability Check */}
                    {checkingAvailability ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                        <div className="text-sm text-gray-500 mt-2">Checking availability...</div>
                      </div>
                    ) : availability ? (
                      <div className={`p-3 rounded-md ${
                        availability.allAvailable ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          {availability.allAvailable ? (
                            <FaCheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <FaExclamationTriangle className="w-4 h-4 text-yellow-600" />
                          )}
                          <span className={`font-medium ${
                            availability.allAvailable ? 'text-green-800' : 'text-yellow-800'
                          }`}>
                            {availability.allAvailable ? 'Available' : 'Stock Notice'}
                          </span>
                        </div>

                        {!availability.allAvailable && (
                          <>
                            <div className="text-sm space-y-1">
                              {(availability.results || [])
                                .filter(result => !result.available)
                                .map((result, index) => (
                                  <div key={index} className="text-yellow-700">
                                    • {result.name}: {result.reason === 'Insufficient stock'
                                      ? 'Out of stock - Sale will proceed with negative stock'
                                      : result.reason}
                                  </div>
                                ))}
                            </div>
                            <p className="text-sm mt-2 font-medium text-yellow-800">✓ Transaction will proceed - inventory can be reconciled later</p>
                          </>
                        )}
                      </div>
                    ) : null}

                    <Separator />

                    {/* Actions */}
                    <div className="space-y-2">
                      <Button
                        onClick={handleConfirmBundle}
                        disabled={parentLoading}
                        className="w-full"
                      >
                        {parentLoading ? 'Adding...' : 'Add Bundle to Transaction'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={handleClearSelection}
                        className="w-full"
                      >
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Select a bundle to configure
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}