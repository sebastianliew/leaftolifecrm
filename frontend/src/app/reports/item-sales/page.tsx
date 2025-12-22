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
import { Search } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { fetchAPI } from "@/lib/query-client"
import { format, subDays, startOfDay, endOfDay } from "date-fns"

interface ItemSalesData {
  item_name: string
  total_sales: number
  total_cost: number
  total_discount: number
  total_tax: number
  average_list_price: number
  average_cost_price: number
  quantity_sold: number
  margin: number
  base_unit: string
  last_sale_date: string
}

interface ItemSalesResponse {
  data: ItemSalesData[]
  success: boolean
  error?: string
  metadata?: {
    totalItems: number
    generatedAt: string
  }
}

type DateFilterOption = "24h" | "7d" | "14d" | "28d" | "all" | "custom"

export default function ItemSalesReport() {
  const [data, setData] = useState<ItemSalesData[]>([])
  const [filteredData, setFilteredData] = useState<ItemSalesData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  
  // Date filter states
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("all")
  const [customStartDate, setCustomStartDate] = useState<Date>()
  const [customEndDate, setCustomEndDate] = useState<Date>()
  
  // Transaction date range state
  const [transactionDateRange, setTransactionDateRange] = useState<{
    earliest: string
    latest: string
    count: number
  } | null>(null)

  // Fetch transaction date range on component mount
  useEffect(() => {
    const fetchTransactionDateRange = async () => {
      try {
        const result = await fetchAPI<{success: boolean, data: {earliest: string, latest: string, count: number} | null}>('/reports/transaction-date-range')
        
        if (result.success && result.data) {
          setTransactionDateRange(result.data)
        } else {
        }
      } catch {
      }
    }
    
    fetchTransactionDateRange()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        
        setLoading(true)
        setError(null)
        
        // Helper function to get date range based on filter
        const getDateRange = () => {
          // Use the latest transaction date as reference if available
          const referenceDate = transactionDateRange 
            ? new Date(transactionDateRange.latest)
            : new Date() // fallback to current date
          
          
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
              // Query all data without date restrictions
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
        let url = '/reports/item-sales'
        
        if (dateRange) {
          
          const params = new URLSearchParams({
            startDate: dateRange.startDate.toISOString(),
            endDate: dateRange.endDate.toISOString()
          })
          url += `?${params.toString()}`
        } else {
        }
        
        
        
        const result = await fetchAPI<ItemSalesResponse>(url)
        
        
        if (result.success) {
          setData(result.data)
          setFilteredData(result.data)
        } else {
          setError(result.error || 'Failed to fetch item sales data')
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [dateFilter, customStartDate, customEndDate, transactionDateRange])

  // Filter data based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredData(data)
    } else {
      const filtered = data.filter(item =>
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredData(filtered)
    }
  }, [data, searchTerm])

  // Calculate summary metrics
  const summary = {
    totalRevenue: data.reduce((sum, item) => sum + item.total_sales, 0),
    totalCost: data.reduce((sum, item) => sum + item.total_cost, 0),
    totalProfit: data.reduce((sum, item) => sum + (item.total_sales - item.total_cost), 0),
    totalItems: data.length,
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Item Sales Report</h1>
              <p className="text-gray-600">Detailed analysis of item sales performance</p>
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
                  placeholder="Search items..."
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
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalCost)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalProfit)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalItems}</div>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Item Sales Details</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[900px] h-[800px] overflow-y-auto">
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Item Name</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Total Sales</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Total Cost</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Total Discount</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Total Tax</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Avg List Price</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Avg Cost Price</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Quantity Sold</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Margin</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Last Sale Date</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Last Sale Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-4">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : error ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-4 text-red-600">
                          Error: {error}
                        </TableCell>
                      </TableRow>
                    ) : data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-4">
                          No data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.map((item, index) => {
                        const { date, time } = formatDate(item.last_sale_date)
                        return (
                          <TableRow key={index}>
                            <TableCell>{item.item_name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total_sales)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total_cost)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total_discount)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total_tax)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.average_list_price)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.average_cost_price)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {item.quantity_sold} {item.base_unit}
                            </TableCell>
                            <TableCell className="text-right">{(item.margin * 100).toFixed(1)}%</TableCell>
                            <TableCell className="text-right">{date}</TableCell>
                            <TableCell className="text-right">{time}</TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}