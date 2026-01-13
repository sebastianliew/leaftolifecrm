'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Calendar, AlertTriangle, History, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { containersService } from '@/services/api/containers.service';
import type { Bottle } from '@/types/container';
import BottleSaleHistory from './BottleSaleHistory';

interface OpenBottlesPanelProps {
  productId: string;
  productName: string;
  className?: string;
}

export default function OpenBottlesPanel({
  productId,
  productName,
  className = '',
}: OpenBottlesPanelProps) {
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [fullContainers, setFullContainers] = useState(0);
  const [containerCapacity, setContainerCapacity] = useState(0);
  const [unitAbbreviation, setUnitAbbreviation] = useState('units');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    totalFull: number;
    totalPartial: number;
    totalEmpty: number;
    totalRemaining: number;
  } | null>(null);

  const fetchBottles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await containersService.getProductContainers(productId, { includeEmpty: true });
      setBottles(data.containers);
      setFullContainers(data.fullContainers);
      setContainerCapacity(data.containerCapacity);
      setUnitAbbreviation(data.unitOfMeasurement?.abbreviation || 'units');
      setSummary(data.summary);
    } catch (err) {
      console.error('Failed to fetch bottles:', err);
      setError('Failed to load bottles');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (productId) {
      fetchBottles();
    }
  }, [productId, fetchBottles]);

  const getStatusBadge = (status: Bottle['status']) => {
    switch (status) {
      case 'full':
        return <Badge variant="default" className="bg-green-100 text-green-800">Full</Badge>;
      case 'partial':
        return <Badge variant="secondary">Partial</Badge>;
      case 'empty':
        return <Badge variant="outline" className="text-muted-foreground">Empty</Badge>;
      case 'oversold':
        return <Badge variant="destructive">Oversold</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getExpiryBadge = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const daysDiff = Math.floor((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 0) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />Expired</Badge>;
    }
    if (daysDiff < 7) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />{daysDiff}d left</Badge>;
    }
    if (daysDiff < 30) {
      return <Badge variant="secondary">{daysDiff}d left</Badge>;
    }
    return null;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  const getUsagePercent = (bottle: Bottle) => {
    if (bottle.capacity <= 0) return 0;
    return Math.max(0, Math.min(100, (bottle.remaining / bottle.capacity) * 100));
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading bottles...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Package className="w-5 h-5" />
          Open Bottles - {productName}
        </h3>
        <Button variant="outline" size="sm" onClick={fetchBottles}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Summary Card */}
      {summary && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Sealed Bottles</div>
                <div className="text-2xl font-bold text-green-600">{fullContainers}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Open Bottles</div>
                <div className="text-2xl font-bold text-blue-600">{summary.totalPartial}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Empty</div>
                <div className="text-2xl font-bold text-muted-foreground">{summary.totalEmpty}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Total Remaining</div>
                <div className="text-2xl font-bold">{summary.totalRemaining} {unitAbbreviation}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Bottle Size</div>
                <div className="text-2xl font-bold">{containerCapacity} {unitAbbreviation}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottles List */}
      {bottles.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No open bottles for this product.</p>
            {fullContainers > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {fullContainers} sealed bottle(s) available in stock.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bottles.map((bottle) => (
            <Card key={bottle.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Left side - Bottle info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm truncate">{bottle.id}</span>
                      {getStatusBadge(bottle.status)}
                      {getExpiryBadge(bottle.expiryDate)}
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{bottle.remaining} {unitAbbreviation} remaining</span>
                        <span>{bottle.capacity} {unitAbbreviation} capacity</span>
                      </div>
                      <Progress value={getUsagePercent(bottle)} className="h-2" />
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {bottle.openedAt && (
                        <div>
                          <div className="text-muted-foreground text-xs">Opened</div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(bottle.openedAt)}
                          </div>
                        </div>
                      )}
                      {bottle.batchNumber && (
                        <div>
                          <div className="text-muted-foreground text-xs">Batch</div>
                          <div className="font-mono text-xs">{bottle.batchNumber}</div>
                        </div>
                      )}
                      {bottle.expiryDate && (
                        <div>
                          <div className="text-muted-foreground text-xs">Expires</div>
                          <div>{formatDate(bottle.expiryDate)}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-muted-foreground text-xs">Sales</div>
                        <div className="flex items-center gap-1">
                          <History className="w-3 h-3" />
                          {bottle.salesCount || 0} transactions
                        </div>
                      </div>
                    </div>

                    {bottle.notes && (
                      <div className="mt-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                        {bottle.notes}
                      </div>
                    )}
                  </div>

                  {/* Right side - Actions */}
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedBottleId(bottle.id === selectedBottleId ? null : bottle.id)}
                    >
                      <History className="w-4 h-4 mr-1" />
                      History
                      <ChevronRight className={`w-4 h-4 ml-1 transition-transform ${
                        selectedBottleId === bottle.id ? 'rotate-90' : ''
                      }`} />
                    </Button>
                  </div>
                </div>

                {/* Sale History (expandable) */}
                {selectedBottleId === bottle.id && (
                  <div className="mt-4 pt-4 border-t">
                    <BottleSaleHistory
                      productId={productId}
                      containerId={bottle.id}
                      compact
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
