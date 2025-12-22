'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  AlertCircle,
  DollarSign,
  Search,
  Download,
  Mail,
  Star
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface CustomerInsight {
  id: string;
  name: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: string;
  firstOrderDate: string;
  daysSinceLastOrder: number;
  purchaseFrequency: number;
  favoriteProducts: string[];
  churnRiskScore: number;
  churnRiskLevel: 'low' | 'medium' | 'high';
  segment: string;
  lifetimeValue: number;
  recommendedActions: string[];
}

export default function CustomerInsightsPage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerInsight[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerInsight[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('churnRisk');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerInsight | null>(null);

  useEffect(() => {
    fetchCustomerInsights();
  }, []);

  useEffect(() => {
    filterAndSortCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, searchQuery, riskFilter, segmentFilter, sortBy]);

  const fetchCustomerInsights = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reports/customer-insights');
      if (!response.ok) throw new Error('Failed to fetch customer insights');
      
      const data = await response.json();
      setCustomers(data.customers);
    } catch {
      console.error('Error fetching customer insights');
      toast.error('Failed to load customer insights');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCustomers = () => {
    let filtered = [...customers];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Risk filter
    if (riskFilter !== 'all') {
      filtered = filtered.filter(c => c.churnRiskLevel === riskFilter);
    }

    // Segment filter
    if (segmentFilter !== 'all') {
      filtered = filtered.filter(c => c.segment === segmentFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'churnRisk':
          return b.churnRiskScore - a.churnRiskScore;
        case 'value':
          return b.lifetimeValue - a.lifetimeValue;
        case 'recent':
          return a.daysSinceLastOrder - b.daysSinceLastOrder;
        case 'frequency':
          return a.purchaseFrequency - b.purchaseFrequency;
        default:
          return 0;
      }
    });

    setFilteredCustomers(filtered);
  };

  const exportReport = () => {
    // Convert to CSV
    const headers = ['Name', 'Email', 'Total Orders', 'Total Spent', 'Last Order', 'Churn Risk', 'Segment'];
    const rows = filteredCustomers.map(c => [
      c.name,
      c.email,
      c.totalOrders,
      c.totalSpent.toFixed(2),
      format(new Date(c.lastOrderDate), 'yyyy-MM-dd'),
      c.churnRiskLevel,
      c.segment
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-insights-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const sendTargetedCampaign = async (customerId: string) => {
    try {
      const response = await fetch('/api/marketing/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, type: 'retention' })
      });
      
      if (!response.ok) throw new Error('Failed to send campaign');
      toast.success('Retention campaign sent successfully');
    } catch {
      console.error('Error sending campaign');
      toast.error('Failed to send campaign');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <h1 className="text-3xl font-bold mb-6">Customer Insights</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Calculate summary statistics
  const summary = {
    totalCustomers: customers.length,
    atRiskCustomers: customers.filter(c => c.churnRiskLevel === 'high').length,
    vipCustomers: customers.filter(c => c.segment === 'VIP').length,
    averageLifetimeValue: customers.reduce((sum, c) => sum + c.lifetimeValue, 0) / customers.length || 0
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Customer Insights</h1>
          <p className="text-muted-foreground mt-1">
            Analyze customer behavior and identify opportunities
          </p>
        </div>
        <Button onClick={exportReport}>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              Active in last 90 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {summary.atRiskCustomers}
            </div>
            <p className="text-xs text-muted-foreground">
              High churn risk customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VIP Customers</CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.vipCustomers}</div>
            <p className="text-xs text-muted-foreground">
              High-value loyal customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Lifetime Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary.averageLifetimeValue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per customer average
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Churn Risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
                <SelectItem value="medium">Medium Risk</SelectItem>
                <SelectItem value="low">Low Risk</SelectItem>
              </SelectContent>
            </Select>

            <Select value={segmentFilter} onValueChange={setSegmentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Segments</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
                <SelectItem value="Regular">Regular</SelectItem>
                <SelectItem value="Occasional">Occasional</SelectItem>
                <SelectItem value="New">New</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="churnRisk">Churn Risk</SelectItem>
                <SelectItem value="value">Lifetime Value</SelectItem>
                <SelectItem value="recent">Recent Activity</SelectItem>
                <SelectItem value="frequency">Purchase Frequency</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-sm text-muted-foreground flex items-center">
              Showing {filteredCustomers.length} of {customers.length} customers
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
          <CardDescription>
            Click on a customer to view detailed insights and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-center">Orders</TableHead>
                <TableHead className="text-right">Lifetime Value</TableHead>
                <TableHead className="text-center">Last Order</TableHead>
                <TableHead className="text-center">Churn Risk</TableHead>
                <TableHead className="text-center">Segment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow 
                  key={customer.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-muted-foreground">{customer.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{customer.totalOrders}</TableCell>
                  <TableCell className="text-right">${customer.lifetimeValue.toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    <div>
                      <p className="text-sm">{format(new Date(customer.lastOrderDate), 'MMM d, yyyy')}</p>
                      <p className="text-xs text-muted-foreground">
                        {customer.daysSinceLastOrder} days ago
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={
                        customer.churnRiskLevel === 'high' ? 'destructive' :
                        customer.churnRiskLevel === 'medium' ? 'secondary' :
                        'default'
                      }
                    >
                      {customer.churnRiskScore}% Risk
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{customer.segment}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        sendTargetedCampaign(customer.id);
                      }}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{selectedCustomer.name}</CardTitle>
                <CardDescription>{selectedCustomer.email}</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCustomer(null)}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Purchase Behavior */}
              <div className="space-y-4">
                <h3 className="font-semibold">Purchase Behavior</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Orders</span>
                    <span className="font-medium">{selectedCustomer.totalOrders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Spent</span>
                    <span className="font-medium">${selectedCustomer.totalSpent.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg Order Value</span>
                    <span className="font-medium">${selectedCustomer.averageOrderValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Purchase Frequency</span>
                    <span className="font-medium">Every {selectedCustomer.purchaseFrequency} days</span>
                  </div>
                </div>
              </div>

              {/* Risk Analysis */}
              <div className="space-y-4">
                <h3 className="font-semibold">Risk Analysis</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Churn Risk</span>
                      <span className="text-sm font-medium">{selectedCustomer.churnRiskScore}%</span>
                    </div>
                    <Progress 
                      value={selectedCustomer.churnRiskScore} 
                      className={`h-2 ${
                        selectedCustomer.churnRiskLevel === 'high' ? 'bg-red-200' :
                        selectedCustomer.churnRiskLevel === 'medium' ? 'bg-yellow-200' :
                        'bg-green-200'
                      }`}
                    />
                  </div>
                  <div className="text-sm space-y-1">
                    <p>Customer Since: {format(new Date(selectedCustomer.firstOrderDate), 'MMM yyyy')}</p>
                    <p>Days Since Last Order: {selectedCustomer.daysSinceLastOrder}</p>
                  </div>
                </div>
              </div>

              {/* Recommended Actions */}
              <div className="space-y-4">
                <h3 className="font-semibold">Recommended Actions</h3>
                <div className="space-y-2">
                  {selectedCustomer.recommendedActions.map((action, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                      <p className="text-sm">{action}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 pt-4">
                  <Button className="w-full" size="sm">
                    Send Personalized Offer
                  </Button>
                  <Button className="w-full" size="sm" variant="outline">
                    Schedule Follow-up
                  </Button>
                </div>
              </div>
            </div>

            {/* Favorite Products */}
            {selectedCustomer.favoriteProducts.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Favorite Products</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCustomer.favoriteProducts.map((product, index) => (
                    <Badge key={index} variant="secondary">
                      {product}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}