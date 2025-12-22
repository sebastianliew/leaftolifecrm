"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FaSearch, FaHistory, FaClock, FaUser, FaFlask, FaFire, FaHeart } from 'react-icons/fa';
import { ImSpinner8 } from 'react-icons/im';

export interface BlendHistoryIngredient {
  productId: string;
  name: string;
  quantity: number;
  unitOfMeasurementId: string | { _id?: string; id?: string };
  unitName: string;
  costPerUnit: number;
  selectedContainers?: Array<{
    containerId: string;
    containerCode: string;
    quantityToConsume: number;
    batchNumber?: string;
    expiryDate?: Date;
  }>;
}

export interface CustomBlendHistoryItem {
  _id: string;
  blendName: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  ingredients: BlendHistoryIngredient[];
  totalIngredientCost: number;
  sellingPrice: number;
  marginPercent: number;
  preparationNotes?: string;
  mixedBy: string;
  transactionNumber?: string;
  usageCount: number;
  lastUsed: Date;
  createdAt: Date;
}

interface BlendHistorySelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectBlend: (blend: CustomBlendHistoryItem) => void;
  customerId?: string;
  customerName?: string;
}

export function BlendHistorySelector({
  open,
  onClose,
  onSelectBlend,
  customerId,
  customerName: _customerName
}: BlendHistorySelectorProps) {
  const [blends, setBlends] = useState<CustomBlendHistoryItem[]>([]);
  const [filteredBlends, setFilteredBlends] = useState<CustomBlendHistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'customer' | 'popular'>('all');

  const fetchBlendHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      
      if (selectedFilter === 'customer' && customerId) {
        params.append('customerId', customerId);
      } else if (selectedFilter === 'popular') {
        params.append('popular', 'true');
      }
      
      params.append('limit', '50');

      const response = await fetch(`/api/custom-blends/history?${params}`);
      const data = await response.json();

      if (data.success) {
        setBlends(data.data);
      } else {
        setError(data.error || 'Failed to fetch blend history');
      }
    } catch (err) {
      console.error('Error fetching blend history:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [selectedFilter, customerId]);

  // Fetch blend history when dialog opens
  useEffect(() => {
    if (open) {
      fetchBlendHistory();
    }
  }, [open, fetchBlendHistory]);

  // Filter blends based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredBlends(blends);
    } else {
      const filtered = blends.filter(blend =>
        blend.blendName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        blend.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        blend.ingredients.some(ing => ing.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredBlends(filtered);
    }
  }, [searchTerm, blends]);

  const handleSelectBlend = async (blend: CustomBlendHistoryItem) => {
    try {
      // Record usage
      await fetch(`/api/custom-blends/history/${blend._id}`, {
        method: 'PUT'
      });
      
      onSelectBlend(blend);
      onClose();
    } catch (err) {
      console.error('Error recording blend usage:', err);
      // Still proceed with selection even if usage recording fails
      onSelectBlend(blend);
      onClose();
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getFilterButtonVariant = (filter: string) => {
    return selectedFilter === filter ? 'default' : 'outline';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FaHistory className="w-5 h-5" />
            Select Custom Blend to Repeat
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col space-y-4 flex-1 overflow-hidden">
          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search blends by name, customer, or ingredients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant={getFilterButtonVariant('all')}
                size="sm"
                onClick={() => setSelectedFilter('all')}
              >
                All Blends
              </Button>
              {customerId && (
                <Button
                  variant={getFilterButtonVariant('customer')}
                  size="sm"
                  onClick={() => setSelectedFilter('customer')}
                >
                  <FaUser className="w-3 h-3 mr-1" />
                  This Customer
                </Button>
              )}
              <Button
                variant={getFilterButtonVariant('popular')}
                size="sm"
                onClick={() => setSelectedFilter('popular')}
              >
                <FaFire className="w-3 h-3 mr-1" />
                Popular
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {error && (
              <Alert className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <ImSpinner8 className="w-6 h-6 animate-spin mr-2" />
                <span>Loading blend history...</span>
              </div>
            ) : filteredBlends.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No blends found matching your search.' : 'No custom blends found.'}
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredBlends.map((blend) => (
                  <Card key={blend._id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSelectBlend(blend)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <FaFlask className="w-4 h-4 text-blue-600" />
                            {blend.blendName}
                          </CardTitle>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <FaUser className="w-3 h-3" />
                              {blend.customerName}
                            </div>
                            <div className="flex items-center gap-1">
                              <FaClock className="w-3 h-3" />
                              {formatDate(blend.lastUsed)}
                            </div>
                            {blend.usageCount > 1 && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <FaHeart className="w-3 h-3" />
                                Used {blend.usageCount} times
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-green-600">
                            ${blend.sellingPrice.toFixed(2)}
                          </div>
                          <div className="text-sm text-gray-500">
                            Cost: ${blend.totalIngredientCost.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-2">
                            Ingredients ({blend.ingredients.length}):
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {blend.ingredients.map((ingredient, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {ingredient.name} ({ingredient.quantity} {ingredient.unitName})
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {blend.preparationNotes && (
                          <div>
                            <div className="text-sm font-medium text-gray-700">Notes:</div>
                            <div className="text-sm text-gray-600 italic">
                              {blend.preparationNotes}
                            </div>
                          </div>
                        )}

                        <Separator />

                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span>Mixed by: {blend.mixedBy}</span>
                          <span>Created: {formatDate(blend.createdAt)}</span>
                          {blend.transactionNumber && (
                            <span>Transaction: {blend.transactionNumber}</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 