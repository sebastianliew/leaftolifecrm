"use client"

import { useEffect, useState } from "react"
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
import { Search, Download } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { fetchAPI } from "@/lib/query-client"
import { format, subDays, startOfDay, endOfDay } from "date-fns"
import { HiCube, HiExclamationTriangle } from "react-icons/hi2"

interface InventoryCostData {
  product_name: string
  cost_price: number
  total_stock: number
  total_cost: number
  category?: string
  unit?: string
  supplier?: string
  brand?: string
  last_updated?: string
  stock_status?: 'optimal' | 'low' | 'overstock' | 'out'
}

interface InventoryCostResponse {
  data: InventoryCostData[]
  success: boolean
  error?: string
  metadata?: {
    totalItems: number
    totalInventoryValue: number
    generatedAt: string
    dateRange?: {
      startDate: string
      endDate: string
    }
  }
}

type DateFilterOption = "24h" | "7d" | "14d" | "28d" | "all" | "custom"
type StockFilterOption = "all" | "optimal" | "low" | "overstock" | "out"

export default function InventoryCostReport() {
  const [data, setData] = useState<InventoryCostData[]>([])
  const [filteredData, setFilteredData] = useState<InventoryCostData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  
  // Filter states
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("all")
  const [stockFilter, setStockFilter] = useState<StockFilterOption>("all")
  const [customStartDate, setCustomStartDate] = useState<Date>()
  const [customEndDate, setCustomEndDate] = useState<Date>()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Helper function to get date range based on filter
        const getDateRange = () => {
          const referenceDate = new Date()
          
          switch (dateFilter) {
            case "24h":
              return {
                startDate: startOfDay(subDays(referenceDate, 1)),
                endDate: endOfDay(referenceDate)
              }
            case "7d":
              return {
                startDate: startOfDay(subDays(referenceDate, 7)),
                endDate: endOfDay(referenceDate)
              }
            case "14d":
              return {
                startDate: startOfDay(subDays(referenceDate, 14)),
                endDate: endOfDay(referenceDate)
              }
            case "28d":
              return {
                startDate: startOfDay(subDays(referenceDate, 28)),
                endDate: endOfDay(referenceDate)
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
        }
        
        const dateRange = getDateRange()
        let url = '/reports/inventory-cost'
        const params = new URLSearchParams()
        
        if (dateRange) {
          params.set('startDate', dateRange.startDate.toISOString())
          params.set('endDate', dateRange.endDate.toISOString())
        }
        
        if (stockFilter !== 'all') {
          params.set('stockStatus', stockFilter)
        }
        
        if (params.toString()) {
          url += `?${params.toString()}`
        }
        
        const result = await fetchAPI<InventoryCostResponse>(url)
        
        if (result.success) {
          setData(result.data)
          setFilteredData(result.data)
        } else {
          setError(result.error || 'Failed to fetch inventory cost data')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [dateFilter, stockFilter, customStartDate, customEndDate])

  // Filter data based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredData(data)
    } else {
      const searchLower = searchTerm.toLowerCase()
      const filtered = data.filter(item =>
        item.product_name.toLowerCase().includes(searchLower) ||
        (item.category && item.category.toLowerCase().includes(searchLower)) ||
        (item.supplier && item.supplier.toLowerCase().includes(searchLower)) ||
        (item.brand && item.brand.toLowerCase().includes(searchLower))
      )
      setFilteredData(filtered)
    }
  }, [data, searchTerm])

  // Calculate summary metrics
  const summary = {
    totalProducts: data.length,
    totalInventoryValue: data.reduce((sum, item) => sum + item.total_cost, 0),
    averageCostPerItem: data.length > 0 ? data.reduce((sum, item) => sum + item.total_cost, 0) / data.length : 0,
    lowStockItems: data.filter(item => item.stock_status === 'low' || item.stock_status === 'out').length,
  }

  // Calculate grand totals from filtered data (for table and CSV)
  const grandTotals = {
    totalCostPrice: filteredData.reduce((sum, item) => sum + item.cost_price, 0),
    totalTotalCost: filteredData.reduce((sum, item) => sum + item.total_cost, 0),
  }

  const getStockStatusColor = (status?: string) => {
    switch (status) {
      case 'optimal': return 'bg-green-100 text-green-800'
      case 'low': return 'bg-yellow-100 text-yellow-800'
      case 'out': return 'bg-red-100 text-red-800'
      case 'overstock': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const downloadCSV = () => {
    if (filteredData.length === 0) {
      alert('No data available to download')
      return
    }

    // Define CSV headers
    const headers = [
      'Product Name',
      'Supplier/Brand',
      'Cost Price',
      'Qty',
      'Total Cost', 
      'Category',
      'Status',
      'Last Updated'
    ]

    // Convert data to CSV format
    const csvContent = [
      headers.join(','),
      ...filteredData.map(item => [
        `"${item.product_name.replace(/"/g, '""')}"`, // Escape quotes in product name
        `"${(item.supplier || item.brand || '-').replace(/"/g, '""')}"`, // Supplier/Brand
        item.cost_price.toFixed(2),
        item.total_stock, // Numerical only
        item.total_cost.toFixed(2),
        `"${(item.category || 'Uncategorized').replace(/"/g, '""')}"`, // Escape quotes in category
        item.stock_status || 'Unknown',
        formatDate(item.last_updated)
      ].join(',')),
      // Add grand totals row
      ...(filteredData.length > 0 ? [[
        '"GRAND TOTAL"',
        '—',
        grandTotals.totalCostPrice.toFixed(2),
        '—',
        grandTotals.totalTotalCost.toFixed(2),
        '—',
        '—',
        '—'
      ].join(',')] : [])
    ].join('\n')

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    
    // Generate filename with current date
    const currentDate = new Date().toISOString().split('T')[0]
    link.setAttribute('download', `inventory-cost-report-${currentDate}.csv`)
    
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Inventory Cost Report</h1>
              <p className="text-gray-600">Detailed analysis of inventory costs and stock levels</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Date Filter Dropdown */}
              <div className="flex items-center gap-2">
                <Select value={dateFilter} onValueChange={(value: DateFilterOption) => setDateFilter(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="14d">Last 14 days</SelectItem>
                    <SelectItem value="28d">Last 28 days</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Stock Status Filter */}
              <div className="flex items-center gap-2">
                <Select value={stockFilter} onValueChange={(value: StockFilterOption) => setStockFilter(value)}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Stock status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stock</SelectItem>
                    <SelectItem value="optimal">Optimal</SelectItem>
                    <SelectItem value="low">Low stock</SelectItem>
                    <SelectItem value="out">Out of stock</SelectItem>
                    <SelectItem value="overstock">Overstock</SelectItem>
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

              {/* Search Input */}
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alert for low stock */}
        {summary.lowStockItems > 0 && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-2">
            <HiExclamationTriangle className="h-5 w-5 text-yellow-600" />
            <p className="text-yellow-800">
              <strong>{summary.lowStockItems} items</strong> require attention (low or out of stock)
            </p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <HiCube className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalProducts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalInventoryValue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Cost per Item</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.averageCostPerItem)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Items Need Attention</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.lowStockItems}</div>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Inventory Cost Details</CardTitle>
              <Button
                onClick={downloadCSV}
                variant="outline"
                size="sm"
                disabled={loading || filteredData.length === 0}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[900px] h-[600px] overflow-y-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Product Name</TableHead>
                    <TableHead className="whitespace-nowrap">Supplier/Brand</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Cost Price</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Qty</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Total Cost</TableHead>
                    <TableHead className="whitespace-nowrap">Category</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4 text-red-600">
                        Error: {error}
                      </TableCell>
                    </TableRow>
                  ) : filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4">
                        No data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium truncate" title={item.product_name}>{item.product_name}</TableCell>
                        <TableCell className="truncate" title={item.supplier || item.brand || '-'}>
                          {item.supplier || item.brand || '-'}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.cost_price)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {item.total_stock}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total_cost)}</TableCell>
                        <TableCell className="truncate" title={item.category || 'Uncategorized'}>{item.category || 'Uncategorized'}</TableCell>
                        <TableCell>
                          <Badge className={getStockStatusColor(item.stock_status)}>
                            {item.stock_status || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatDate(item.last_updated)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Grand Total Row - Fixed at bottom */}
            {!loading && !error && filteredData.length > 0 && (
              <div className="border-t-2 border-gray-300 bg-gray-50 p-0">
                <Table className="w-full">
                  <TableBody>
                    <TableRow className="bg-gray-50 font-bold">
                      <TableCell className="font-bold">GRAND TOTAL</TableCell>
                      <TableCell className="text-gray-500">—</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(grandTotals.totalCostPrice)}</TableCell>
                      <TableCell className="text-right text-gray-500">—</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(grandTotals.totalTotalCost)}</TableCell>
                      <TableCell className="text-gray-500">—</TableCell>
                      <TableCell className="text-gray-500">—</TableCell>
                      <TableCell className="text-right text-gray-500">—</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}