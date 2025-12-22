'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ShoppingCart, 
  Star, 
  AlertCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { usePurchaseHistoryQuery, useToggleFavoriteMutation, useQuickReorderMutation } from '@/hooks/queries/use-customer-queries';

interface PurchaseHistoryTabProps {
  customerId: string;
}

export function PurchaseHistoryTab({ customerId }: PurchaseHistoryTabProps) {
  // Use TanStack Query hooks
  const { data: purchaseData, isLoading: loading, error } = usePurchaseHistoryQuery(customerId, true);
  const toggleFavoriteMutation = useToggleFavoriteMutation();
  const quickReorderMutation = useQuickReorderMutation();

  const handleQuickReorder = async (transactionId: string) => {
    try {
      const data = await quickReorderMutation.mutateAsync({ 
        transactionId,
        customerId,
        createDraft: true 
      });
      
      toast.success('Draft transaction created for reorder');
      // Redirect to transaction page
      window.location.href = `/transactions/${data.transaction._id}`;
    } catch {
      console.error('Error creating reorder');
      toast.error('Failed to create reorder');
    }
  };

  const handleToggleFavorite = async (itemId: string, itemType: string, currentStatus: boolean) => {
    try {
      await toggleFavoriteMutation.mutateAsync({ 
        customerId,
        itemId,
        itemType,
        action: currentStatus ? 'remove' : 'add'
      });
      
      toast.success(currentStatus ? 'Removed from favorites' : 'Added to favorites');
    } catch {
      console.error('Error updating favorite');
      toast.error('Failed to update favorite');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <p className="text-red-600">Failed to load purchase history</p>
          <p className="text-sm text-muted-foreground mt-2">Please try again later</p>
        </CardContent>
      </Card>
    );
  }

  if (!purchaseData) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No purchase history available</p>
        </CardContent>
      </Card>
    );
  }

  const { patterns, insights, upcomingReminders } = purchaseData;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights?.insights?.totalOrders || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg frequency: {insights?.insights?.averagePurchaseFrequency?.toFixed(1) || 0} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Favorite Items</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights?.favorites?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Most ordered products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reorder Due</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {upcomingReminders?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Items to reorder soon
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Risk</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights?.insights?.churnRisk || 0}%
            </div>
            <Badge variant={
              insights?.insights?.churnRisk > 70 ? 'destructive' : 
              insights?.insights?.churnRisk > 40 ? 'secondary' : 
              'default'
            }>
              {insights?.insights?.churnRisk > 70 ? 'High Risk' : 
               insights?.insights?.churnRisk > 40 ? 'Medium Risk' : 
               'Low Risk'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="patterns">Purchase Patterns</TabsTrigger>
          <TabsTrigger value="reminders">Reorder Reminders</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Purchases</CardTitle>
              <CardDescription>Latest items purchased by this customer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {patterns?.slice(0, 5).map((pattern) => (
                  <div key={pattern._id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium">{pattern.itemName}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>Purchased {pattern.purchaseCount} times</span>
                        <span>Last: {format(new Date(pattern.lastPurchaseDate), 'MMM d, yyyy')}</span>
                        <span>Total: S${pattern.totalSpent.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleFavorite(pattern.itemId, pattern.itemType, pattern.isFavorite)}
                      >
                        <Star className={`h-4 w-4 ${pattern.isFavorite ? 'fill-current' : ''}`} />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleQuickReorder(pattern.itemId)}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Reorder
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="favorites">
          <Card>
            <CardHeader>
              <CardTitle>Favorite Items</CardTitle>
              <CardDescription>Frequently purchased products marked as favorites</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights?.favorites?.map((item) => (
                  <div key={item._id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{item.itemName}</p>
                        <Badge variant="outline" className="mt-1">
                          {item.itemType}
                        </Badge>
                      </div>
                      <Star className="h-5 w-5 fill-current text-yellow-500" />
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Orders: {item.purchaseCount}</p>
                      <p>Avg spend: S${item.averageOrderValue?.toFixed(2) || '0.00'}</p>
                      <p>Next expected: {
                        item.nextExpectedPurchase 
                          ? format(new Date(item.nextExpectedPurchase), 'MMM d, yyyy')
                          : 'N/A'
                      }</p>
                    </div>
                    <Button 
                      className="w-full" 
                      size="sm"
                      onClick={() => handleQuickReorder(item.itemId)}
                    >
                      Quick Reorder
                    </Button>
                  </div>
                ))}
              </div>
              {(!insights?.favorites || insights.favorites.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No favorite items yet. Items purchased 3+ times are automatically marked as favorites.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Patterns</CardTitle>
              <CardDescription>Detailed analysis of buying behavior</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Top Categories */}
                <div>
                  <h4 className="font-medium mb-3">Top Categories</h4>
                  <div className="space-y-2">
                    {insights?.insights?.topCategories?.map((category: string, index: number) => (
                      <div key={category} className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="text-sm">{category}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Purchase Timeline */}
                <div>
                  <h4 className="font-medium mb-3">Purchase Timeline</h4>
                  <div className="space-y-2">
                    {patterns?.slice(0, 10).map((pattern) => (
                      <div key={pattern._id} className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span>{pattern.itemName}</span>
                          <span className="text-muted-foreground">
                            Every {pattern.averagePurchaseInterval || 'N/A'} days
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary"
                            style={{ width: `${Math.min((pattern.purchaseCount / 20) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders">
          <Card>
            <CardHeader>
              <CardTitle>Reorder Reminders</CardTitle>
              <CardDescription>Upcoming items that may need reordering</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingReminders?.map((reminder) => (
                  <div key={reminder._id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{reminder.itemName}</p>
                      <p className="text-sm text-muted-foreground">
                        Expected: {format(new Date(reminder.reminderDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={reminder.status === 'pending' ? 'default' : 'secondary'}>
                        {reminder.status}
                      </Badge>
                      <Button size="sm" variant="outline">
                        Set Reminder
                      </Button>
                    </div>
                  </div>
                ))}
                {(!upcomingReminders || upcomingReminders.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    No upcoming reorder reminders
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}