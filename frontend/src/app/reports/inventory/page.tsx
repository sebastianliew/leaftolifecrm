"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { HiExclamationTriangle, HiLockClosed } from "react-icons/hi2"
import { usePermissions } from "@/hooks/usePermissions"

interface InventoryItem {
  id: string
  name: string
  category: string
  current_stock: number
  min_stock: number
  max_stock: number
  unit: string
  unit_cost: number
  total_value: number
  turnover_rate: number
  days_supply: number
  status: 'optimal' | 'low' | 'overstock' | 'out'
}

interface CategorySummary {
  category: string
  items: number
  value: number
  percentage: number
}

interface StockStatus {
  status: string
  count: number
  value: number
}

interface InventoryAnalysisData {
  inventoryData: InventoryItem[]
  categoryData: CategorySummary[]
  stockStatus: StockStatus[]
}


export default function InventoryReport() {
  const { hasPermission } = usePermissions()
  const canViewInventoryReports = hasPermission('reports', 'canViewInventoryReports')

  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canViewInventoryReports) return

    const fetchData = async () => {
      try {
        const response = await api.get('/reports/inventory-analysis')
        
        if (!response.ok) {
          throw new Error(response.error || 'Failed to fetch inventory data')
        }
        
        // The API client wraps the backend response in response.data
        // The backend returns { data: InventoryAnalysisData, success: true }
        const responseData = response.data as { data: InventoryAnalysisData } | InventoryAnalysisData
        const backendData = 'data' in responseData ? responseData.data : responseData
        setInventoryData(backendData.inventoryData || [])
      } catch (error) {
        console.error('Error fetching inventory data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [canViewInventoryReports])

  // Calculate summary metrics
  const totalItems = inventoryData.length
  const totalValue = inventoryData.reduce((sum, item) => sum + item.total_value, 0)
  const lowStockItems = inventoryData.filter(item => item.status === 'low' || item.status === 'out').length
  const avgTurnover = inventoryData.reduce((sum, item) => sum + item.turnover_rate, 0) / totalItems || 0



  if (!canViewInventoryReports) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <HiLockClosed className="w-12 h-12 text-gray-400 mx-auto" />
              <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
              <p className="text-gray-600">You do not have permission to view inventory reports.</p>
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
              <h1 className="text-3xl font-bold text-gray-900">Inventory Report</h1>
              <p className="text-gray-600">Monitor stock levels, turnover rates, and inventory value</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alert for low stock */}
        {lowStockItems > 0 && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-2">
            <HiExclamationTriangle className="h-5 w-5 text-yellow-600" />
            <p className="text-yellow-800">
              <strong>{lowStockItems} items</strong> require immediate attention (low or out of stock)
            </p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low/Out Stock Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{lowStockItems}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Turnover Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgTurnover.toFixed(1)}x</div>
            </CardContent>
          </Card>
        </div>


        {/* Top 10 Low Stock Items */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Critical Stock Items - Immediate Attention Required</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Min Required</TableHead>
                    <TableHead className="text-right">Days Supply</TableHead>
                    <TableHead>Action Required</TableHead>
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
                    inventoryData
                      .filter(item => item.status === 'low' || item.status === 'out')
                      .sort((a, b) => a.days_supply - b.days_supply)
                      .slice(0, 10)
                      .map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell className="text-right">
                            <span className={item.status === 'out' ? 'text-red-600 font-bold' : 'text-yellow-600'}>
                              {item.current_stock} {item.unit}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{item.min_stock} {item.unit}</TableCell>
                          <TableCell className="text-right">
                            <span className={item.days_supply <= 7 ? 'text-red-600 font-bold' : ''}>
                              {item.days_supply} days
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.status === 'out' ? (
                              <Badge className="bg-red-100 text-red-800">Order Immediately</Badge>
                            ) : item.days_supply <= 7 ? (
                              <Badge className="bg-orange-100 text-orange-800">Order Soon</Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800">Monitor</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
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