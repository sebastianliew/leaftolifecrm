'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Package, Calendar, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import UnitConversionService from '@/lib/unit-conversion';

interface Container {
  id: string;
  remaining: number;
  capacity: number;
  status: 'full' | 'partial' | 'empty';
  batchNumber?: string;
  expiryDate?: Date;
  lastMovement?: string;
}

interface Product {
  _id: string;
  name: string;
  unitName: string;
  totalQuantity: number;
  containerCapacity: number;
  containers: {
    full: number;
    partial: Container[];
  };
}

interface SelectedContainer {
  containerId: string;
  containerCode: string;
  quantityToConsume: number;
  batchNumber?: string;
  expiryDate?: Date;
  remaining: number;
  capacity: number;
}

interface ContainerSelectorProps {
  product: Product;
  requiredQuantity: number;
  requiredUnit: string;
  onSelectionChange: (containers: SelectedContainer[]) => void;
  className?: string;
}

export default function ContainerSelector({
  product,
  requiredQuantity,
  requiredUnit,
  onSelectionChange,
  className = ''
}: ContainerSelectorProps) {
  const [selectedContainers, setSelectedContainers] = useState<SelectedContainer[]>([]);
  const [manualMode, setManualMode] = useState(false);
  const [error, setError] = useState<string>('');

  // Convert required quantity to product's unit
  const requiredInProductUnit = useMemo(() => {
    try {
      return UnitConversionService.convert(requiredQuantity, requiredUnit, product.unitName);
    } catch {
      setError(`Cannot convert ${requiredQuantity} ${requiredUnit} to ${product.unitName}`);
      return { value: 0, unit: product.unitName, originalValue: requiredQuantity, originalUnit: requiredUnit };
    }
  }, [requiredQuantity, requiredUnit, product.unitName, setError]);

  // Get available containers (prioritize expiring soon and partial containers)
  const availableContainers = useMemo(() => {
    const containers: (Container & { type: 'full' | 'partial'; displayId: string })[] = [];
    
    // Add partial containers first (use them up first)
    product.containers.partial?.forEach((container, index) => {
      if (container.remaining > 0) {
        containers.push({
          ...container,
          type: 'partial',
          displayId: `P${index + 1}`
        });
      }
    });

    // Add full containers
    for (let i = 0; i < (product.containers.full || 0); i++) {
      containers.push({
        id: `FULL_${i}`,
        remaining: product.containerCapacity,
        capacity: product.containerCapacity,
        status: 'full',
        type: 'full',
        displayId: `F${i + 1}`,
        batchNumber: `BATCH_${Date.now()}_${i}`,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
      });
    }

    // Sort by expiry date (earliest first) and then by remaining quantity (partial first)
    return containers.sort((a, b) => {
      // Prioritize containers expiring soon
      if (a.expiryDate && b.expiryDate) {
        const daysDiffA = Math.floor((a.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const daysDiffB = Math.floor((b.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        if (daysDiffA !== daysDiffB) {
          return daysDiffA - daysDiffB;
        }
      }
      
      // Then prioritize partial containers (use them up first)
      if (a.type !== b.type) {
        return a.type === 'partial' ? -1 : 1;
      }
      
      return 0;
    });
  }, [product]);

  // Auto-select optimal containers
  const autoSelectContainers = useCallback(() => {
    const selected: SelectedContainer[] = [];
    let remainingNeeded = requiredInProductUnit.value;
    
    for (const container of availableContainers) {
      if (remainingNeeded <= 0) break;
      
      const quantityToTake = Math.min(remainingNeeded, container.remaining);
      
      selected.push({
        containerId: container.id,
        containerCode: container.displayId,
        quantityToConsume: quantityToTake,
        batchNumber: container.batchNumber,
        expiryDate: container.expiryDate,
        remaining: container.remaining,
        capacity: container.capacity
      });
      
      remainingNeeded -= quantityToTake;
    }
    
    setSelectedContainers(selected);
    setError(remainingNeeded > 0 ? `Insufficient stock: need ${remainingNeeded.toFixed(2)} ${product.unitName} more` : '');
  }, [requiredInProductUnit.value, availableContainers, product.unitName]);

  // Manual container selection
  const toggleContainer = (container: Container & { type: 'full' | 'partial'; displayId: string }) => {
    const isSelected = selectedContainers.some(s => s.containerId === container.id);
    
    if (isSelected) {
      setSelectedContainers(prev => prev.filter(s => s.containerId !== container.id));
    } else {
      const remainingNeeded = requiredInProductUnit.value - getTotalSelected();
      const quantityToTake = Math.min(remainingNeeded, container.remaining);
      
      setSelectedContainers(prev => [...prev, {
        containerId: container.id,
        containerCode: container.displayId,
        quantityToConsume: quantityToTake,
        batchNumber: container.batchNumber,
        expiryDate: container.expiryDate,
        remaining: container.remaining,
        capacity: container.capacity
      }]);
    }
  };

  const updateQuantity = (containerId: string, quantity: number) => {
    setSelectedContainers(prev => prev.map(s => 
      s.containerId === containerId 
        ? { ...s, quantityToConsume: Math.min(quantity, s.remaining) }
        : s
    ));
  };

  const getTotalSelected = () => {
    return selectedContainers.reduce((sum, s) => sum + s.quantityToConsume, 0);
  };

  const getExpiryStatus = (expiryDate?: Date) => {
    if (!expiryDate) return { status: 'unknown', days: 0, color: 'gray' };
    
    const daysDiff = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 0) return { status: 'expired', days: Math.abs(daysDiff), color: 'red' };
    if (daysDiff < 30) return { status: 'expiring', days: daysDiff, color: 'yellow' };
    if (daysDiff < 90) return { status: 'good', days: daysDiff, color: 'green' };
    return { status: 'fresh', days: daysDiff, color: 'blue' };
  };

  useEffect(() => {
    if (!manualMode) {
      autoSelectContainers();
    }
  }, [requiredInProductUnit.value, manualMode, autoSelectContainers]);

  useEffect(() => {
    onSelectionChange(selectedContainers);
  }, [selectedContainers, onSelectionChange]);

  const ContainerCard = ({ container }: { container: Container & { type: 'full' | 'partial'; displayId: string } }) => {
    const isSelected = selectedContainers.some(s => s.containerId === container.id);
    const selectedContainer = selectedContainers.find(s => s.containerId === container.id);
    const expiryStatus = getExpiryStatus(container.expiryDate);
    
    return (
      <Card 
        className={`cursor-pointer transition-all ${
          isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
        }`}
        onClick={() => manualMode && toggleContainer(container)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span className="font-medium">{container.displayId}</span>
              <Badge variant={container.type === 'partial' ? 'secondary' : 'default'}>
                {container.type}
              </Badge>
            </div>
            
            {isSelected && <CheckCircle className="w-5 h-5 text-green-500" />}
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Available:</span>
              <span className="font-medium">{container.remaining} {product.unitName}</span>
            </div>
            
            {container.batchNumber && (
              <div className="flex justify-between">
                <span className="text-gray-500">Batch:</span>
                <span className="font-mono text-xs">{container.batchNumber}</span>
              </div>
            )}
            
            {container.expiryDate && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Expires:</span>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span className={`text-xs text-${expiryStatus.color}-600`}>
                    {expiryStatus.days}d
                  </span>
                  {expiryStatus.status === 'expiring' && (
                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                  )}
                </div>
              </div>
            )}
            
            {isSelected && selectedContainer && (
              <div className="mt-3 p-2 bg-white rounded border">
                <Label className="text-xs">Quantity to use:</Label>
                <Input
                  type="number"
                  value={selectedContainer.quantityToConsume}
                  onChange={(e) => updateQuantity(container.id, parseFloat(e.target.value) || 0)}
                  max={container.remaining}
                  min={0}
                  step={0.1}
                  className="h-7 text-sm mt-1"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Container Selection</h3>
        <div className="flex gap-2">
          <Button
            variant={manualMode ? "outline" : "default"}
            size="sm"
            onClick={() => setManualMode(false)}
          >
            Auto Select
          </Button>
          <Button
            variant={manualMode ? "default" : "outline"}
            size="sm"
            onClick={() => setManualMode(true)}
          >
            Manual
          </Button>
        </div>
      </div>

      {/* Selection Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4" />
            Selection Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Required</div>
              <div className="font-medium">
                {requiredQuantity} {requiredUnit}
                {requiredUnit !== product.unitName && (
                  <div className="text-xs text-gray-400">
                    ≈ {requiredInProductUnit.value.toFixed(2)} {product.unitName}
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Selected</div>
              <div className="font-medium">{getTotalSelected().toFixed(2)} {product.unitName}</div>
            </div>
            <div>
              <div className="text-gray-500">Containers</div>
              <div className="font-medium">{selectedContainers.length}</div>
            </div>
            <div>
              <div className="text-gray-500">Status</div>
              <div className="font-medium">
                {getTotalSelected() >= requiredInProductUnit.value ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Sufficient
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    Short {(requiredInProductUnit.value - getTotalSelected()).toFixed(2)} {product.unitName}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Container Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">Available Containers ({availableContainers.length})</h4>
          {!manualMode && (
            <Badge variant="outline" className="text-xs">
              Auto-optimized for FIFO
            </Badge>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {availableContainers.map(container => (
            <ContainerCard key={container.id} container={container} />
          ))}
        </div>
        
        {availableContainers.length === 0 && (
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              No containers available for this product. Please check stock levels.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Tips */}
      {manualMode && (
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            <strong>Manual Mode:</strong> Click containers to select them. 
            The system suggests using partial containers first and those expiring soon.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}