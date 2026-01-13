'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Package, Calendar, AlertTriangle, CheckCircle, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { containersService } from '@/services/api/containers.service';
import type { Bottle } from '@/types/container';

interface BottleSelectorProps {
  productId: string;
  productName: string;
  requiredQuantity: number;
  unitAbbreviation: string;
  open: boolean;
  onClose: () => void;
  onSelect: (containerId: string | null, bottle: Bottle | null) => void;
}

export default function BottleSelector({
  productId,
  productName,
  requiredQuantity,
  unitAbbreviation,
  open,
  onClose,
  onSelect,
}: BottleSelectorProps) {
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [selectedBottle, setSelectedBottle] = useState<Bottle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullContainers, setFullContainers] = useState(0);

  const fetchBottles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await containersService.getProductContainers(productId, { status: 'all' });
      // Filter to only partial bottles (open bottles we can sell from)
      const partialBottles = data.containers.filter(b => b.status === 'partial' && b.remaining > 0);
      setBottles(partialBottles);
      setFullContainers(data.fullContainers);
    } catch (err) {
      console.error('Failed to fetch bottles:', err);
      setError('Failed to load bottles. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  // Fetch containers when dialog opens
  useEffect(() => {
    if (open && productId) {
      fetchBottles();
    }
  }, [open, productId, fetchBottles]);

  // Sort bottles by priority: expiring soon first (FEFO), then by remaining
  const sortedBottles = useMemo(() => {
    return [...bottles].sort((a, b) => {
      // First by expiry (expiring soon first)
      if (a.expiryDate && b.expiryDate) {
        const aDate = new Date(a.expiryDate).getTime();
        const bDate = new Date(b.expiryDate).getTime();
        if (aDate !== bDate) return aDate - bDate;
      } else if (a.expiryDate) {
        return -1; // Items with expiry come first
      } else if (b.expiryDate) {
        return 1;
      }
      // Then by remaining (less remaining first - use up open bottles)
      return a.remaining - b.remaining;
    });
  }, [bottles]);

  // Get suggested bottle (first in sorted list with enough quantity)
  const suggestedBottle = useMemo(() => {
    return sortedBottles.find(b => b.remaining >= requiredQuantity) || sortedBottles[0];
  }, [sortedBottles, requiredQuantity]);

  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const daysDiff = Math.floor((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 0) return { label: 'Expired', color: 'destructive' as const, days: Math.abs(daysDiff) };
    if (daysDiff < 7) return { label: 'Expiring soon', color: 'destructive' as const, days: daysDiff };
    if (daysDiff < 30) return { label: 'Expiring', color: 'secondary' as const, days: daysDiff };
    return { label: 'Good', color: 'outline' as const, days: daysDiff };
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  const handleSelect = (bottle: Bottle) => {
    setSelectedBottle(bottle);
  };

  const handleConfirm = () => {
    onSelect(selectedBottle?.id || null, selectedBottle);
    onClose();
  };

  const handleAutoSelect = () => {
    // Auto-select means let the system pick (FIFO)
    onSelect(null, null);
    onClose();
  };

  const BottleCard = ({ bottle, isSuggested = false }: { bottle: Bottle; isSuggested?: boolean }) => {
    const isSelected = selectedBottle?.id === bottle.id;
    const expiryStatus = getExpiryStatus(bottle.expiryDate);
    const hasEnough = bottle.remaining >= requiredQuantity;

    return (
      <Card
        className={`cursor-pointer transition-all ${
          isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
        } ${!hasEnough ? 'opacity-75' : ''}`}
        onClick={() => handleSelect(bottle)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">
                {bottle.id.substring(0, 15)}...
              </span>
            </div>
            <div className="flex items-center gap-1">
              {isSuggested && (
                <Badge variant="default" className="text-xs">Suggested</Badge>
              )}
              {isSelected && <CheckCircle className="w-5 h-5 text-primary" />}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining:</span>
              <span className={`font-medium ${hasEnough ? 'text-green-600' : 'text-yellow-600'}`}>
                {bottle.remaining} {unitAbbreviation}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Capacity:</span>
              <span>{bottle.capacity} {unitAbbreviation}</span>
            </div>

            {bottle.openedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opened:</span>
                <span className="text-xs">{formatDate(bottle.openedAt)}</span>
              </div>
            )}

            {bottle.batchNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Batch:</span>
                <span className="font-mono text-xs">{bottle.batchNumber}</span>
              </div>
            )}

            {expiryStatus && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Expires:</span>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <Badge variant={expiryStatus.color} className="text-xs">
                    {expiryStatus.days}d
                  </Badge>
                  {expiryStatus.color === 'destructive' && (
                    <AlertTriangle className="w-3 h-3 text-destructive" />
                  )}
                </div>
              </div>
            )}

            {bottle.salesCount !== undefined && bottle.salesCount > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Sales:</span>
                <div className="flex items-center gap-1">
                  <History className="w-3 h-3" />
                  <span className="text-xs">{bottle.salesCount} transactions</span>
                </div>
              </div>
            )}

            {!hasEnough && (
              <Alert variant="destructive" className="mt-2 py-1 px-2">
                <AlertDescription className="text-xs">
                  Not enough ({bottle.remaining} &lt; {requiredQuantity})
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Select Bottle - {productName}
          </DialogTitle>
          <DialogDescription>
            Choose which bottle to sell {requiredQuantity} {unitAbbreviation} from.
            System suggests FEFO (First Expiry, First Out).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading bottles...</span>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : sortedBottles.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-2">No open bottles found.</p>
              {fullContainers > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {fullContainers} sealed bottle(s) available. A new bottle will be opened automatically.
                </p>
              ) : (
                <p className="text-sm text-destructive">No stock available for this product.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex gap-4 text-sm bg-muted/50 p-3 rounded-lg">
                <div>
                  <span className="text-muted-foreground">Open bottles:</span>
                  <span className="ml-1 font-medium">{sortedBottles.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sealed bottles:</span>
                  <span className="ml-1 font-medium">{fullContainers}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Need:</span>
                  <span className="ml-1 font-medium">{requiredQuantity} {unitAbbreviation}</span>
                </div>
              </div>

              {/* Bottle Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sortedBottles.map((bottle, index) => (
                  <BottleCard
                    key={bottle.id}
                    bottle={bottle}
                    isSuggested={suggestedBottle?.id === bottle.id && index === 0}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t mt-4">
          <Button variant="outline" onClick={handleAutoSelect}>
            Auto Select (FIFO)
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedBottle}
            >
              Use Selected Bottle
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
