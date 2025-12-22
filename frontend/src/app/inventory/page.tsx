"use client"

import { useState, useEffect } from "react"
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
  HiFunnel 
} from "react-icons/hi2"
import { useInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem, useBulkDeleteInventoryItems } from "@/hooks/queries/use-inventory-queries"
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

interface Brand {
  _id: string;
  name: string;
  description?: string;
  active: boolean;
}

interface Product {
  _id: string
  name: string
  brandName?: string
  brand?: { _id?: string; name: string }
  category?: string | ProductCategory
  sku?: string
  stock: number
  price: number
  costPrice?: number
  reorderLevel?: number
  maxStock?: number
  unitOfMeasure?: string
  supplierId?: string | { _id: string; [key: string]: unknown }
  supplierName?: string
  location?: string
  batchNumber?: string
  expiryDate?: string | Date
  description?: string
  isActive: boolean
  createdAt?: string | Date
  updatedAt?: string | Date
}

export default function InventoryPage() {
  const { data: products = [], isLoading: loading, error: inventoryError } = useInventory(false)
  const { data: brands = [], isLoading: brandsLoading } = useBrands()
  const { data: categories = [], isLoading: categoriesLoading } = useCategoriesQuery()
  const { data: units = [], isLoading: unitsLoading } = useUnitsQuery()
  const { toast } = useToast()

  // Test soft delete verification - temporary debug call
  useInventory(true) // includeInactive = true

  // Pre-load all dropdown data when page mounts for instant UX
  useEffect(() => {
    // Data automatically loads due to React Query hooks above
    if (process.env.NODE_ENV === 'development') {
      console.log('📦 Inventory data loaded:', { categories: categories.length, units: units.length, brands: brands.length });
      console.log('🏷️ Categories data:', categories);
      console.log('🔍 Categories loading state:', categoriesLoading);
      
      // Debug the categories filtering
      const filteredCategoriesForModal = Array.isArray(categories) ? 
        categories.filter(cat => cat && cat.id) : []
      console.log('🎯 Filtered categories for modal:', filteredCategoriesForModal);
      console.log('🎯 Categories that failed filter:', categories.filter(cat => !cat || !cat.id));
    }
  }, [categories, units.length, brands.length, categoriesLoading])

  // Mutations
  const createMutation = useCreateInventoryItem()
  const updateMutation = useUpdateInventoryItem()
  const deleteMutation = useDeleteInventoryItem()
  const bulkDeleteMutation = useBulkDeleteInventoryItems()

  // Permissions based on user role and feature permissions
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const canViewCostPrices = user?.role === 'super_admin' || user?.role === 'admin'
  const canAddProducts = hasPermission('inventory', 'canAddProducts')
  const canEditProducts = hasPermission('inventory', 'canEditProducts')
  const canDeleteProducts = hasPermission('inventory', 'canDeleteProducts')


  // State
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [brandFilter, setBrandFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [alertFilter, setAlertFilter] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState<string>("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [productToEdit, setProductToEdit] = useState<Product | null>(null)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Filtering logic
  const filteredProducts = products.filter((product) => {
    const matchesSearch = !searchTerm || 
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (typeof product.category === 'string' ? 
        product.category.toLowerCase().includes(searchTerm.toLowerCase()) :
        (product.category as ProductCategory)?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    
    const matchesCategory = categoryFilter === "all" || 
      (typeof product.category === 'string' ? 
        product.category === categoryFilter :
        (product.category as ProductCategory)?.name === categoryFilter || (product.category as ProductCategory)?._id === categoryFilter
      )
    const matchesBrand = brandFilter === "all" || product.brand?._id === brandFilter
    const matchesStatus = statusFilter === "all" || (product.isActive ? "active" : "inactive") === statusFilter
    
    const matchesAlert = alertFilter === "all" || (() => {
      const isOutOfStock = product.stock <= 0
      const isLowStock = product.stock <= (product.reorderLevel || 0) && product.stock > 0
      const isExpired = product.expiryDate && new Date(product.expiryDate) < new Date()
      const isExpiringSoon = product.expiryDate && (() => {
        const expiryDate = new Date(product.expiryDate)
        const today = new Date()
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return daysUntilExpiry >= 0 && daysUntilExpiry <= 30
      })()

      switch (alertFilter) {
        case "low_stock": return isLowStock
        case "out_of_stock": return isOutOfStock
        case "expired": return isExpired
        case "expiring_soon": return isExpiringSoon
        default: return true
      }
    })()
    
    return matchesSearch && matchesCategory && matchesBrand && matchesStatus && matchesAlert
  })

  // Sorting logic
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let aValue: string | number, bValue: string | number
    
    switch (sortBy) {
      case 'name':
        aValue = a.name?.toLowerCase() || ''
        bValue = b.name?.toLowerCase() || ''
        break
      case 'category':
        aValue = (typeof a.category === 'string' ? a.category : (a.category as ProductCategory)?.name || '').toLowerCase()
        bValue = (typeof b.category === 'string' ? b.category : (b.category as ProductCategory)?.name || '').toLowerCase()
        break
      case 'brand':
        aValue = a.brandName?.toLowerCase() || ''
        bValue = b.brandName?.toLowerCase() || ''
        break
      case 'stock':
        aValue = a.stock || 0
        bValue = b.stock || 0
        break
      case 'price':
        aValue = a.price || 0
        bValue = b.price || 0
        break
      case 'costPrice':
        aValue = a.costPrice || 0
        bValue = b.costPrice || 0
        break
      case 'reorderPoint':
        aValue = a.reorderLevel || 0
        bValue = b.reorderLevel || 0
        break
      default:
        return 0
    }
    
    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  // Pagination
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedProducts = sortedProducts.slice(startIndex, startIndex + itemsPerPage)

  // Stats calculations
  const totalProducts = products.length
  const activeProducts = products.filter(p => p.isActive).length
  const lowStockProducts = products.filter(p => p.stock <= (p.reorderLevel || 0) && p.stock > 0).length
  const outOfStockProducts = products.filter(p => p.stock <= 0).length
  const expiredProducts = products.filter(p => {
    if (!p.expiryDate) return false
    return new Date(p.expiryDate) < new Date()
  }).length
  const expiringSoonProducts = products.filter(p => {
    if (!p.expiryDate) return false
    const expiryDate = new Date(p.expiryDate)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 30
  }).length

  // Stock status helper
  const getStockStatus = (product: Product) => {
    if (product.stock <= 0) {
      return { 
        status: "out", 
        color: "bg-red-100 text-red-800", 
        icon: <HiExclamationTriangle className="w-3 h-3" />,
        text: "Out of Stock"
      }
    }
    if (product.stock <= (product.reorderLevel || 0)) {
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

  // Sort handling
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) return null
    return sortOrder === 'asc' ? 
      <HiChevronUp className="w-3 h-3 ml-1" /> : 
      <HiChevronDown className="w-3 h-3 ml-1" />
  }

  // Selection handling
  const handleSelectProduct = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts)
    if (checked) {
      newSelected.add(productId)
    } else {
      newSelected.delete(productId)
    }
    setSelectedProducts(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(paginatedProducts.map(p => p._id)))
    } else {
      setSelectedProducts(new Set())
    }
  }

  const isAllSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedProducts.has(p._id))

  // Filter handling
  const handleCardFilter = (filterType: string) => {
    setAlertFilter(filterType)
  }

  // Add product handler
  const handleAddProduct = async (data: AddProductSubmitData) => {
    try {
      const inventoryData = {
        name: data.name,
        category: data.category.id,
        brand: data.brand?.id,
        unitOfMeasurement: data.unitOfMeasurement.id,
        stock: data.currentStock || 0,
        price: data.sellingPrice || 0,
        costPrice: data.costPrice || 0,
        reorderLevel: data.reorderPoint || 10,
        description: data.bundleInfo,
        status: 'active',
      }

      await createMutation.mutateAsync(inventoryData)
      toast({
        title: "Success",
        description: "Product added successfully!",
      })
      setShowAddModal(false)
    } catch (error) {
      console.error('Failed to add product:', error)
      toast({
        title: "Error", 
        description: "Failed to add product. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }

  // Edit handler
  const handleEditProduct = (product: Product) => {
    setProductToEdit(product)
    setShowEditModal(true)
  };

  // Edit product handler
  const handleEditSubmit = async (data: EditProductSubmitData) => {
    if (!productToEdit) return;
    
    try {
      const inventoryData = {
        name: data.name,
        category: data.category.id,
        brand: data.brand?.id,
        unitOfMeasurement: data.unitOfMeasurement.id,
        stock: data.currentStock || 0,
        price: data.sellingPrice || 0,
        costPrice: data.costPrice || 0,
        reorderLevel: data.reorderPoint || 10,
        description: data.bundleInfo,
        status: 'active',
      }

      await updateMutation.mutateAsync({ 
        id: productToEdit._id, 
        data: inventoryData 
      })
      
      toast({
        title: "Success",
        description: "Product updated successfully!",
      })
      setShowEditModal(false)
      setProductToEdit(null)
    } catch (error) {
      console.error('Failed to update product:', error)
      toast({
        title: "Error", 
        description: "Failed to update product. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  };

  // Single delete handler
  const handleDeleteProduct = (product: Product) => {
    setProductToDelete(product)
    setShowDeleteDialog(true)
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;

    try {
      await deleteMutation.mutateAsync(productToDelete._id);
      toast({
        title: "Success",
        description: `Product "${productToDelete.name}" deleted successfully!`,
      });
      setShowDeleteDialog(false)
      setProductToDelete(null)
    } catch (error: unknown) {
      console.error('Failed to delete product:', error);
      
      let errorMessage = "Failed to delete product. Please try again.";
      
      if (error instanceof Error && error.message?.includes('401')) {
        errorMessage = "Authentication required. Please log in again.";
      } else if (error instanceof Error && error.message?.includes('403')) {
        errorMessage = "You don't have permission to delete products. Contact your administrator.";
      } else if (error instanceof Error && error.message?.includes('404')) {
        errorMessage = "Product not found. It may have already been deleted.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    const selectedArray = Array.from(selectedProducts);
    if (selectedArray.length === 0) return;

    const selectedProductNames = paginatedProducts
      .filter(p => selectedProducts.has(p._id))
      .map(p => p.name)
      .slice(0, 3); // Show first 3 names

    const confirmMessage = selectedArray.length === 1 
      ? `Are you sure you want to delete "${selectedProductNames[0]}"?`
      : `Are you sure you want to delete ${selectedArray.length} products${selectedArray.length > 3 ? ' including' : ':'} ${selectedProductNames.join(', ')}${selectedArray.length > 3 ? '...' : ''}?`;

    if (!confirm(`${confirmMessage} This action cannot be undone.`)) {
      return;
    }

    try {
      const result = await bulkDeleteMutation.mutateAsync(selectedArray);
      toast({
        title: "Success",
        description: `Successfully deleted ${(result as { deactivatedCount?: number })?.deactivatedCount || selectedArray.length} products!`,
      });
      setSelectedProducts(new Set()); // Clear selection
    } catch (error) {
      console.error('Failed to bulk delete products:', error);
      toast({
        title: "Error", 
        description: "Failed to delete selected products. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Error state  
  if (inventoryError) {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto mt-16">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="mb-4">
                <HiExclamationTriangle className="h-12 w-12 text-red-500 mx-auto" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Error Loading Data</h2>
              <p className="text-gray-600 mb-4">
                There was an error loading the inventory data. Please try again.
              </p>
              <Button onClick={() => window.location.reload()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded"></div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded"></div>
            ))}
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
          <p className="text-sm text-gray-600">
            Manage your product inventory and stock levels
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <HiMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search products or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <HiFunnel className="h-4 w-4" />
            Filters
          </Button>

          <Button 
            className="flex items-center gap-2"
            onClick={() => setShowAddModal(true)}
            disabled={!canAddProducts}
          >
            <HiPlus className="h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={`grid ${canViewCostPrices ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${alertFilter === "all" ? "ring-2 ring-blue-500" : ""}`}
          onClick={() => handleCardFilter("all")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Total Products</h3>
                <p className="text-xs text-gray-500">{activeProducts} active</p>
              </div>
              <div className="text-2xl font-bold">{totalProducts}</div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${alertFilter !== "all" ? "ring-2 ring-blue-500" : ""}`}
          onClick={() => handleCardFilter(lowStockProducts > 0 ? "low_stock" : outOfStockProducts > 0 ? "out_of_stock" : expiredProducts > 0 ? "expired" : "expiring_soon")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Alerts</h3>
                <p className="text-xs text-gray-500">
                  {lowStockProducts > 0 && `${lowStockProducts} low stock`}
                  {lowStockProducts > 0 && outOfStockProducts > 0 ? ', ' : ''}
                  {outOfStockProducts > 0 && `${outOfStockProducts} out of stock`}
                  {(lowStockProducts > 0 || outOfStockProducts > 0) && (expiredProducts > 0 || expiringSoonProducts > 0) ? ', ' : ''}
                  {expiredProducts > 0 && `${expiredProducts} expired`}
                  {expiredProducts > 0 && expiringSoonProducts > 0 ? ', ' : ''}
                  {expiringSoonProducts > 0 && `${expiringSoonProducts} expiring soon`}
                </p>
              </div>
              <div className="text-2xl font-bold text-red-600">
                {lowStockProducts + outOfStockProducts + expiredProducts + expiringSoonProducts}
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
                  {formatCurrency(products.reduce((sum, p) => sum + p.stock * p.price, 0))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>


      {/* Filter Options */}
      {showFilters && (
        <div className="flex items-center gap-4">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category: ProductCategory) => (
                <SelectItem key={category.id} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map((brand: Brand) => (
                <SelectItem key={brand._id} value={brand._id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedProducts.size > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {selectedProducts.size} selected
          </Badge>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
          >
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
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-48">
                  <button 
                    onClick={() => handleSort('name')}
                    className="flex items-center hover:text-blue-600 transition-colors"
                  >
                    Product Name
                    {renderSortIcon('name')}
                  </button>
                </TableHead>
                <TableHead className="w-16 text-center">Unit</TableHead>
                <TableHead className="w-32 text-center">
                  <button 
                    onClick={() => handleSort('category')}
                    className="flex items-center justify-center hover:text-blue-600 transition-colors w-full"
                  >
                    Category
                    {renderSortIcon('category')}
                  </button>
                </TableHead>
                <TableHead className="w-36 text-center">
                  <button 
                    onClick={() => handleSort('brand')}
                    className="flex items-center justify-center hover:text-blue-600 transition-colors w-full"
                  >
                    Brand/Supplier
                    {renderSortIcon('brand')}
                  </button>
                </TableHead>
                {canViewCostPrices && (
                  <TableHead className="w-24 text-center">
                    <button 
                      onClick={() => handleSort('costPrice')}
                      className="flex items-center justify-center hover:text-blue-600 transition-colors w-full"
                    >
                      Cost Price
                      {renderSortIcon('costPrice')}
                    </button>
                  </TableHead>
                )}
                <TableHead className="w-24 text-center">
                  <button 
                    onClick={() => handleSort('price')}
                    className="flex items-center justify-center hover:text-blue-600 transition-colors w-full"
                  >
                    Selling Price
                    {renderSortIcon('price')}
                  </button>
                </TableHead>
                <TableHead className="w-28 text-center">
                  <button 
                    onClick={() => handleSort('reorderPoint')}
                    className="flex items-center justify-center hover:text-blue-600 transition-colors w-full"
                  >
                    Reorder Point
                    {renderSortIcon('reorderPoint')}
                  </button>
                </TableHead>
                <TableHead className="w-28 text-center">
                  <button 
                    onClick={() => handleSort('stock')}
                    className="flex items-center justify-center hover:text-blue-600 transition-colors w-full"
                  >
                    Current Stock
                    {renderSortIcon('stock')}
                  </button>
                </TableHead>
                <TableHead className="w-28 text-center">Location</TableHead>
                <TableHead className="w-24 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.map((product: Product) => {
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
                      {product.description && (
                        <div className="text-xs text-gray-500 truncate">{product.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {product.unitOfMeasure || 'N/A'}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {typeof product.category === 'string' ? product.category : product.category?.name || 'N/A'}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {product.brandName || product.supplierName || 'N/A'}
                    </TableCell>
                    {canViewCostPrices && (
                      <TableCell className="text-center text-xs">
                        {formatCurrency(product.costPrice || 0)}
                      </TableCell>
                    )}
                    <TableCell className="text-center text-xs">
                      {formatCurrency(product.price)}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {product.reorderLevel || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-xs ${stockStatus.color}`}>
                        <span className="flex items-center gap-1">
                          {stockStatus.icon}
                          {product.stock}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {product.location || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            handleEditProduct(product);
                          }}
                          disabled={!canEditProducts}
                          title={canEditProducts ? `Edit ${product.name}` : 'No permission to edit'}
                        >
                          <HiPencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDeleteProduct(product);
                          }}
                          disabled={deleteMutation.isPending || !canDeleteProducts}
                          className="hover:text-red-600"
                          title={canDeleteProducts ? `Delete ${product.name}` : 'No permission to delete'}
                        >
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

      {/* Pagination and Per Page Control */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedProducts.length)} of {sortedProducts.length} results
          </p>
          <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="px-3 py-1 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
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
        categories={Array.isArray(categories) ? categories.filter(cat => cat && cat.id).map(category => ({
          ...category,
          id: category.id,
          name: category.name || 'Unknown Category'
        })) : []}
        units={Array.isArray(units) ? units : []}
        brands={Array.isArray(brands) ? brands.map(brand => ({
          ...brand,
          id: brand._id,
          status: brand.active ? 'active' as const : 'inactive' as const,
          isActive: brand.active,
          isExclusive: false
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
            status: 'active' as const,
            isActive: true,
            isExclusive: false
          } : undefined,
          sku: productToEdit.sku || '',
          unitOfMeasurement: { 
            id: units.find(u => u.name === productToEdit.unitOfMeasure)?._id || '', 
            name: productToEdit.unitOfMeasure || '', 
            abbreviation: '', 
            type: 'count' as const, 
            isActive: true 
          },
          quantity: productToEdit.stock,
          reorderPoint: productToEdit.reorderLevel || 0,
          currentStock: productToEdit.stock,
          availableStock: productToEdit.stock,
          reservedStock: 0,
          costPrice: productToEdit.costPrice || 0,
          sellingPrice: productToEdit.price,
          status: productToEdit.isActive ? 'active' as const : 'inactive' as const,
          isActive: productToEdit.isActive,
          containerCapacity: 1,
          category: { 
            id: categories.find(c => c.name === (typeof productToEdit.category === 'string' ? productToEdit.category : productToEdit.category?.name))?.id || '', 
            name: typeof productToEdit.category === 'string' ? productToEdit.category : productToEdit.category?.name || '', 
            description: '', 
            level: 1, 
            isActive: true, 
            createdAt: new Date(), 
            updatedAt: new Date() 
          },
          createdAt: productToEdit.createdAt || new Date(),
          updatedAt: productToEdit.updatedAt || new Date()
        } : null}
        categories={Array.isArray(categories) ? categories.filter(cat => cat && cat.id).map(category => ({
          ...category,
          id: category.id,
          name: category.name || 'Unknown Category'
        })) : []}
        units={Array.isArray(units) ? units : []}
        brands={Array.isArray(brands) ? brands.map(brand => ({
          ...brand,
          id: brand._id,
          status: brand.active ? 'active' as const : 'inactive' as const,
          isActive: brand.active,
          isExclusive: false
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
            status: 'active' as const,
            isActive: true,
            isExclusive: false
          } : undefined,
          sku: productToDelete.sku || '',
          unitOfMeasurement: { id: '', name: productToDelete.unitOfMeasure || '', abbreviation: '', type: 'count' as const, isActive: true },
          quantity: productToDelete.stock,
          reorderPoint: productToDelete.reorderLevel || 0,
          currentStock: productToDelete.stock,
          availableStock: productToDelete.stock,
          reservedStock: 0,
          costPrice: productToDelete.costPrice || 0,
          sellingPrice: productToDelete.price,
          status: productToDelete.isActive ? 'active' as const : 'inactive' as const,
          isActive: productToDelete.isActive,
          containerCapacity: 1,
          category: { id: '', name: typeof productToDelete.category === 'string' ? productToDelete.category : productToDelete.category?.name || '', description: '', level: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() },
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