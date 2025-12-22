'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Search,
  AlertTriangle,
  RefreshCw,
  Download,
  Package,
  DollarSign,
  FileQuestion,
  ShoppingBag
} from 'lucide-react';

interface UnknownItemRecord {
  transactionId: string;
  transactionNumber: string;
  transactionDate: string;
  customerName: string;
  totalAmount: number;
  paymentStatus: string;
  unknownItems: Array<{
    itemName: string;
    itemType?: string;
    quantity: number;
    totalPrice: number;
    location: string;
  }>;
  unknownItemCount: number;
}

interface ScanStats {
  totalTransactionsScanned: number;
  totalTransactionsWithUnknownItems: number;
  totalUnknownItemsFound: number;
  totalAffectedRevenue: number;
  byLocation: {
    mainItems: number;
    bundleProducts: number;
    customBlendIngredients: number;
  };
  byPaymentStatus: {
    paid: number;
    pending: number;
    partial: number;
    overdue: number;
    failed: number;
  };
}

export default function UnknownItemsScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [unknownItemRecords, setUnknownItemRecords] = useState<UnknownItemRecord[]>([]);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Load unknown item records
  const loadUnknownItems = async () => {
    try {
      setIsScanning(true);
      const response = await fetch('/api/admin/database/unknown-items');
      if (response.ok) {
        const data = await response.json();
        setUnknownItemRecords(data.data || []);
        toast({
          title: 'Scan Complete',
          description: `Found ${data.total} transactions with unknown items`,
        });
      }
    } catch (error) {
      console.error('Error loading unknown items:', error);
      toast({
        title: 'Error',
        description: 'Failed to scan for unknown items',
        variant: 'destructive'
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Load statistics
  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/database/unknown-items?action=stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Start scan
  const startScan = async () => {
    setLoading(true);
    await Promise.all([loadUnknownItems(), loadStats()]);
    setLoading(false);
  };

  // Export CSV
  const exportCSV = async () => {
    try {
      const response = await fetch('/api/admin/database/unknown-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export'
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unknown-items-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        toast({
          title: 'Export Successful',
          description: 'Unknown items data has been exported to CSV',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to export data',
        variant: 'destructive'
      });
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = (transactionId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(transactionId)) {
      newExpandedRows.delete(transactionId);
    } else {
      newExpandedRows.add(transactionId);
    }
    setExpandedRows(newExpandedRows);
  };

  // Get location badge
  const getLocationBadge = (location: string) => {
    const config = {
      main_item: { label: 'Main Item', variant: 'default' as const },
      bundle_product: { label: 'Bundle Product', variant: 'secondary' as const },
      custom_blend_ingredient: { label: 'Blend Ingredient', variant: 'outline' as const }
    };

    const { label, variant } = config[location as keyof typeof config] || config.main_item;

    return <Badge variant={variant}>{label}</Badge>;
  };

  // Get payment status badge
  const getPaymentStatusBadge = (status: string) => {
    const config = {
      paid: { variant: 'outline' as const, className: 'border-green-500 text-green-700' },
      pending: { variant: 'secondary' as const, className: '' },
      partial: { variant: 'default' as const, className: '' },
      overdue: { variant: 'destructive' as const, className: '' },
      failed: { variant: 'destructive' as const, className: '' }
    };

    const { variant, className } = config[status as keyof typeof config] || config.pending;

    return <Badge variant={variant} className={className}>{status}</Badge>;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadUnknownItems(), loadStats()]);
      setLoading(false);
    };
    loadData();
  }, []);

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Compromised Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.totalTransactionsWithUnknownItems || 0}
            </div>
            <div className="text-xs text-gray-500">
              out of {stats?.totalTransactionsScanned || 0} scanned
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileQuestion className="h-4 w-4 text-orange-500" />
              Unknown Items Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalUnknownItemsFound || 0}
            </div>
            <div className="text-xs text-gray-500">
              Total unknown item entries
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              Affected Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats?.totalAffectedRevenue || 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">
              Total transaction value
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-500" />
              Paid Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.byPaymentStatus?.paid || 0}
            </div>
            <div className="text-xs text-gray-500">
              Already paid with unknowns
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location Breakdown */}
      {stats && stats.totalUnknownItemsFound > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Unknown Item Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.byLocation.mainItems}
                </div>
                <div className="text-sm text-gray-600">Main Items</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.byLocation.bundleProducts}
                </div>
                <div className="text-sm text-gray-600">Bundle Products</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.byLocation.customBlendIngredients}
                </div>
                <div className="text-sm text-gray-600">Blend Ingredients</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Unknown Item Scanner
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={startScan}
                disabled={isScanning}
                variant="default"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Scan Transactions
                  </>
                )}
              </Button>
              {unknownItemRecords.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCSV}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600">
            This scanner searches all transactions for items named &quot;Unknown Item&quot; which indicates
            missing product data. Click &quot;Scan Transactions&quot; to identify all compromised transactions.
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions with Unknown Items</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : unknownItemRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="font-semibold">No Unknown Items Found</p>
              <p className="text-sm mt-2">All transactions have properly recorded items</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Unknown Items</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unknownItemRecords.map((record) => (
                    <React.Fragment key={record.transactionId}>
                      <TableRow>
                        <TableCell className="font-mono text-sm">
                          {record.transactionNumber}
                        </TableCell>
                        <TableCell>
                          {new Date(record.transactionDate).toLocaleDateString('en-GB')}
                        </TableCell>
                        <TableCell>{record.customerName}</TableCell>
                        <TableCell className="font-mono">
                          ${record.totalAmount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {getPaymentStatusBadge(record.paymentStatus)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {record.unknownItemCount} item{record.unknownItemCount > 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleRowExpansion(record.transactionId)}
                          >
                            {expandedRows.has(record.transactionId) ? 'Hide' : 'View'} Details
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(record.transactionId) && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-gray-50">
                            <div className="p-4 space-y-2">
                              <h4 className="font-semibold text-sm mb-2">Unknown Items:</h4>
                              <div className="space-y-2">
                                {record.unknownItems.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between border rounded p-2 bg-white">
                                    <div className="flex-1">
                                      <div className="font-medium text-sm">{item.itemName}</div>
                                      <div className="text-xs text-gray-500">
                                        Quantity: {item.quantity} | Price: ${item.totalPrice.toFixed(2)}
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      {getLocationBadge(item.location)}
                                      {item.itemType && (
                                        <Badge variant="outline" className="text-xs">
                                          {item.itemType}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
