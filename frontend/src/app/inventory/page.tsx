"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  HiCube,
  HiExclamationTriangle,
  HiMagnifyingGlass,
  HiPencil,
  HiTrash,
  HiChevronUp,
  HiChevronDown,
  HiPlus,
  HiFunnel,
  HiArrowDownTray
} from "react-icons/hi2"
import { Loader2 } from 'lucide-react'
import {
  useInventory,
  useInventoryStats,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  useBulkDeleteInventoryItems,
  type InventoryFilters,
} from "@/hooks/queries/use-inventory-queries"
import { useCategoriesQuery } from "@/hooks/queries/use-categories-query"
import { useUnitsQuery } from "@/hooks/queries/use-units-query"
import { useBrands } from "@/hooks/queries/use-common-queries"
import { useToast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/utils"
import { useAuth } from "@/providers/auth-provider"
import { usePermissions } from "@/hooks/usePermissions"
import { AddProductModal } from "@/components/inventory/add-product-modal"
import { EditProductModal } from "@/components/inventory/edit-product-modal"
import { ProductDeleteDialog } from "@/components/inventory/product-delete-dialog"
import type { AddProductSubmitData } from "@/components/inventory/add-product-modal"
import type { EditProductSubmitData } from "@/components/inventory/edit-product-modal"
import type { ProductCategory } from "@/types/inventory/category.types"
import type { Product } from "@/types/inventory/product.types"

interface Brand {
  _id: string;
  name: string;
  description?: string;
  active: boolean;
}

export default function InventoryPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { hasPermission } = usePermissions()

  // Permissions
  const canViewCostPrices = user?.role === 'super_admin' || user?.role === 'admin'
  const canAddProducts = hasPermission('inventory', 'canAddProducts')
  const canEditProducts = hasPermission('inventory', 'canEditProducts')
  const canDeleteProducts = hasPermission('inventory', 'canDeleteProducts')

  // ── Server-side filter/sort/pagination state ──
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [brandFilter, setBrandFilter] = useState("all")
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // UI state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [productToEdit, setProductToEdit] = useState<Product | null>(null)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Debounced search — avoid hammering API on every keystroke
  const searchTimer = useState<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchTimer[0]) clearTimeout(searchTimer[0])
    searchTimer[0] = setTimeout(() => {
      setSearchTerm(value)
      setCurrentPage(1) // Reset to page 1 on new search
    }, 400)
  }

  // Build server-side filters
  const filters: InventoryFilters = {
    ...(searchTerm && { search: searchTerm }),
    ...(categoryFilter !== "all" && { category: categoryFilter }),
    ...(brandFilter !== "all" && { brand: brandFilter }),
    ...(stockStatusFilter !== "all" && { stockStatus: stockStatusFilter as InventoryFilters['stockStatus'] }),
    sortBy: sortBy === 'stock' ? 'currentStock' : sortBy === 'price' ? 'sellingPrice' : sortBy,
    sortOrder,
    page: currentPage,
    limit: itemsPerPage,
  }

  // ── Queries ──
  const { data: inventoryData, isLoading: loading, error: inventoryError } = useInventory(filters)
  const { data: stats } = useInventoryStats()
  const { data: brands = [], isLoading: brandsLoading } = useBrands()
  const { data: categories = [], isLoading: categoriesLoading } = useCategoriesQuery()
  const { data: units = [], isLoading: unitsLoading } = useUnitsQuery()

  const products = inventoryData?.products || []
  const pagination = inventoryData?.pagination || { total: 0, page: 1, limit: 20, pages: 0 }

  // ── Mutations ──
  const createMutation = useCreateInventoryItem()
  const updateMutation = useUpdateInventoryItem()
  const deleteMutation = useDeleteInventoryItem()
  const bulkDeleteMutation = useBulkDeleteInventoryItems()

  // ── Stock status helper ──
  const getStockStatus = (product: Product) => {
    const stock = product.currentStock ?? 0
    const reorder = product.reorderPoint ?? 0
    if (stock <= 0) {
      return {
        status: "out",
        color: "bg-red-100 text-red-800",
        icon: <HiExclamationTriangle className="w-3 h-3" />,
        text: "Out of Stock"
      }
    }
    if (stock <= reorder) {
      return {
        status: "low",
        color: "bg-yellow-100 text-yellow-800",
        icon: <span className="text-lg">↓</span>,
        text: "Low Stock"
      }
    }
    return {
      status: "normal",
      color: "bg-green-100 text-green-800",
      icon: <HiCube className="w-3 h-3" />,
      text: "In Stock"
    }
  }

  // ── Sort handling ──
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
    setCurrentPage(1)
  }

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) return null
    return sortOrder === 'asc' ?
      <HiChevronUp className="w-3 h-3 ml-1" /> :
      <HiChevronDown className="w-3 h-3 ml-1" />
  }

  // ── Selection handling ──
  const handleSelectProduct = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts)
    if (checked) newSelected.add(productId)
    else newSelected.delete(productId)
    setSelectedProducts(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedProducts(new Set(products.map(p => p._id)))
    else setSelectedProducts(new Set())
  }

  const isAllSelected = products.length > 0 && products.every(p => selectedProducts.has(p._id))

  // ── Filter card click (maps to stockStatus server param) ──
  const handleCardFilter = (filterType: string) => {
    setStockStatusFilter(filterType)
    setCurrentPage(1)
  }

  // ── Excel export (server-side, all products) ──
  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const token = document.cookie.split(';').find(c => c.trim().startsWith('authToken='))?.split('=')[1]
        || localStorage.getItem('authToken')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'}/inventory/products/export`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inventory_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Success", description: "Excel file downloaded successfully" })
    } catch (error) {
      console.error('Excel export error:', error)
      toast({ title: "Error", description: "Failed to export Excel file", variant: "destructive" })
    } finally {
      setIsExporting(false)
    }
  }

  // ── Add product ──
  const handleAddProduct = async (data: AddProductSubmitData) => {
    try {
      await createMutation.mutateAsync({
        name: data.name,
        category: data.category.id,
        brand: data.brand?.id,
        unitOfMeasurement: data.unitOfMeasurement.id,
        currentStock: data.currentStock || 0,
        sellingPrice: data.sellingPrice || 0,
        costPrice: data.costPrice || 0,
        reorderPoint: data.reorderPoint || 10,
        description: data.bundleInfo,
        status: 'active',
        containerCapacity: data.containerCapacity,
      })
      toast({ title: "Success", description: "Product added successfully!" })
      setShowAddModal(false)
    } catch (error) {
      console.error('Failed to add product:', error)
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to add product.", variant: "destructive" })
    }
  }

  // ── Edit product ──
  const handleEditProduct = (product: Product) => {
    setProductToEdit(product)
    setShowEditModal(true)
  }

  const handleEditSubmit = async (data: EditProductSubmitData) => {
    if (!productToEdit) return
    try {
      await updateMutation.mutateAsync({
        id: productToEdit._id,
        data: {
          name: data.name,
          category: data.category.id,
          brand: data.brand?.id,
          unitOfMeasurement: data.unitOfMeasurement.id,
          currentStock: data.currentStock || 0,
          sellingPrice: data.sellingPrice || 0,
          costPrice: data.costPrice || 0,
          reorderPoint: data.reorderPoint || 10,
          description: data.bundleInfo,
          status: 'active',
          containerCapacity: data.containerCapacity,
        },
      })
      toast({ title: "Success", description: `Product "${data.name}" updated successfully!` })
      setShowEditModal(false)
      setProductToEdit(null)
    } catch (error) {
      console.error('Failed to update product:', error)
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update product.", variant: "destructive" })
    }
  }

  // ── Delete product ──
  const handleDeleteProduct = (product: Product) => {
    setProductToDelete(product)
    setShowDeleteDialog(true)
  }

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return
    try {
      await deleteMutation.mutateAsync(productToDelete._id)
      toast({ title: "Success", description: `Product "${productToDelete.name}" deleted successfully!` })
      setShowDeleteDialog(false)
      setProductToDelete(null)
    } catch (error: unknown) {
      let msg = "Failed to delete product."
      if (error instanceof Error) {
        if (error.message?.includes('401')) msg = "Authentication required. Please log in again."
        else if (error.message?.includes('403')) msg = "You don't have permission to delete products."
        else if (error.message?.includes('404')) msg = "Product not found. It may have already been deleted."
      }
      toast({ title: "Error", description: msg, variant: "destructive" })
    }
  }

  // ── Bulk delete ──
  const handleBulkDelete = async () => {
    const selectedArray = Array.from(selectedProducts)
    if (selectedArray.length === 0) return
    const names = products.filter(p => selectedProducts.has(p._id)).map(p => p.name).slice(0, 3)
    const msg = selectedArray.length === 1
      ? `Are you sure you want to delete "${names[0]}"?`
      : `Are you sure you want to delete ${selectedArray.length} products: ${names.join(', ')}${selectedArray.length > 3 ? '...' : ''}?`
    if (!confirm(`${msg} This action cannot be undone.`)) return
    try {
      const result = await bulkDeleteMutation.mutateAsync(selectedArray)
      toast({ title: "Success", description: `Successfully deleted ${(result as { deactivatedCount?: number })?.deactivatedCount || selectedArray.length} products!` })
      setSelectedProducts(new Set())
    } catch {
      toast({ title: "Error", description: "Failed to delete selected products.", variant: "destructive" })
    }
  }

  // ── Error state ──
  if (inventoryError) {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto mt-16">
          <Card>
            <CardContent className="p-6 text-center">
              <HiExclamationTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Error Loading Data</h2>
              <p className="text-gray-600 mb-4">There was an error loading the inventory data.</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded"></div>)}
          </div>
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded"></div>)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Inventory Management</h1>
          <p className="text-sm text-gray-600">Manage your product inventory and stock levels</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <HiMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search products or SKU..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2">
            <HiFunnel className="h-4 w-4" /> Filters
          </Button>
          <Button variant="outline" onClick={handleExportExcel} disabled={isExporting} className="flex items-center gap-2">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <HiArrowDownTray className="h-4 w-4" />}
            Download Excel
          </Button>
          <Button className="flex items-center gap-2" onClick={() => setShowAddModal(true)} disabled={!canAddProducts}>
            <HiPlus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Stats Cards — from backend /stats endpoint */}
      <div className={`grid ${canViewCostPrices ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${stockStatusFilter === "all" ? "ring-2 ring-blue-500" : ""}`}
          onClick={() => handleCardFilter("all")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Total Products</h3>
                <p className="text-xs text-gray-500">{stats?.activeProducts ?? 0} active</p>
              </div>
              <div className="text-2xl font-bold">{stats?.totalProducts ?? 0}</div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${stockStatusFilter !== "all" ? "ring-2 ring-blue-500" : ""}`}
          onClick={() => handleCardFilter(
            stockStatusFilter === "all"
              ? ((stats?.lowStock ?? 0) > 0 ? "low_stock" : "out_of_stock")
              : "all"
          )}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Alerts</h3>
                <p className="text-xs text-gray-500">
                  {(stats?.lowStock ?? 0) > 0 && `${stats!.lowStock} low stock`}
                  {(stats?.lowStock ?? 0) > 0 && (stats?.outOfStock ?? 0) > 0 ? ', ' : ''}
                  {(stats?.outOfStock ?? 0) > 0 && `${stats!.outOfStock} out of stock`}
                </p>
              </div>
              <div className="text-2xl font-bold text-red-600">
                {(stats?.lowStock ?? 0) + (stats?.outOfStock ?? 0)}
              </div>
            </div>
          </CardContent>
        </Card>

        {canViewCostPrices && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Total Value</h3>
                  <p className="text-xs text-gray-500">Current inventory value</p>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats?.totalValue ?? 0)}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filter Options */}
      {showFilters && (
        <div className="flex items-center gap-4">
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat: ProductCategory) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Brands" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map((brand: Brand) => (
                <SelectItem key={brand._id} value={brand._id}>{brand.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={stockStatusFilter} onValueChange={(v) => { setStockStatusFilter(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Stock Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="in_stock">In Stock</SelectItem>
              <SelectItem value="low_stock">Low Stock</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedProducts.size > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">{selectedProducts.size} selected</Badge>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}>
            {bulkDeleteMutation.isPending ? "Deleting..." : "Delete Selected"}
          </Button>
        </div>
      )}

      {/* Products Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} />
                </TableHead>
                <TableHead className="w-48">
                  <button onClick={() => handleSort('name')} className="flex items-center hover:text-blue-600 transition-colors">
                    Product Name {renderSortIcon('name')}
                  </button>
                </TableHead>
                <TableHead className="w-16 text-center">Unit</TableHead>
                <TableHead className="w-24 text-center">Capacity</TableHead>
                <TableHead className="w-32 text-center">
                  <button onClick={() => handleSort('category')} className="flex items-center justify-center hover:text-blue-600 transition-colors w-full">
                    Category {renderSortIcon('category')}
                  </button>
                </TableHead>
                <TableHead className="w-36 text-center">
                  <button onClick={() => handleSort('brand')} className="flex items-center justify-center hover:text-blue-600 transition-colors w-full">
                    Brand/Supplier {renderSortIcon('brand')}
                  </button>
                </TableHead>
                {canViewCostPrices && (
                  <TableHead className="w-24 text-center">
                    <button onClick={() => handleSort('costPrice')} className="flex items-center justify-center hover:text-blue-600 transition-colors w-full">
                      Cost Price {renderSortIcon('costPrice')}
                    </button>
                  </TableHead>
                )}
                <TableHead className="w-24 text-center">
                  <button onClick={() => handleSort('sellingPrice')} className="flex items-center justify-center hover:text-blue-600 transition-colors w-full">
                    Selling Price {renderSortIcon('sellingPrice')}
                  </button>
                </TableHead>
                <TableHead className="w-28 text-center">
                  <button onClick={() => handleSort('reorderPoint')} className="flex items-center justify-center hover:text-blue-600 transition-colors w-full">
                    Reorder Point {renderSortIcon('reorderPoint')}
                  </button>
                </TableHead>
                <TableHead className="w-28 text-center">
                  <button onClick={() => handleSort('currentStock')} className="flex items-center justify-center hover:text-blue-600 transition-colors w-full">
                    Current Stock {renderSortIcon('currentStock')}
                  </button>
                </TableHead>
                <TableHead className="w-28 text-center">Location</TableHead>
                <TableHead className="w-24 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product: Product) => {
                const stockStatus = getStockStatus(product)
                return (
                  <TableRow key={product._id} className="hover:bg-gray-50">
                    <TableCell>
                      <Checkbox
                        checked={selectedProducts.has(product._id)}
                        onCheckedChange={(checked) => handleSelectProduct(product._id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{product.name}</div>
                      {product.description && <div className="text-xs text-gray-500 truncate">{product.description}</div>}
                    </TableCell>
                    <TableCell className="text-center text-xs">{product.unitOfMeasurement?.name || 'N/A'}</TableCell>
                    <TableCell className="text-center text-xs">{product.containerCapacity || '-'}</TableCell>
                    <TableCell className="text-center text-xs">{product.category?.name || 'N/A'}</TableCell>
                    <TableCell className="text-center text-xs">{product.brand?.name || 'N/A'}</TableCell>
                    {canViewCostPrices && (
                      <TableCell className="text-center text-xs">{formatCurrency(product.costPrice || 0)}</TableCell>
                    )}
                    <TableCell className="text-center text-xs">{formatCurrency(product.sellingPrice || 0)}</TableCell>
                    <TableCell className="text-center text-xs">{product.reorderPoint || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-xs ${stockStatus.color}`}>
                        <span className="flex items-center gap-1">
                          {stockStatus.icon}
                          {product.currentStock ?? 0}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs">-</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)} disabled={!canEditProducts}
                          title={canEditProducts ? `Edit ${product.name}` : 'No permission to edit'}>
                          <HiPencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(product)}
                          disabled={deleteMutation.isPending || !canDeleteProducts}
                          className="hover:text-red-600"
                          title={canDeleteProducts ? `Delete ${product.name}` : 'No permission to delete'}>
                          <HiTrash className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination — server-side */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
          </p>
          <Select value={itemsPerPage.toString()} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1) }}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
              Previous
            </Button>
            <span className="px-3 py-1 text-sm">Page {currentPage} of {pagination.pages}</span>
            <Button variant="outline" onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))} disabled={currentPage === pagination.pages}>
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      <AddProductModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSubmit={handleAddProduct}
        categories={Array.isArray(categories) ? categories.filter(cat => cat && cat.id).map(cat => ({
          ...cat, id: cat.id, name: cat.name || 'Unknown Category'
        })) : []}
        units={Array.isArray(units) ? units : []}
        brands={Array.isArray(brands) ? brands.map(brand => ({
          ...brand, id: brand._id,
          status: brand.active ? 'active' as const : 'inactive' as const,
          isActive: brand.active, isExclusive: false
        })) : []}
        loading={createMutation.isPending || categoriesLoading || unitsLoading || brandsLoading}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        onSubmit={handleEditSubmit}
        product={productToEdit ? {
          ...productToEdit,
          brand: productToEdit.brand ? {
            id: productToEdit.brand._id || '',
            name: productToEdit.brand.name,
            status: 'active' as const, isActive: true, isExclusive: false
          } : undefined,
          sku: productToEdit.sku || '',
          unitOfMeasurement: productToEdit.unitOfMeasurement || { id: '', name: '', abbreviation: '', type: 'count' as const, isActive: true },
          quantity: productToEdit.currentStock,
          reorderPoint: productToEdit.reorderPoint || 0,
          currentStock: productToEdit.currentStock,
          availableStock: productToEdit.currentStock,
          reservedStock: 0,
          costPrice: productToEdit.costPrice || 0,
          sellingPrice: productToEdit.sellingPrice,
          status: productToEdit.isActive ? 'active' as const : 'inactive' as const,
          isActive: productToEdit.isActive,
          containerCapacity: productToEdit.containerCapacity || 1,
          category: productToEdit.category || { id: '', name: '', description: '', level: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() },
          createdAt: productToEdit.createdAt || new Date(),
          updatedAt: productToEdit.updatedAt || new Date()
        } : null}
        categories={Array.isArray(categories) ? categories.filter(cat => cat && cat.id).map(cat => ({
          ...cat, id: cat.id, name: cat.name || 'Unknown Category'
        })) : []}
        units={Array.isArray(units) ? units : []}
        brands={Array.isArray(brands) ? brands.map(brand => ({
          ...brand, id: brand._id,
          status: brand.active ? 'active' as const : 'inactive' as const,
          isActive: brand.active, isExclusive: false
        })) : []}
        loading={updateMutation.isPending || categoriesLoading || unitsLoading || brandsLoading}
      />

      {/* Delete Product Dialog */}
      <ProductDeleteDialog
        product={productToDelete ? {
          ...productToDelete,
          brand: productToDelete.brand ? {
            id: productToDelete.brand._id || '',
            name: productToDelete.brand.name,
            status: 'active' as const, isActive: true, isExclusive: false
          } : undefined,
          sku: productToDelete.sku || '',
          unitOfMeasurement: productToDelete.unitOfMeasurement || { id: '', name: '', abbreviation: '', type: 'count' as const, isActive: true },
          quantity: productToDelete.currentStock,
          reorderPoint: productToDelete.reorderPoint || 0,
          currentStock: productToDelete.currentStock,
          availableStock: productToDelete.currentStock,
          reservedStock: 0,
          costPrice: productToDelete.costPrice || 0,
          sellingPrice: productToDelete.sellingPrice,
          status: productToDelete.isActive ? 'active' as const : 'inactive' as const,
          isActive: productToDelete.isActive,
          containerCapacity: productToDelete.containerCapacity || 1,
          category: productToDelete.category || { id: '', name: '', description: '', level: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() },
          createdAt: productToDelete.createdAt || new Date(),
          updatedAt: productToDelete.updatedAt || new Date()
        } : null}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDeleteProduct}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
