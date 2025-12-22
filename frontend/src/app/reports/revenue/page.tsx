"use client"

import { useEffect, useState, useCallback } from "react"
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
import { api } from "@/lib/api-client"
import { format, subDays, startOfDay, endOfDay } from "date-fns"
import { usePermissions } from "@/hooks/usePermissions"
import { HiLockClosed } from "react-icons/hi2"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface MonthlyRevenue {
  month: string
  revenue: number
  cost: number
  profit: number
  growth: number
}

interface CategoryRevenue {
  category: string
  revenue: number
  cost: number
  profit: number
  margin: number
  transactions: number
}

interface PaymentMethodRevenue {
  method: string
  amount: number
  transactions: number
  percentage: number
}

interface RevenueAnalysisData {
  monthlyData: MonthlyRevenue[]
  categoryData: CategoryRevenue[]
  paymentData: PaymentMethodRevenue[]
}

type DateFilterOption = "24h" | "7d" | "14d" | "28d" | "6months" | "12months" | "custom"

export default function RevenueAnalysisReport() {
  const { hasPermission } = usePermissions()
  const canViewFinancialReports = hasPermission('reports', 'canViewFinancialReports')

  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([])
  const [categoryData, setCategoryData] = useState<CategoryRevenue[]>([])
  const [paymentData, setPaymentData] = useState<PaymentMethodRevenue[]>([])
  const [loading, setLoading] = useState(true)

  // Date filter states
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("28d")
  const [customStartDate, setCustomStartDate] = useState<Date>()
  const [customEndDate, setCustomEndDate] = useState<Date>()
  
  // Helper function to get date range based on filter
  const getDateRange = useCallback(() => {
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
      case "6months":
        return {
          startDate: startOfDay(subDays(now, 180)),
          endDate: endOfDay(now)
        }
      case "12months":
        return {
          startDate: startOfDay(subDays(now, 365)),
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
  }, [dateFilter, customStartDate, customEndDate])

  useEffect(() => {
    if (!canViewFinancialReports) return

    const fetchData = async () => {
      try {
        setLoading(true)
        const dateRange = getDateRange()
        const params: Record<string, string> = {}
        
        if (dateRange) {
          params.startDate = dateRange.startDate.toISOString()
          params.endDate = dateRange.endDate.toISOString()
        } else if (dateFilter === "6months" || dateFilter === "12months") {
          // Fallback to period for legacy support
          params.period = dateFilter
        }
        
        const response = await api.get('/reports/revenue-analysis', params)
        
        if (!response.ok) {
          throw new Error(response.error || 'Failed to fetch data')
        }
        
        const data = response.data as RevenueAnalysisData
        setMonthlyData(data.monthlyData || [])
        setCategoryData(data.categoryData || [])
        setPaymentData(data.paymentData || [])
      } catch (error) {
        console.error('Error fetching revenue analysis data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [canViewFinancialReports, dateFilter, customStartDate, customEndDate, getDateRange])

  // Calculate summary metrics
  const totalRevenue = categoryData.reduce((sum, item) => sum + item.revenue, 0)
  const totalProfit = categoryData.reduce((sum, item) => sum + item.profit, 0)
  const avgMonthlyRevenue = monthlyData.length > 0 ? monthlyData.reduce((sum, item) => sum + item.revenue, 0) / monthlyData.length : 0
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  if (!canViewFinancialReports) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <HiLockClosed className="w-12 h-12 text-gray-400 mx-auto" />
              <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
              <p className="text-gray-600">You do not have permission to view financial reports.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Revenue Analysis Report</h1>
              <p className="text-gray-600">Comprehensive revenue breakdown by category and time period</p>
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
                    <SelectItem value="6months">Last 6 months</SelectItem>
                    <SelectItem value="12months">Last 12 months</SelectItem>
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
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalProfit)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Monthly Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(avgMonthlyRevenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallMargin.toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Revenue Trend */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-80 flex items-center justify-center">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" stackId="1" stroke="#8884d8" fill="#8884d8" name="Revenue" />
                  <Area type="monotone" dataKey="profit" stackId="2" stroke="#82ca9d" fill="#82ca9d" name="Profit" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Category */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : (
                    categoryData.map((item) => (
                      <TableRow key={item.category}>
                        <TableCell className="font-medium">{item.category}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.profit)}</TableCell>
                        <TableCell className="text-right">{(item.margin * 100).toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{item.transactions.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-80 flex items-center justify-center">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={paymentData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="method" type="category" />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="amount" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}