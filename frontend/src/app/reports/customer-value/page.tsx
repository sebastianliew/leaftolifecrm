"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Search, 
  Download, 
  TrendingUp, 
  DollarSign,
  Users,
  ShoppingCart,
  CalendarIcon,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { fetchAPI } from "@/lib/query-client"
import { format, subDays, startOfDay, endOfDay } from "date-fns"
import { toast } from "sonner"

interface TopProduct {
  name: string
  quantity: number
  revenue: number
}

interface CustomerValueData {
  rank: number
  customerName: string
  customerEmail?: string
  customerPhone?: string
  customerAddress?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
  }
  metrics: {
    totalRevenue: number
    totalOrders: number
    averageOrderValue: number
    totalCost: number
    totalMargin: number
    marginPercentage: number
  }
  timeline: {
    firstPurchase: string
    lastPurchase: string
    daysSinceLastOrder: number
    purchaseFrequency: number
  }
  membership?: {
    tier: 'standard' | 'silver' | 'gold' | 'platinum' | 'vip' | null
    discountRate: number
  }
  insights: {
    topProducts: TopProduct[]
    preferredPaymentMethod: string
    customBlendsCount: number
    bundlesCount: number
  }
}

interface CustomerValueResponse {
  data: CustomerValueData[]
  success: boolean
  error?: string
  metadata?: {
    totalCustomers: number
    totalUniqueCustomers?: number
    dateRange: {
      start: string
      end: string
    }
    generatedAt: string
    aggregateTotals: {
      totalRevenue: number
      totalMargin: number
      averageMarginPercentage: number
    }
  }
}

type DateFilterOption = "24h" | "7d" | "14d" | "28d" | "90d" | "365d" | "all" | "custom"
type SortByOption = "revenue" | "orders" | "margin" | "recent" | "frequency"

export default function CustomerValueReport() {
  const [data, setData] = useState<CustomerValueData[]>([])
  const [filteredData, setFilteredData] = useState<CustomerValueData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  
  // Filter states
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("90d")
  const [customStartDate, setCustomStartDate] = useState<Date>()
  const [customEndDate, setCustomEndDate] = useState<Date>()
  const [sortBy, setSortBy] = useState<SortByOption>("revenue")
  const [limit, setLimit] = useState<string>("20")
  
  // Metadata state
  const [metadata, setMetadata] = useState<CustomerValueResponse['metadata']>()

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
      case "90d":
        return {
          startDate: startOfDay(subDays(now, 90)),
          endDate: endOfDay(now)
        }
      case "365d":
        return {
          startDate: startOfDay(subDays(now, 365)),
          endDate: endOfDay(now)
        }
      case "all":
        return null
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
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const params = new URLSearchParams()
        const dateRange = getDateRange()
        
        if (dateRange) {
          params.append('startDate', dateRange.startDate.toISOString())
          params.append('endDate', dateRange.endDate.toISOString())
        }
        
        
        params.append('sortBy', sortBy)
        params.append('sortOrder', 'desc')
        params.append('limit', limit)
        
        const url = `/reports/customer-value?${params.toString()}`
        const result = await fetchAPI<CustomerValueResponse>(url)
        
        if (result.success) {
          setData(result.data)
          setFilteredData(result.data)
          setMetadata(result.metadata)
        } else {
          setError(result.error || 'Failed to fetch customer value data')
          toast.error('Failed to load customer value report')
        }
      } catch (error) {
        console.error('Error fetching customer value data:', error)
        setError(error instanceof Error ? error.message : 'An unexpected error occurred')
        toast.error('An error occurred while loading the report')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [dateFilter, customStartDate, customEndDate, sortBy, limit, getDateRange])

  // Filter data based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredData(data)
    } else {
      const filtered = data.filter(customer =>
        customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.customerEmail && customer.customerEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (customer.customerPhone && customer.customerPhone.includes(searchTerm))
      )
      setFilteredData(filtered)
    }
  }, [data, searchTerm])

  // Toggle expanded row
  const toggleRowExpansion = (rank: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(rank)) {
      newExpanded.delete(rank)
    } else {
      newExpanded.add(rank)
    }
    setExpandedRows(newExpanded)
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Rank', 'Customer Name', 'Email', 'Phone', 
      'Total Revenue', 'Total Orders', 'Average Order Value',
      'Total Cost', 'Total Margin', 'Margin %',
      'First Purchase', 'Last Purchase', 'Days Since Last Order',
      'Purchase Frequency', 'Membership Tier', 'Discount Rate',
      'Preferred Payment', 'Custom Blends', 'Bundles'
    ]

    const rows = filteredData.map(customer => [
      customer.rank,
      customer.customerName,
      customer.customerEmail || '',
      customer.customerPhone || '',
      customer.metrics.totalRevenue.toFixed(2),
      customer.metrics.totalOrders,
      customer.metrics.averageOrderValue.toFixed(2),
      customer.metrics.totalCost.toFixed(2),
      customer.metrics.totalMargin.toFixed(2),
      customer.metrics.marginPercentage.toFixed(2) + '%',
      format(new Date(customer.timeline.firstPurchase), 'yyyy-MM-dd'),
      format(new Date(customer.timeline.lastPurchase), 'yyyy-MM-dd'),
      customer.timeline.daysSinceLastOrder,
      customer.timeline.purchaseFrequency,
      customer.membership?.tier || 'N/A',
      customer.membership?.discountRate || '0',
      customer.insights.preferredPaymentMethod,
      customer.insights.customBlendsCount,
      customer.insights.bundlesCount
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `customer-value-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
  }

  // Get membership tier color
  const getTierColor = (tier?: string | null) => {
    switch (tier) {
      case 'vip': return 'bg-purple-100 text-purple-800'
      case 'platinum': return 'bg-gray-100 text-gray-800'
      case 'gold': return 'bg-yellow-100 text-yellow-800'
      case 'silver': return 'bg-gray-100 text-gray-600'
      default: return 'bg-blue-50 text-blue-700'
    }
  }

  // Get margin color based on percentage
  const getMarginColor = (margin: number) => {
    if (margin >= 40) return 'text-green-600'
    if (margin >= 25) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-12 w-96 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="py-10">
              <p className="text-center text-red-600">{error}</p>
              <Button 
                onClick={() => window.location.reload()} 
                className="mx-auto mt-4 block"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="shadow-sm border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Customer Value Report</h1>
              <p className="text-gray-600">Analysis of top customers by purchase value and margins</p>
            </div>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary Cards */}
        {metadata && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metadata.totalCustomers}</div>
                <p className="text-xs text-muted-foreground">In selected period</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(metadata.aggregateTotals.totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">Combined revenue</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Margin</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(metadata.aggregateTotals.totalMargin)}
                </div>
                <p className="text-xs text-muted-foreground">Profit after costs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Margin</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", getMarginColor(metadata.aggregateTotals.averageMarginPercentage))}>
                  {metadata.aggregateTotals.averageMarginPercentage.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Average profit margin</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Date Filter */}
              <Select value={dateFilter} onValueChange={(value: DateFilterOption) => setDateFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="14d">Last 14 days</SelectItem>
                  <SelectItem value="28d">Last 28 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="365d">Last year</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort By */}
              <Select value={sortBy} onValueChange={(value: SortByOption) => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Total Revenue</SelectItem>
                  <SelectItem value="orders">Total Orders</SelectItem>
                  <SelectItem value="margin">Margin %</SelectItem>
                  <SelectItem value="recent">Recent Activity</SelectItem>
                  <SelectItem value="frequency">Purchase Frequency</SelectItem>
                </SelectContent>
              </Select>

              {/* Limit */}
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger>
                  <SelectValue placeholder="Show" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Show 10</SelectItem>
                  <SelectItem value="20">Show 20</SelectItem>
                  <SelectItem value="50">Show 50</SelectItem>
                  <SelectItem value="100">Show 100</SelectItem>
                  <SelectItem value="500">Show 500</SelectItem>
                  <SelectItem value="1000">Show 1000</SelectItem>
                  <SelectItem value="all">Show All</SelectItem>
                </SelectContent>
              </Select>

              {/* Custom Date Range */}
              {dateFilter === "custom" && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !customStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStartDate ? format(customStartDate, "PPP") : "Start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !customEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEndDate ? format(customEndDate, "PPP") : "End date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </>
              )}

            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="flex flex-col" style={{ height: '1200px' }}>
          <CardHeader className="flex-none px-6">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Customer Rankings</CardTitle>
              <div className="text-sm text-muted-foreground">
                <p>
                  Showing {filteredData.length} of {metadata?.totalUniqueCustomers || metadata?.totalCustomers || 0} customers
                </p>
                {dateFilter !== 'all' && metadata?.totalUniqueCustomers && metadata.totalUniqueCustomers > metadata.totalCustomers && (
                  <p className="text-xs">
                    ({metadata.totalUniqueCustomers - metadata.totalCustomers} customers have no purchases in this period)
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden px-6 pb-0">
            <div className="h-full overflow-auto pb-4">
              <Table className="relative">
                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                  <TableRow className="border-b h-10">
                    <TableHead className="w-12 py-2">#</TableHead>
                    <TableHead className="py-2">Customer</TableHead>
                    <TableHead className="text-right py-2">Revenue</TableHead>
                    <TableHead className="text-center py-2">Orders</TableHead>
                    <TableHead className="text-right py-2">Avg Order</TableHead>
                    <TableHead className="text-right py-2">Margin</TableHead>
                    <TableHead className="text-center py-2">Last Purchase</TableHead>
                    <TableHead className="text-center py-2">Tier</TableHead>
                    <TableHead className="w-12 py-2"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((customer) => (
                    <React.Fragment key={customer.rank}>
                      <TableRow 
                        className="cursor-pointer hover:bg-gray-50 h-14"
                        onClick={() => toggleRowExpansion(customer.rank)}
                      >
                        <TableCell className="font-medium">{customer.rank}</TableCell>
                        <TableCell>
                          <div className="py-1">
                            <p className="font-medium text-sm">{customer.customerName}</p>
                            <p className="text-xs text-gray-500">{customer.customerEmail || 'No email'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(customer.metrics.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-center">
                          {customer.metrics.totalOrders}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(customer.metrics.averageOrderValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="py-1">
                            <p className={cn("font-medium text-sm", getMarginColor(customer.metrics.marginPercentage))}>
                              {customer.metrics.marginPercentage.toFixed(1)}%
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(customer.metrics.totalMargin)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="py-1">
                            <p className="text-xs">
                              {customer.timeline.lastPurchase 
                                ? format(new Date(customer.timeline.lastPurchase), 'MMM d, yyyy')
                                : 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {customer.timeline.daysSinceLastOrder > 0 
                                ? `${customer.timeline.daysSinceLastOrder}d ago`
                                : 'N/A'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {customer.membership ? (
                            <Badge className={cn("capitalize", getTierColor(customer.membership.tier))}>
                              {customer.membership.tier || 'Standard'}
                              {customer.membership.discountRate > 0 && ` (-${customer.membership.discountRate}%)`}
                            </Badge>
                          ) : (
                            <Badge variant="outline">N/A</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {expandedRows.has(customer.rank) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded Row Details */}
                      {expandedRows.has(customer.rank) && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-gray-50">
                            <div className="p-4 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Contact Information */}
                                <div>
                                  <h4 className="font-semibold mb-2">Contact Information</h4>
                                  <div className="space-y-1 text-sm">
                                    <p><span className="text-gray-600">Phone:</span> {customer.customerPhone || 'Not provided'}</p>
                                    {customer.customerAddress && (
                                      <p>
                                        <span className="text-gray-600">Address:</span> 
                                        {[
                                          customer.customerAddress.street,
                                          customer.customerAddress.city,
                                          customer.customerAddress.state,
                                          customer.customerAddress.postalCode
                                        ].filter(Boolean).join(', ') || 'Not provided'}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Purchase Timeline */}
                                <div>
                                  <h4 className="font-semibold mb-2">Purchase Timeline</h4>
                                  <div className="space-y-1 text-sm">
                                    <p>
                                      <span className="text-gray-600">First Purchase:</span> 
                                      {customer.timeline.firstPurchase 
                                        ? format(new Date(customer.timeline.firstPurchase), 'MMM d, yyyy')
                                        : 'N/A'}
                                    </p>
                                    <p>
                                      <span className="text-gray-600">Purchase Frequency:</span> 
                                      {customer.timeline.purchaseFrequency > 0 
                                        ? `Every ${customer.timeline.purchaseFrequency} days`
                                        : 'N/A'}
                                    </p>
                                    <p>
                                      <span className="text-gray-600">Customer Since:</span> 
                                      {customer.timeline.firstPurchase 
                                        ? `${Math.round((new Date().getTime() - new Date(customer.timeline.firstPurchase).getTime()) / (1000 * 60 * 60 * 24))} days`
                                        : 'N/A'}
                                    </p>
                                  </div>
                                </div>

                                {/* Purchase Insights */}
                                <div>
                                  <h4 className="font-semibold mb-2">Purchase Insights</h4>
                                  <div className="space-y-1 text-sm">
                                    <p><span className="text-gray-600">Preferred Payment:</span> {customer.insights.preferredPaymentMethod}</p>
                                    <p><span className="text-gray-600">Custom Blends:</span> {customer.insights.customBlendsCount}</p>
                                    <p><span className="text-gray-600">Bundles:</span> {customer.insights.bundlesCount}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Top Products */}
                              {customer.insights.topProducts.length > 0 && (
                                <div>
                                  <h4 className="font-semibold mb-2">Top Products</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    {customer.insights.topProducts.slice(0, 6).map((product, index) => (
                                      <div key={index} className="bg-white p-2 rounded border">
                                        <p className="font-medium text-sm truncate">{product.name}</p>
                                        <div className="flex justify-between text-xs text-gray-600">
                                          <span>Qty: {product.quantity}</span>
                                          <span>{formatCurrency(product.revenue)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Financial Summary */}
                              <div className="bg-white p-4 rounded border">
                                <h4 className="font-semibold mb-2">Financial Summary</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-gray-600">Total Cost</p>
                                    <p className="font-medium">{formatCurrency(customer.metrics.totalCost)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600">Total Margin</p>
                                    <p className="font-medium">{formatCurrency(customer.metrics.totalMargin)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600">Margin %</p>
                                    <p className={cn("font-medium", getMarginColor(customer.metrics.marginPercentage))}>
                                      {customer.metrics.marginPercentage.toFixed(2)}%
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600">Lifetime Value</p>
                                    <p className="font-medium">{formatCurrency(customer.metrics.totalRevenue)}</p>
                                  </div>
                                </div>
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
          </CardContent>
        </Card>
      </main>
    </div>
  )
}