'use client';

import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Trash2, 
  Edit3, 
  Package, 
  DollarSign, 
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { useRestockCart, UseRestockCartItem } from '../../hooks/useRestock';

interface RestockCartProps {
  className?: string;
  onProcessComplete?: (result: unknown) => void;
}

interface ProcessOptions {
  batchReference: string;
  notes: string;
  purchaseOrderRef: string;
}

export const RestockCart: React.FC<RestockCartProps> = ({
  className = "",
  onProcessComplete
}) => {
  const {
    items,
    removeItem,
    updateItem,
    clearCart,
    getTotalItems,
    getTotalCost,
    processCart,
    isProcessing,
    error
  } = useRestockCart();

  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UseRestockCartItem>>({});
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [processOptions, setProcessOptions] = useState<ProcessOptions>({
    batchReference: '',
    notes: '',
    purchaseOrderRef: ''
  });
  const [processResult, setProcessResult] = useState<{
    successCount: number;
    totalOperations: number;
    failureCount: number;
  } | null>(null);

  const handleEditStart = (item: UseRestockCartItem) => {
    setEditingItem(item.id);
    setEditForm({
      quantity: item.quantity,
      notes: item.notes,
      reference: item.reference,
      unitCost: item.unitCost
    });
  };

  const handleEditSave = () => {
    if (!editingItem || !editForm.quantity || editForm.quantity <= 0) return;

    const updates: Partial<UseRestockCartItem> = {
      quantity: editForm.quantity,
      notes: editForm.notes,
      reference: editForm.reference,
      unitCost: editForm.unitCost,
      estimatedCost: (editForm.unitCost || 0) * editForm.quantity
    };

    updateItem(editingItem, updates);
    setEditingItem(null);
    setEditForm({});
  };

  const handleEditCancel = () => {
    setEditingItem(null);
    setEditForm({});
  };

  const handleProcessCart = async () => {
    try {
      const result = await processCart({
        batchReference: processOptions.batchReference || undefined,
        notes: processOptions.notes || undefined,
        purchaseOrderRef: processOptions.purchaseOrderRef || undefined
      });

      setProcessResult(result);
      setShowProcessDialog(false);
      
      if (onProcessComplete) {
        onProcessComplete(result);
      }
    } catch (error) {
      console.error('Failed to process cart:', error);
    }
  };

  const generateBatchReference = () => {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `BULK-${timestamp}-${random}`;
  };

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Restock Cart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Your restock cart is empty</p>
            <p className="text-sm text-muted-foreground mt-2">
              Search for products and add them to your cart for bulk restocking
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Restock Cart ({getTotalItems()} items)
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearCart}>
                Clear Cart
              </Button>
              <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={items.length === 0}>
                    Process Cart
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Process Restock Cart</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Batch Reference</label>
                      <div className="flex gap-2">
                        <Input
                          value={processOptions.batchReference}
                          onChange={(e) => setProcessOptions(prev => ({
                            ...prev,
                            batchReference: e.target.value
                          }))}
                          placeholder="Optional batch reference"
                        />
                        <Button
                          variant="outline"
                          onClick={() => setProcessOptions(prev => ({
                            ...prev,
                            batchReference: generateBatchReference()
                          }))}
                        >
                          Generate
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Purchase Order Reference</label>
                      <Input
                        value={processOptions.purchaseOrderRef}
                        onChange={(e) => setProcessOptions(prev => ({
                          ...prev,
                          purchaseOrderRef: e.target.value
                        }))}
                        placeholder="Optional PO reference"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Notes</label>
                      <Textarea
                        value={processOptions.notes}
                        onChange={(e) => setProcessOptions(prev => ({
                          ...prev,
                          notes: e.target.value
                        }))}
                        placeholder="Optional batch notes"
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowProcessDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleProcessCart} disabled={isProcessing}>
                        {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Process {items.length} Items
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {processResult && (
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>
                Bulk restock completed: {processResult.successCount}/{processResult.totalOperations} successful
                {processResult.failureCount > 0 && ` (${processResult.failureCount} failed)`}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-4">
                {editingItem === item.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium">Quantity</label>
                        <Input
                          type="number"
                          min="1"
                          value={editForm.quantity || ''}
                          onChange={(e) => setEditForm(prev => ({
                            ...prev,
                            quantity: parseInt(e.target.value) || 0
                          }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Unit Cost</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.unitCost || ''}
                          onChange={(e) => setEditForm(prev => ({
                            ...prev,
                            unitCost: parseFloat(e.target.value) || 0
                          }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Notes</label>
                      <Input
                        value={editForm.notes || ''}
                        onChange={(e) => setEditForm(prev => ({
                          ...prev,
                          notes: e.target.value
                        }))}
                        placeholder="Optional notes"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Reference</label>
                      <Input
                        value={editForm.reference || ''}
                        onChange={(e) => setEditForm(prev => ({
                          ...prev,
                          reference: e.target.value
                        }))}
                        placeholder="Optional reference"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={handleEditCancel}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleEditSave}>
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{item.productName}</span>
                        <Badge variant="outline">
                          Current: {item.currentStock}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Quantity:</span> {item.quantity}
                        </div>
                        <div>
                          <span className="font-medium">Unit Cost:</span> ${(item.unitCost || 0).toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">Total:</span> ${(item.estimatedCost || 0).toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">New Stock:</span> {item.currentStock + item.quantity}
                        </div>
                      </div>
                      
                      {item.notes && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <FileText className="w-3 h-3 inline mr-1" />
                          {item.notes}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditStart(item)}
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  <span className="font-medium">{getTotalItems()} Items</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-medium">Total: ${getTotalCost().toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};