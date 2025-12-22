'use client';

import React, { useState } from 'react';
import { useRestock, RestockSuggestion } from '../../hooks/useRestock';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, AlertTriangle, CheckCircle, Package } from 'lucide-react';

interface QuickRestockWidgetProps {
  suggestions: RestockSuggestion[];
  onRestockComplete?: (result: unknown) => void;
  className?: string;
}

interface RestockFormData {
  productId: string;
  quantity: number;
  notes?: string;
}

export const QuickRestockWidget: React.FC<QuickRestockWidgetProps> = ({
  suggestions,
  onRestockComplete,
  className = ''
}) => {
  const { restockProduct, isLoading, error, clearError } = useRestock();
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [formData, setFormData] = useState<RestockFormData>({
    productId: '',
    quantity: 0,
    notes: ''
  });
  const [successMessage, setSuccessMessage] = useState<string>('');

  const handleQuickRestock = async (suggestion: RestockSuggestion, quantity: number) => {
    try {
      clearError();
      setSuccessMessage('');

      const operation = {
        productId: suggestion.product._id,
        quantity,
        notes: `Quick restock - Low stock alert (${suggestion.currentStock}/${suggestion.reorderPoint})`
      };

      const result = await restockProduct(operation);
      setSuccessMessage(`Successfully restocked ${suggestion.product.name}! New stock: ${result.newStock}`);
      
      if (onRestockComplete) {
        onRestockComplete(result);
      }
    } catch (err) {
      console.error('Quick restock failed:', err);
    }
  };

  const handleCustomRestock = async () => {
    if (!formData.productId || formData.quantity <= 0) return;

    try {
      clearError();
      setSuccessMessage('');

      const operation = {
        productId: formData.productId,
        quantity: formData.quantity,
        notes: formData.notes || 'Custom restock'
      };

      const result = await restockProduct(operation);
      setSuccessMessage(`Successfully restocked! New stock: ${result.newStock}`);
      
      setFormData({ productId: '', quantity: 0, notes: '' });
      setExpandedProduct(null);
      
      if (onRestockComplete) {
        onRestockComplete(result);
      }
    } catch (err) {
      console.error('Custom restock failed:', err);
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="w-4 h-4" />;
      case 'medium': return <Package className="w-4 h-4" />;
      case 'low': return <CheckCircle className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  if (suggestions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            All Stock Levels Good
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No products need restocking at this time.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Low Stock Alerts ({suggestions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert>
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {suggestions.slice(0, 5).map((suggestion) => (
            <div key={suggestion.product._id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{suggestion.product.name}</span>
                    <Badge variant={getPriorityBadgeVariant(suggestion.priority)}>
                      {getPriorityIcon(suggestion.priority)}
                      {suggestion.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Current: {suggestion.currentStock} | Reorder: {suggestion.reorderPoint}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickRestock(suggestion, 10)}
                    disabled={isLoading}
                  >
                    +10
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickRestock(suggestion, 25)}
                    disabled={isLoading}
                  >
                    +25
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickRestock(suggestion, suggestion.suggestedQuantity)}
                    disabled={isLoading}
                  >
                    +{suggestion.suggestedQuantity}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (expandedProduct === suggestion.product._id) {
                        setExpandedProduct(null);
                      } else {
                        setExpandedProduct(suggestion.product._id);
                        setFormData({
                          productId: suggestion.product._id,
                          quantity: suggestion.suggestedQuantity,
                          notes: ''
                        });
                      }
                    }}
                  >
                    Custom
                  </Button>
                </div>
              </div>

              {expandedProduct === suggestion.product._id && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Quantity</label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.quantity}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          quantity: parseInt(e.target.value) || 0
                        }))}
                        placeholder="Enter quantity"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Notes (optional)</label>
                      <Input
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          notes: e.target.value
                        }))}
                        placeholder="Restock notes"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpandedProduct(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCustomRestock}
                      disabled={isLoading || formData.quantity <= 0}
                    >
                      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Restock Now
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {suggestions.length > 5 && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              +{suggestions.length - 5} more products need restocking
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};