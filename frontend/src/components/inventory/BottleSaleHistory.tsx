'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { History, Loader2, AlertTriangle, User, Package } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { containersService } from '@/services/api/containers.service';
import type { SaleHistoryEntry } from '@/types/container';

interface BottleSaleHistoryProps {
  productId: string;
  containerId: string;
  compact?: boolean;
  className?: string;
}

export default function BottleSaleHistory({
  productId,
  containerId,
  compact = false,
  className = '',
}: BottleSaleHistoryProps) {
  const [history, setHistory] = useState<SaleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    productName: string;
    openedAt?: string;
    capacity: number;
    currentRemaining: number;
    totalSold: number;
  } | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await containersService.getContainerSaleHistory(productId, containerId);
      setHistory(data.saleHistory);
      setMeta({
        productName: data.productName,
        openedAt: data.openedAt,
        capacity: data.capacity,
        currentRemaining: data.currentRemaining,
        totalSold: data.totalSold,
      });
    } catch (err) {
      console.error('Failed to fetch sale history:', err);
      setError('Failed to load sale history');
    } finally {
      setLoading(false);
    }
  }, [productId, containerId]);

  useEffect(() => {
    if (productId && containerId) {
      fetchHistory();
    }
  }, [productId, containerId, fetchHistory]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-4 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription className="text-sm">{error}</AlertDescription>
      </Alert>
    );
  }

  if (history.length === 0) {
    return (
      <div className={`text-center py-4 text-muted-foreground text-sm ${className}`}>
        <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
        No sales recorded yet for this bottle.
      </div>
    );
  }

  if (compact) {
    // Compact view for inline display
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span className="flex items-center gap-1">
            <History className="w-4 h-4" />
            Sale History ({history.length})
          </span>
          {meta && (
            <span>Total sold: {meta.totalSold}</span>
          )}
        </div>
        <div className="space-y-1">
          {history.slice(0, 5).map((entry, index) => (
            <div
              key={`${entry.transactionRef}-${index}`}
              className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {entry.transactionRef.substring(0, 20)}
                </span>
                <Badge variant="outline" className="text-xs">
                  -{entry.quantitySold}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDateShort(entry.soldAt)}
              </span>
            </div>
          ))}
          {history.length > 5 && (
            <div className="text-xs text-muted-foreground text-center pt-1">
              +{history.length - 5} more transactions
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with summary */}
      {meta && (
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h4 className="font-medium flex items-center gap-2">
              <History className="w-4 h-4" />
              Sale History
            </h4>
            <p className="text-sm text-muted-foreground">
              {meta.productName} - Bottle {containerId.substring(0, 15)}...
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="text-muted-foreground">Total sold</div>
            <div className="font-bold text-lg">{meta.totalSold}</div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      {meta && (
        <div className="grid grid-cols-3 gap-4 bg-muted/30 p-3 rounded-lg text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Opened</div>
            <div>{meta.openedAt ? formatDateShort(meta.openedAt) : 'N/A'}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Remaining</div>
            <div>{meta.currentRemaining} / {meta.capacity}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Transactions</div>
            <div>{history.length}</div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        {history.map((entry, index) => (
          <div
            key={`${entry.transactionRef}-${index}`}
            className="flex gap-3 relative"
          >
            {/* Timeline line */}
            {index < history.length - 1 && (
              <div className="absolute left-[11px] top-6 w-0.5 h-[calc(100%-4px)] bg-muted" />
            )}

            {/* Timeline dot */}
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 relative z-10">
              <Package className="w-3 h-3 text-primary" />
            </div>

            {/* Content */}
            <div className="flex-1 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">
                      {entry.transactionRef}
                    </span>
                    {entry.transactionRef.startsWith('ADJUSTMENT') ? (
                      <Badge variant="secondary" className="text-xs">Adjustment</Badge>
                    ) : entry.transactionRef.startsWith('CANCEL') ? (
                      <Badge variant="destructive" className="text-xs">Cancelled</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Sale</Badge>
                    )}
                  </div>
                  {entry.soldBy && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <User className="w-3 h-3" />
                      {entry.soldBy}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-medium text-sm">
                    {entry.quantitySold > 0 ? `-${entry.quantitySold}` : `+${Math.abs(entry.quantitySold)}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(entry.soldAt)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
