'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  ShoppingCart,
  Star,
  Clock,
  Package,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useReorderSuggestionsQuery, useCustomerFavoritesQuery } from '@/hooks/queries/use-customer-queries';

interface ReorderItem {
  productId: string;
  name: string;
  quantity: number;
  itemType: string;
}

interface ReorderSuggestionsProps {
  customerId: string | null;
  onAddItems: (items: ReorderItem[]) => void;
}

export function ReorderSuggestions({ customerId, onAddItems }: ReorderSuggestionsProps) {
  const [selectedTab, setSelectedTab] = useState<'suggestions' | 'favorites'>('suggestions');

  // Use TanStack Query hooks
  const { 
    data: suggestions, 
    isLoading: suggestionsLoading,
    refetch: refetchSuggestions
  } = useReorderSuggestionsQuery(customerId, 10);
  
  const { 
    data: favorites, 
    isLoading: favoritesLoading,
    refetch: refetchFavorites
  } = useCustomerFavoritesQuery(customerId);

  const loading = suggestionsLoading || favoritesLoading;

  const _handleRefresh = () => {
    refetchSuggestions();
    refetchFavorites();
  };

  const handleAddToTransaction = (item: {
    itemId: string;
    itemName: string;
    suggestedQuantity?: number;
    itemType: string;
  }) => {
    const transactionItem = {
      productId: item.itemId,
      name: item.itemName,
      quantity: item.suggestedQuantity || 1,
      itemType: item.itemType,
      // Additional fields will be populated by the transaction form
    };
    
    onAddItems([transactionItem]);
    toast.success(`Added ${item.itemName} to transaction`);
  };

  const handleAddMultiple = (items: Array<{
    itemId: string;
    itemName: string;
    suggestedQuantity?: number;
    itemType: string;
  }>) => {
    const transactionItems = items.map(item => ({
      productId: item.itemId,
      name: item.itemName,
      quantity: item.suggestedQuantity || 1,
      itemType: item.itemType,
    }));
    
    onAddItems(transactionItems);
    toast.success(`Added ${items.length} items to transaction`);
  };

  if (!customerId) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Select a customer to see purchase suggestions</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const urgentSuggestions = suggestions?.suggestions?.filter((s) => s.urgency === 'high') || [];
  const allFavorites = [
    ...(favorites?.products || []),
    ...(favorites?.blends || []),
    ...(favorites?.customBlends || []),
    ...(favorites?.bundles || [])
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Smart Reorder Suggestions</CardTitle>
        <CardDescription>
          Based on purchase history and patterns
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Quick Actions */}
        {urgentSuggestions.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-900">
                {urgentSuggestions.length} items overdue for reorder
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddMultiple(urgentSuggestions)}
              className="w-full"
            >
              Add all overdue items
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={selectedTab === 'suggestions' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('suggestions')}
          >
            <Clock className="h-4 w-4 mr-1" />
            Reorder Due ({suggestions?.summary?.total || 0})
          </Button>
          <Button
            variant={selectedTab === 'favorites' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTab('favorites')}
          >
            <Star className="h-4 w-4 mr-1" />
            Favorites ({allFavorites.length})
          </Button>
        </div>

        <ScrollArea className="h-[400px]">
          {selectedTab === 'suggestions' ? (
            <div className="space-y-3">
              {suggestions?.suggestions?.map((suggestion) => (
                <div
                  key={`${suggestion.itemType}-${suggestion.itemId}`}
                  className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium">{suggestion.itemName}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>Last: {formatDistanceToNow(new Date(suggestion.lastPurchaseDate), { addSuffix: true })}</span>
                        <span>Qty: {suggestion.suggestedQuantity || 1}</span>
                        {suggestion.isFavorite && (
                          <Star className="h-3 w-3 fill-current text-yellow-500" />
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={
                        suggestion.urgency === 'high' ? 'destructive' :
                        suggestion.urgency === 'medium' ? 'secondary' :
                        'default'
                      }
                    >
                      {suggestion.isOverdue ? `${suggestion.daysOverdue}d overdue` : `Due in ${suggestion.daysUntilDue}d`}
                    </Badge>
                  </div>
                  
                  {suggestion.itemDetails && (
                    <div className="text-sm text-muted-foreground mb-2">
                      {suggestion.itemType === 'product' && suggestion.itemDetails.inventory && (
                        <span>Stock: {suggestion.itemDetails.inventory.currentStock || 0}</span>
                      )}
                      {suggestion.itemDetails.pricing && (
                        <span className="ml-3">${suggestion.itemDetails.pricing.sellingPrice || 0}</span>
                      )}
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleAddToTransaction(suggestion)}
                  >
                    Add to Transaction
                  </Button>
                </div>
              ))}
              
              {(!suggestions?.suggestions || suggestions.suggestions.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4" />
                  <p>No reorder suggestions available</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {allFavorites.map((item) => (
                <div
                  key={item._id}
                  className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium">{'name' in item ? item.name : 'blendName' in item ? item.blendName : ''}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {item.purchaseCount || 0} orders
                        </Badge>
                        {item.lastPurchaseDate && (
                          <span>Last: {formatDistanceToNow(new Date(item.lastPurchaseDate), { addSuffix: true })}</span>
                        )}
                      </div>
                    </div>
                    <Star className="h-4 w-4 fill-current text-yellow-500" />
                  </div>
                  
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleAddToTransaction({
                      itemId: item._id,
                      itemName: 'name' in item ? item.name : 'blendName' in item ? item.blendName : '',
                      itemType: item.itemType || 'product',
                      suggestedQuantity: 1
                    })}
                  >
                    Add to Transaction
                  </Button>
                </div>
              ))}
              
              {allFavorites.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-4" />
                  <p>No favorite items yet</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Previous Orders Quick Access */}
        {suggestions?.summary && suggestions.summary.total > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">Quick actions:</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Find the most recent transaction
                  const patterns = suggestions.suggestions;
                  if (patterns && patterns.length > 0) {
                    // This would need to be implemented to get actual transaction IDs
                    toast.info('Quick reorder feature coming soon');
                  }
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Repeat Last Order
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddMultiple(suggestions.suggestions.filter((s) => s.isFavorite))}
              >
                Add All Favorites
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}