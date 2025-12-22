"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency, cn } from "@/lib/utils"
import { useSalesTrendsReport } from "@/hooks/queries/use-report-queries"
import { format, subDays, startOfDay, endOfDay } from "date-fns"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts"

interface SalesTrendData {
  date: string
  revenue: number
  cost: number
  profit: number
  transactions: number
}

interface CategoryData {
  category: string
  revenue: number
  percentage: number
}

interface TopProductData {
  product: string
  revenue: number
  quantity: number
}

interface SalesTrendsResponse {
  dailyData: SalesTrendData[]
  categoryData: CategoryData[]
  topProducts: TopProductData[]
}

type DateFilterOption = "24h" | "7d" | "14d" | "28d" | "custom"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function SalesTrendsReport() {
  console.log('SalesTrendsReport component rendering');
  
  // Date filter states
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("28d")
  const [customStartDate, setCustomStartDate] = useState<Date>()
  const [customEndDate, setCustomEndDate] = useState<Date>()
  
  // Helper function to get date range based on filter
  const getDateRange = () => {
    const now = new Date()
    
    switch (dateFilter) {
      case "24h":
        return {
          startDate: startOfDay(subDays(now, 1)),
          endDate: endOfDay(now)
        }
      case "7d":
        return {
          startDate: startOfDay(subDays(now, 7)),
          endDate: endOfDay(now)
        }
      case "14d":
        return {
          startDate: startOfDay(subDays(now, 14)),
          endDate: endOfDay(now)
        }
      case "28d":
        return {
          startDate: startOfDay(subDays(now, 28)),
          endDate: endOfDay(now)
        }
      case "custom":
        if (customStartDate && customEndDate) {
          return {
            startDate: startOfDay(customStartDate),
            endDate: endOfDay(customEndDate)
          }
        }
        return null
      default:
        return null
    }
  }
  
  const dateRange = getDateRange()
  const { data, isLoading: loading, error } = useSalesTrendsReport(dateRange)
  console.log('Sales trends data:', { data, loading, error })
  
  const typedData = data as SalesTrendsResponse | undefined
  const dailyData = typedData?.dailyData || []
  const categoryData = typedData?.categoryData || []
  const topProducts = typedData?.topProducts || []

  // Calculate summary metrics
  const summary = {
    totalRevenue: dailyData.reduce((sum, item) => sum + item.revenue, 0),
    totalProfit: dailyData.reduce((sum, item) => sum + item.profit, 0),
    avgDailyRevenue: dailyData.length > 0 ? dailyData.reduce((sum, item) => sum + item.revenue, 0) / dailyData.length : 0,
    totalTransactions: dailyData.reduce((sum, item) => sum + item.transactions, 0),
  }

  const profitMargin = summary.totalRevenue > 0 ? (summary.totalProfit / summary.totalRevenue) * 100 : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Sales Trends Report</h1>
              <p className="text-gray-600">Track sales performance over time and identify patterns</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Date Filter Dropdown */}
              <div className="flex items-center gap-2">
                <Select value={dateFilter} onValueChange={(value: DateFilterOption) => setDateFilter(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="14d">Last 14 days</SelectItem>
                    <SelectItem value="28d">Last 28 days</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Date Range Picker */}
              {dateFilter === "custom" && (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-32 justify-start text-left font-normal",
                          !customStartDate && "text-muted-foreground"
                        )}
                      >
                        {customStartDate ? format(customStartDate, "MMM dd") : "Start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        disabled={(date) => {
                          if (date > new Date()) return true
                          if (customEndDate && date > customEndDate) return true
                          return false
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <span className="text-gray-500">to</span>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-32 justify-start text-left font-normal",
                          !customEndDate && "text-muted-foreground"
                        )}
                      >
                        {customEndDate ? format(customEndDate, "MMM dd") : "End date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        disabled={(date) => {
                          if (date > new Date()) return true
                          if (customStartDate && date < customStartDate) return true
                          return false
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error instanceof Error ? error.message : 'Failed to load data'}</p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Profit (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalProfit)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Daily Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.avgDailyRevenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profitMargin.toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Sales Trend Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Daily Sales Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-80 flex items-center justify-center">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#8884d8" name="Revenue" />
                  <Line type="monotone" dataKey="profit" stroke="#82ca9d" name="Profit" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Sales by Category */}
          <Card>
            <CardHeader>
              <CardTitle>Sales by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-80 flex items-center justify-center">Loading...</div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.category}: ${entry.percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="revenue"
                    >
                      {categoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle>Top 5 Products by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-80 flex items-center justify-center">Loading...</div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={topProducts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="product" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="revenue" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}