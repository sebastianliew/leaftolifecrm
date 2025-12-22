'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  Play,
  AlertCircle,
  DollarSign,
  Shield
} from 'lucide-react';

interface AnomalyRecord {
  _id: string;
  transactionNumber: string;
  transactionDate: string;
  metadata: {
    customerName: string;
    totalAmount: number;
    paymentStatus: string;
    transactionDate?: Date;
  };
  anomalies: Array<{
    itemName: string;
    anomalyType: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    details: {
      lossAmount?: number;
      message?: string;
    };
  }>;
  estimatedLoss: number;
  status: string;
}

interface ScanJob {
  _id: string;
  status: string;
  progress: {
    totalTransactions: number;
    processedTransactions: number;
    foundAnomalies: number;
  };
  startedAt: string;
  completedAt?: string;
}

interface AnomalyStats {
  total: number;
  bySeverity: Record<string, number>;
  totalEstimatedLoss: number;
  fixedCount: number;
  pendingCount: number;
}

export default function TransactionAnomaliesTab() {
  const [isScanning, setIsScanning] = useState(false);
  const [currentJob, setCurrentJob] = useState<ScanJob | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
  const [stats, setStats] = useState<AnomalyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnomalies, setSelectedAnomalies] = useState<string[]>([]);

  // Scan configuration
  const [batchSize, setBatchSize] = useState('50');
  const [dateRange, setDateRange] = useState('30');
  const [dryRun, setDryRun] = useState(false);
  const [showFixDialog, setShowFixDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearReason, setClearReason] = useState('');

  // Load anomaly data
  const loadAnomalies = async () => {
    try {
      const response = await fetch('/api/admin/database/transaction-anomalies');
      if (response.ok) {
        const data = await response.json();
        setAnomalies(data.data || []);
      }
    } catch (error) {
      console.error('Error loading anomalies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load anomaly data',
        variant: 'destructive'
      });
    }
  };

  // Load statistics
  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/database/transaction-anomalies?action=stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Check job status
  const checkJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/admin/database/transaction-anomalies?action=job-status&jobId=${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentJob(data);

        if (data.status === 'processing') {
          // Continue polling
          setTimeout(() => checkJobStatus(jobId), 2000);
        } else {
          setIsScanning(false);
          loadAnomalies();
          loadStats();
        }
      }
    } catch (error) {
      console.error('Error checking job status:', error);
      setIsScanning(false);
    }
  };

  // Start scan
  const startScan = async () => {
    setIsScanning(true);

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      const response = await fetch('/api/admin/database/transaction-anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_scan',
          batchSize: parseInt(batchSize),
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
          dryRun
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Scan Started',
          description: 'Transaction anomaly scan has been initiated',
        });
        checkJobStatus(data.jobId);
      } else {
        throw new Error('Failed to start scan');
      }
    } catch {
      setIsScanning(false);
      toast({
        title: 'Error',
        description: 'Failed to start anomaly scan',
        variant: 'destructive'
      });
    }
  };

  // Apply fixes
  const applyFixes = async () => {
    if (selectedAnomalies.length === 0) return;

    try {
      const response = await fetch('/api/admin/database/transaction-anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_fixes',
          anomalyIds: selectedAnomalies,
          fixes: selectedAnomalies.map(id => ({
            anomalyId: id,
            action: 'auto_fix'
          })),
          userId: 'admin'
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Fixes Applied',
          description: `Successfully fixed ${data.fixedCount} anomalies`,
        });
        setSelectedAnomalies([]);
        loadAnomalies();
        loadStats();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to apply fixes',
        variant: 'destructive'
      });
    }
    setShowFixDialog(false);
  };

  // Mark as cleared
  const markAsCleared = async () => {
    if (!clearReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for clearing',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/admin/database/transaction-anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_as_cleared',
          anomalyIds: selectedAnomalies,
          reason: clearReason
        })
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: data.message
        });
        setSelectedAnomalies([]);
        setClearReason('');
        setShowClearDialog(false);
        loadAnomalies();
        loadStats();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to mark as cleared',
          variant: 'destructive'
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to mark anomalies as cleared',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Export CSV
  const exportCSV = async () => {
    try {
      const response = await fetch('/api/admin/database/transaction-anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          anomalyIds: selectedAnomalies.length > 0 ? selectedAnomalies : undefined
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `anomalies-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to export data',
        variant: 'destructive'
      });
    }
  };

  // Get severity badge
  const getSeverityBadge = (severity: string) => {
    const config = {
      critical: { variant: 'destructive' as const, icon: AlertTriangle },
      high: { variant: 'default' as const, icon: AlertCircle },
      medium: { variant: 'secondary' as const, icon: AlertCircle },
      low: { variant: 'outline' as const, icon: AlertCircle }
    };

    const { variant, icon: Icon } = config[severity as keyof typeof config] || config.medium;

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {severity}
      </Badge>
    );
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadAnomalies(), loadStats()]);
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
              Total Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <div className="text-xs text-gray-500">
              {stats?.pendingCount || 0} pending review
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-orange-500" />
              Estimated Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats?.totalEstimatedLoss || 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">
              Across all anomalies
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Fixed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.fixedCount || 0}</div>
            <div className="text-xs text-gray-500">
              Successfully resolved
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              Critical Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.bySeverity?.critical || 0}
            </div>
            <div className="text-xs text-gray-500">
              Require immediate attention
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scan Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Anomaly Scanner
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!confirm('This will reset all scan records and anomaly data. Are you sure?')) return;

                try {
                  const response = await fetch('/api/admin/database/transaction-anomalies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'reset_scan_records',
                      clearAnomalies: true,
                      clearScanStatus: true
                    })
                  });

                  if (response.ok) {
                    toast({
                      title: "Reset Complete",
                      description: "All scan records have been cleared",
                      variant: "success"
                    });
                    loadAnomalies();
                    loadStats();
                  }
                } catch {
                  toast({
                    title: "Error",
                    description: "Failed to reset scan records",
                    variant: "destructive"
                  });
                }
              }}
            >
              Reset Records
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="batch-size">Batch Size</Label>
              <Select value={batchSize} onValueChange={setBatchSize}>
                <SelectTrigger id="batch-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 transactions</SelectItem>
                  <SelectItem value="50">50 transactions</SelectItem>
                  <SelectItem value="100">100 transactions</SelectItem>
                  <SelectItem value="200">200 transactions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date-range">Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger id="date-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="dry-run"
                  checked={dryRun}
                  onCheckedChange={setDryRun}
                />
                <Label htmlFor="dry-run">Dry Run</Label>
              </div>
            </div>

            <div className="flex items-end">
              <Button
                onClick={startScan}
                disabled={isScanning}
                className="w-full"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Scan
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          {currentJob && currentJob.status === 'processing' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing transactions...</span>
                <span>
                  {currentJob.progress.processedTransactions} / {currentJob.progress.totalTransactions}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${(currentJob.progress.processedTransactions / currentJob.progress.totalTransactions) * 100}%`
                  }}
                />
              </div>
              <div className="text-sm text-gray-500">
                Found {currentJob.progress.foundAnomalies} anomalies
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Anomalies Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Detected Anomalies</CardTitle>
            <div className="flex gap-2">
              {selectedAnomalies.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowClearDialog(true)}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Mark Cleared ({selectedAnomalies.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFixDialog(true)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Fix Selected ({selectedAnomalies.length})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAnomalies([])}
                  >
                    Clear Selection
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={exportCSV}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : anomalies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No anomalies detected</p>
              <p className="text-sm mt-2">Run a scan to detect transaction anomalies</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedAnomalies.length === anomalies.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAnomalies(anomalies.map(a => a._id));
                          } else {
                            setSelectedAnomalies([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Est. Loss</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anomalies.map((record) => (
                    <TableRow key={record._id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedAnomalies.includes(record._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAnomalies([...selectedAnomalies, record._id]);
                            } else {
                              setSelectedAnomalies(selectedAnomalies.filter(id => id !== record._id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {record.transactionNumber}
                      </TableCell>
                      <TableCell>{record.metadata.customerName}</TableCell>
                      <TableCell>
                        {record.metadata?.transactionDate
                          ? new Date(record.metadata.transactionDate).toLocaleDateString('en-GB')
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {record.anomalies.slice(0, 2).map((anomaly, idx) => (
                            <div key={idx} className="text-xs">
                              {anomaly.anomalyType.replace(/_/g, ' ')}
                            </div>
                          ))}
                          {record.anomalies.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{record.anomalies.length - 2} more
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {[...new Set(record.anomalies.map(a => a.severity))].map(severity => (
                            <div key={severity}>
                              {getSeverityBadge(severity)}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        ${record.estimatedLoss.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            record.status === 'fixed' ? 'outline' :
                            record.status === 'cleared' ? 'default' :
                            'secondary'
                          }
                        >
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.status === 'detected' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedAnomalies([record._id]);
                              setShowClearDialog(true);
                            }}
                          >
                            Clear
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Anomaly as Cleared?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the selected {selectedAnomalies.length > 1 ? `${selectedAnomalies.length} anomalies` : 'anomaly'} as verified false positive{selectedAnomalies.length > 1 ? 's' : ''}.
              They will be skipped in future scans.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Reason for clearing:</label>
            <textarea
              className="w-full mt-2 p-2 border rounded-md"
              rows={3}
              placeholder="e.g., Old pricing data, product price recently updated"
              value={clearReason}
              onChange={(e) => setClearReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClearReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={markAsCleared} disabled={!clearReason.trim()}>
              Mark as Cleared
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fix Confirmation Dialog */}
      <AlertDialog open={showFixDialog} onOpenChange={setShowFixDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Fixes to Selected Anomalies?</AlertDialogTitle>
            <AlertDialogDescription>
              This will attempt to fix {selectedAnomalies.length} selected anomalies.
              Some fixes may require manual review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyFixes}>Apply Fixes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}