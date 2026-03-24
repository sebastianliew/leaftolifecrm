"use client"

import { useState, useRef, useCallback, memo } from "react"
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
  HiExclamationCircle,
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
  useDeactivateInventoryItem,
  usePoolTransfer,
  useBulkDeleteInventoryItems,
  type InventoryFilters,
} from "@/hooks/queries/use-inventory-queries"
import { APIError, type ReferenceConflictDetails } from "@/lib/errors/api-error"
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
import { PoolTransferDialog } from "@/components/inventory/pool-transfer-dialog"
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

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// Isolated search input ΓÇö typing here does NOT
// re-render the parent InventoryPage component.
// Only calls onSearch (debounced) when the user
// stops typing for 400ms.
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const DebouncedSearchInput = memo(function DebouncedSearchInput({
  onSearch,
  placeholder = "Search products or SKU...",
}: {
  onSearch: (term: string) => void
  placeholder?: string
}) {
  const [value, setValue] = useState("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setValue(newValue)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onSearch(newValue)
    }, 400)
  }

  return (
    <div className="relative">
      <HiMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className="pl-10 w-64"
      />
    </div>
  )
})

export default function InventoryPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { hasPermission } = usePermissions()

  // Permissions
  const canViewCostPrices = hasPermission('inventory', 'canViewCostPrices')
  const canAddProducts = hasPermission('inventory', 'canAddProducts')
  const canEditProducts = hasPermission('inventory', 'canEditProducts')
  const canDeleteProducts = hasPermission('inventory', 'canDeleteProducts')

  // ΓöÇΓöÇ Server-side filter/sort/pagination state ΓöÇΓöÇ
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
  const [deleteConflict, setDeleteConflict] = useState<ReferenceConflictDetails | null>(null)
  const [poolProduct, setPoolProduct] = useState<Product | null>(null)
  const [showPoolDialog, setShowPoolDialog] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Stable callback ΓÇö passed to the isolated search component
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term)
    setCurrentPage(1)
  }, [])

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

  // ΓöÇΓöÇ Queries ΓöÇΓöÇ
  const { data: inventoryData, isLoading, isFetching, error: inventoryError } = useInventory(filters)
  // Only show full-page skeleton on the very first load (no data at all yet).
  // For subsequent searches/filters, data stays visible via placeholderData.
  const isInitialLoad = isLoading && !inventoryData
  const { data: stats } = useInventoryStats()
  const { data: brands = [], isLoading: brandsLoading } = useBrands()
  const { data: categories = [], isLoading: categoriesLoading } = useCategoriesQuery()
  const { data: units = [], isLoading: unitsLoading } = useUnitsQuery()

  const products = inventoryData?.products || []
  const pagination = inventoryData?.pagination || { total: 0, page: 1, limit: 20, pages: 0 }

  // ΓöÇΓöÇ Mutations ΓöÇΓöÇ
  const createMutation = useCreateInventoryItem()
  const updateMutation = useUpdateInventoryItem()
  const deleteMutation = useDeleteInventoryItem()
  const deactivateMutation = useDeactivateInventoryItem()
  const poolTransferMutation = usePoolTransfer()
  const bulkDeleteMutation = useBulkDeleteInventoryItems()

  // ΓöÇΓöÇ Stock status helper ΓöÇΓöÇ
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
        icon: <HiExclamationCircle className="w-3 h-3" />,
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

  // ΓöÇΓöÇ Sort handling ΓöÇΓöÇ
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

  // ΓöÇΓöÇ Selection handling ΓöÇΓöÇ
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

  // ΓöÇΓöÇ Filter card click (maps to stockStatus server param) ΓöÇΓöÇ
  const handleCardFilter = (filterType: string) => {
    setStockStatusFilter(filterType)
    setCurrentPage(1)
  }

  // ΓöÇΓöÇ Excel export (server-side, all products) ΓöÇΓöÇ
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

  // ΓöÇΓöÇ Add product ΓöÇΓöÇ
  const handleAddProduct = async (data: AddProductSubmitData) => {
    try {
      const created = await createMutation.mutateAsync({
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
        canSellLoose: data.canSellLoose,
        containerCapacity: data.containerCapacity,
      }) as unknown as { _id: string }

      // If user opened containers during creation, do the pool transfer immediately
      if (data.canSellLoose && data.initialContainersToOpen && data.initialContainersToOpen > 0 && created?._id) {
        try {
          await poolTransferMutation.mutateAsync({
            id: created._id,
            action: 'open',
            amount: data.initialContainersToOpen,
          })
        } catch (poolError) {
          // Don't fail the whole creation — product was saved, just warn about pool
          toast({ title: "Product created", description: `Product added but pool setup failed: ${poolError instanceof APIError ? poolError.message : 'Try opening containers from the edit screen.'}`, variant: "destructive" })
          setShowAddModal(false)
          return
        }
      }

      toast({ title: "Success", description: "Product added successfully!" })
      setShowAddModal(false)
    } catch (error) {
      console.error('Failed to add product:', error)
      toast({ title: "Error", description: error instanceof APIError ? error.message : "Failed to add product.", variant: "destructive" })
    }
  }

  // ΓöÇΓöÇ Edit product ΓöÇΓöÇ
  const handleEditProduct = (product: Product) => {
    setProductToEdit(product)
    setShowEditModal(true)
  }

  const handleEditSubmit = async (data: EditProductSubmitData) => {
    if (!productToEdit) return
    try {
      await updateMutation.mutateAsync({
        id: productToEdit._id,
        data: data as unknown as Record<string, unknown>,
      })
      toast({ title: "Success", description: `Product "${data.name}" updated successfully!` })
      setShowEditModal(false)
      setProductToEdit(null)
    } catch (error) {
      console.error('Failed to update product:', error)
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update product.", variant: "destructive" })
    }
  }

  // ΓöÇΓöÇ Delete product ΓöÇΓöÇ
  const handleDeleteProduct = (product: Product) => {
    setDeleteConflict(null)
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
      setDeleteConflict(null)
    } catch (error: unknown) {
      if (error instanceof APIError) {
        if (error.isReferenceConflict()) {
          // Transition dialog to conflict resolution mode — don't close it
          setDeleteConflict(error.details as ReferenceConflictDetails)
          return
        }
        if (error.isUnauthorized()) {
          toast({ title: "Error", description: "Authentication required. Please log in again.", variant: "destructive" })
        } else if (error.isForbidden()) {
          toast({ title: "Error", description: "You don't have permission to delete products.", variant: "destructive" })
        } else if (error.isNotFound()) {
          toast({ title: "Error", description: "Product not found. It may have already been deleted.", variant: "destructive" })
          setShowDeleteDialog(false)
          setProductToDelete(null)
        } else {
          toast({ title: "Error", description: error.message || "Failed to delete product.", variant: "destructive" })
        }
      } else {
        toast({ title: "Error", description: "Failed to delete product.", variant: "destructive" })
      }
    }
  }

  const handleDeactivateInstead = async () => {
    if (!productToDelete) return
    try {
      await deactivateMutation.mutateAsync(productToDelete._id)
      toast({ title: "Product Deactivated", description: `"${productToDelete.name}" has been deactivated and hidden from active use.` })
      setShowDeleteDialog(false)
      setProductToDelete(null)
      setDeleteConflict(null)
    } catch (error: unknown) {
      const msg = error instanceof APIError ? error.message : "Failed to deactivate product."
      toast({ title: "Error", description: msg, variant: "destructive" })
    }
  }

  // ΓöÇΓöÇ Bulk delete ΓöÇΓöÇ
  const handleOpenPoolDialog = (product: Product) => {
    setPoolProduct(product)
    setShowPoolDialog(true)
  }

  const handlePoolTransfer = async (action: "open" | "close", amount: number) => {
    if (!poolProduct) return
    try {
      await poolTransferMutation.mutateAsync({ id: poolProduct._id, action, amount })
      const unit = (poolProduct as unknown as { unitName?: string }).unitName || "units"
      const label = action === "open" ? "moved to loose pool" : "sealed back"
      toast({ title: "Pool Updated", description: `${amount} ${unit} ${label} for "${poolProduct.name}"` })
      setShowPoolDialog(false)
      setPoolProduct(null)
    } catch (error: unknown) {
      const msg = error instanceof APIError ? error.message : "Failed to update pool."
      toast({ title: "Error", description: msg, variant: "destructive" })
    }
  }

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

  // ΓöÇΓöÇ Error state ΓöÇΓöÇ
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

  // ΓöÇΓöÇ Loading state (only first load ΓÇö never unmounts the page after data exists) ΓöÇΓöÇ
  if (isInitialLoad) {
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
          <DebouncedSearchInput onSearch={handleSearch} />
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
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

      {/* Stats summary */}
      <div className="flex items-center gap-6 text-sm text-gray-600">
        <button onClick={() => handleCardFilter("all")} className={`hover:text-gray-900 ${stockStatusFilter === "all" ? "text-gray-900 font-semibold" : ""}`}>
          <strong className="text-gray-900">{stats?.totalProducts ?? 0}</strong> products ({stats?.activeProducts ?? 0} active)
        </button>
        <button onClick={() => handleCardFilter(stockStatusFilter === "all" ? ((stats?.lowStock ?? 0) > 0 ? "low_stock" : "out_of_stock") : "all")}
          className={`hover:text-gray-900 ${stockStatusFilter !== "all" ? "text-gray-900 font-semibold" : ""}`}>
          {(stats?.lowStock ?? 0) > 0 && <span className="text-amber-600">{stats!.lowStock} low stock</span>}
          {(stats?.lowStock ?? 0) > 0 && (stats?.outOfStock ?? 0) > 0 && <span> / </span>}
          {(stats?.outOfStock ?? 0) > 0 && <span className="text-red-600">{stats!.outOfStock} out of stock</span>}
          {(stats?.lowStock ?? 0) === 0 && (stats?.outOfStock ?? 0) === 0 && <span className="text-green-600">No alerts</span>}
        </button>
        {canViewCostPrices && (
          <span>Value: <strong className="text-gray-900">{formatCurrency(stats?.totalValue ?? 0)}</strong></span>
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
                <TableHead className="w-8">
                  <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} />
                </TableHead>
                <TableHead>
                  <button onClick={() => handleSort('name')} className="flex items-center hover:text-blue-600 transition-colors">
                    Product Name {renderSortIcon('name')}
                  </button>
                </TableHead>
                <TableHead className="text-center">Unit</TableHead>
                <TableHead className="text-center">Capacity</TableHead>
                <TableHead className="text-center">
                  <button onClick={() => handleSort('category')} className="flex items-center justify-center hover:text-blue-600 transition-colors w-full">
                    Category {renderSortIcon('category')}
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button onClick={() => handleSort('brand')} className="flex items-center justify-center hover:text-blue-600 transition-colors w-full">
                    Brand {renderSortIcon('brand')}
                  </button>
                </TableHead>
                {canViewCostPrices && (
                  <TableHead className="text-center">
                    <button onClick={() => handleSort('costPrice')} className="flex items-center justify-center hover:text-blue-600 transition-colors w-full">
                      Cost {renderSortIcon('costPrice')}
                    </button>
                  </TableHead>
                )}
                <TableHead className="text-center">
                  <button onClick={() => handleSort('sellingPrice')} className="flex items-center justify-center hover:text-blue-600 transition-colors w-full">
                    Price {renderSortIcon('sellingPrice')}
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button onClick={() => handleSort('reorderPoint')} className="flex items-center justify-center hover:text-blue-600 transition-colors w-full">
                    Reorder Pt {renderSortIcon('reorderPoint')}
                  </button>
                </TableHead>
                <TableHead className="text-center whitespace-nowrap">
                  <button onClick={() => handleSort('currentStock')} className="flex items-center justify-center hover:text-blue-600 transition-colors w-full">
                    Current Stock {renderSortIcon('currentStock')}
                  </button>
                </TableHead>
                <TableHead className="text-center">Actions</TableHead>
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
                    <TableCell className="text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <Badge className={`text-[11px] px-1.5 py-0 ${stockStatus.color}`}>
                          <span className="flex items-center gap-0.5">
                            {stockStatus.icon}
                            {(() => {
                              const stock = product.currentStock ?? 0;
                              const capacity = product.containerCapacity || 1;
                              const unit = product.unitOfMeasurement?.abbreviation || 'units';

                              if (capacity > 1) {
                                const containers = Math.floor(stock / capacity);
                                return `${stock}${unit} (${containers}${containers === 1 ? 'ctn' : 'ctns'})`;
                              }
                              return stock;
                            })()}
                          </span>
                        </Badge>
                        {(product.looseStock ?? 0) > 0 && (
                          <span className="text-[11px] text-green-700 font-medium">
                            ⚗️{product.looseStock} loose
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)} disabled={!canEditProducts}
                          title={canEditProducts ? `Edit ${product.name}` : 'No permission to edit'}>
                          <HiPencil className="h-3 w-3" />
                        </Button>
                        {product.canSellLoose && (product.containerCapacity ?? 1) > 1 && (
                          <Button variant="ghost" size="sm"
                            onClick={() => handleOpenPoolDialog(product)}
                            title="Manage loose pool — open or seal containers"
                            className="hover:text-blue-600">
                            <span className="text-xs font-bold leading-none">~</span>
                          </Button>
                        )}
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

      {/* Pagination ΓÇö server-side */}
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
          canSellLoose: productToEdit.canSellLoose,
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
          canSellLoose: productToDelete.canSellLoose,
          category: productToDelete.category || { id: '', name: '', description: '', level: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() },
          createdAt: productToDelete.createdAt || new Date(),
          updatedAt: productToDelete.updatedAt || new Date()
        } : null}
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open)
          if (!open) setDeleteConflict(null)
        }}
        onConfirm={confirmDeleteProduct}
        onDeactivateInstead={handleDeactivateInstead}
        loading={deleteMutation.isPending || deactivateMutation.isPending}
        conflictDetails={deleteConflict}
      />
      <PoolTransferDialog
        product={poolProduct}
        open={showPoolDialog}
        onOpenChange={(open) => {
          setShowPoolDialog(open)
          if (!open) setPoolProduct(null)
        }}
        onConfirm={handlePoolTransfer}
        loading={poolTransferMutation.isPending}
      />
    </div>
  )
}