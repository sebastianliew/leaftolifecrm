'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp, Package, DollarSign, Users, BarChart3, PieChart, Calendar, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Progress } from '@/components/ui/progress';

interface BlendAnalyticsData {
  blendTemplates: Array<{
    _id: string;
    name: string;
    category: string;
    usageCount: number;
    lastUsed: Date;
    totalRevenue: number;
    averagePrice: number;
    profitMargin: number;
    ingredients: Array<{
      name: string;
      quantity: number;
      unitName: string;
    }>;
  }>;
  customBlends: Array<{
    _id: string;
    blendName: string;
    customerName: string;
    usageCount: number;
    totalRevenue: number;
    marginPercent: number;
    createdAt: Date;
  }>;
  ingredients: Array<{
    name: string;
    totalUsed: number;
    unitName: string;
    revenueGenerated: number;
    blendsCount: number;
  }>;
  summary: {
    totalBlends: number;
    totalRevenue: number;
    averageMargin: number;
    topPerformingCategory: string;
    totalCustomers: number;
    repeatCustomers: number;
  };
}

interface BlendAnalyticsDashboardProps {
  data: BlendAnalyticsData;
  onRefresh: () => void;
  className?: string;
}

export default function BlendAnalyticsDashboard({
  data,
  onRefresh,
  className = ''
}: BlendAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState('30d');
  // const [_categoryFilter, _setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'overview' | 'templates' | 'ingredients' | 'customers'>('overview');

  // Process data for charts
  const chartData = useMemo(() => {
    const categoryStats = data.blendTemplates.reduce((acc, blend) => {
      const category = blend.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = {
          count: 0,
          revenue: 0,
          margin: 0
        };
      }
      acc[category].count += blend.usageCount;
      acc[category].revenue += blend.totalRevenue;
      acc[category].margin += blend.profitMargin * blend.usageCount;
      return acc;
    }, {} as Record<string, { count: number; revenue: number; margin: number }>);

    const topIngredients = data.ingredients
      .sort((a, b) => b.revenueGenerated - a.revenueGenerated)
      .slice(0, 10);

    const recentActivity = [...data.blendTemplates, ...data.customBlends]
      .sort((a, b) => {
        const dateA = 'lastUsed' in a ? a.lastUsed : a.createdAt;
        const dateB = 'lastUsed' in b ? b.lastUsed : b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      })
      .slice(0, 5);

    return {
      categoryStats,
      topIngredients,
      recentActivity
    };
  }, [data]);

  const StatCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    trend, 
    color = 'blue' 
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ComponentType<{ className?: string }>;
    trend?: { direction: 'up' | 'down'; percentage: number };
    color?: string;
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-full bg-${color}-100`}>
            <Icon className={`w-6 h-6 text-${color}-600`} />
          </div>
        </div>
        {trend && (
          <div className="mt-4 flex items-center">
            <TrendingUp className={`w-4 h-4 mr-1 ${
              trend.direction === 'up' ? 'text-green-500' : 'text-red-500'
            }`} />
            <span className={`text-sm font-medium ${
              trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend.percentage}%
            </span>
            <span className="text-sm text-gray-500 ml-1">vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Blends Created"
          value={data.summary.totalBlends}
          icon={Package}
          trend={{ direction: 'up', percentage: 12 }}
          color="blue"
        />
        <StatCard
          title="Total Revenue"
          value={`$${data.summary.totalRevenue.toFixed(2)}`}
          icon={DollarSign}
          trend={{ direction: 'up', percentage: 8 }}
          color="green"
        />
        <StatCard
          title="Average Margin"
          value={`${data.summary.averageMargin.toFixed(1)}%`}
          icon={TrendingUp}
          trend={{ direction: 'up', percentage: 3 }}
          color="purple"
        />
        <StatCard
          title="Unique Customers"
          value={data.summary.totalCustomers}
          subtitle={`${data.summary.repeatCustomers} returning`}
          icon={Users}
          color="orange"
        />
      </div>

      {/* Category Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Performance by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(chartData.categoryStats).map(([category, stats]) => {
              const percentage = (stats.revenue / data.summary.totalRevenue) * 100;
              return (
                <div key={category} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{category}</span>
                      <Badge variant="outline">{stats.count} blends</Badge>
                    </div>
                    <span className="text-sm text-gray-600">
                      ${stats.revenue.toFixed(2)} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Ingredients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Top Revenue-Generating Ingredients
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {chartData.topIngredients.map((ingredient, index) => (
              <div key={ingredient.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{ingredient.name}</div>
                    <div className="text-sm text-gray-500">
                      Used in {ingredient.blendsCount} blends
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">${ingredient.revenueGenerated.toFixed(2)}</div>
                  <div className="text-sm text-gray-500">
                    {ingredient.totalUsed} {ingredient.unitName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const TemplatesTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Blend Template Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.blendTemplates
              .sort((a, b) => b.totalRevenue - a.totalRevenue)
              .map(template => (
                <div key={template._id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{template.name}</span>
                      <Badge variant="outline">{template.category}</Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      Used {template.usageCount} times • Last used {new Date(template.lastUsed).toLocaleDateString('en-GB')}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {template.ingredients.length} ingredients: {template.ingredients.map(i => i.name).join(', ')}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="font-medium">${template.totalRevenue.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">
                      ${template.averagePrice.toFixed(2)} avg
                    </div>
                    <Badge 
                      variant={template.profitMargin > 100 ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {template.profitMargin.toFixed(0)}% margin
                    </Badge>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const IngredientsTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ingredient Usage Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.ingredients
              .sort((a, b) => b.totalUsed - a.totalUsed)
              .map(ingredient => (
                <Card key={ingredient.name} className="p-4">
                  <div className="space-y-2">
                    <div className="font-medium">{ingredient.name}</div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div>Total used: {ingredient.totalUsed} {ingredient.unitName}</div>
                      <div>In {ingredient.blendsCount} blends</div>
                      <div>Revenue: ${ingredient.revenueGenerated.toFixed(2)}</div>
                    </div>
                    <div className="pt-2">
                      <Badge variant="outline" className="text-xs">
                        ${(ingredient.revenueGenerated / ingredient.totalUsed).toFixed(2)} per {ingredient.unitName}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const CustomersTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer Blend History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.customBlends
              .sort((a, b) => b.totalRevenue - a.totalRevenue)
              .map(blend => (
                <div key={blend._id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{blend.blendName}</div>
                    <div className="text-sm text-gray-500">
                      Customer: {blend.customerName} • Created {new Date(blend.createdAt).toLocaleDateString('en-GB')}
                    </div>
                    <div className="text-sm text-gray-500">
                      Reordered {blend.usageCount} times
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="font-medium">${blend.totalRevenue.toFixed(2)}</div>
                    <Badge 
                      variant={blend.marginPercent > 100 ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {blend.marginPercent.toFixed(0)}% margin
                    </Badge>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Blend Analytics</h1>
          <p className="text-gray-600">Track performance and insights for your blend business</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={onRefresh} variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b">
        <div className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'templates', label: 'Templates', icon: Package },
            { id: 'ingredients', label: 'Ingredients', icon: PieChart },
            { id: 'customers', label: 'Customers', icon: Users }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as 'overview' | 'templates' | 'ingredients' | 'customers')}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                viewMode === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {viewMode === 'overview' && <OverviewTab />}
        {viewMode === 'templates' && <TemplatesTab />}
        {viewMode === 'ingredients' && <IngredientsTab />}
        {viewMode === 'customers' && <CustomersTab />}
      </div>
    </div>
  );
}