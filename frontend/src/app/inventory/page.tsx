"use client"

import { useState, useRef, useCallback, memo, useEffect } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
} from "@/components/ui/editorial"
import {
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
import { useContainerTypesQuery } from "@/hooks/queries/use-container-types-query"
import { useUnitsQuery } from "@/hooks/queries/use-units-query"
import { useBrands } from "@/hooks/queries/use-common-queries"
import { useToast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/utils"

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
// ── Editorial typography for the inventory page ──
function PoppinsStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap');
      .inv-page { font-family: 'Poppins', ui-sans-serif, system-ui, sans-serif; color: #0A0A0A; }
      .inv-page input::-webkit-outer-spin-button,
      .inv-page input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      .inv-page input[type=number] { -moz-appearance: textfield; }
      @keyframes invRise {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .inv-rise > * { animation: invRise 480ms cubic-bezier(0.2, 0.7, 0.1, 1) both; }
      .inv-rise > *:nth-child(1) { animation-delay: 30ms; }
      .inv-rise > *:nth-child(2) { animation-delay: 90ms; }
      .inv-rise > *:nth-child(3) { animation-delay: 150ms; }
      .inv-rise > *:nth-child(4) { animation-delay: 210ms; }
      .inv-rise > *:nth-child(5) { animation-delay: 270ms; }
      .inv-rise > *:nth-child(6) { animation-delay: 330ms; }
    `}</style>
  )
}

// ────────────────────────────────────────────────────────
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
    <div className="relative w-72">
      <HiMagnifyingGlass className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6B7280]" />
      <input
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className="w-full bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#0A0A0A] focus:outline-none focus:ring-0 pl-6 pr-2 py-2 text-sm text-[#0A0A0A] placeholder:text-[#9CA3AF] transition-colors"
      />
    </div>
  )
})

export default function InventoryPage() {
  const { toast } = useToast()
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

  // Stock-owed reconciliation modal: fires once per page mount when stats
  // load with at least one owed product. Closing it does not reopen until
  // the next navigation to this page.
  const [showOwedModal, setShowOwedModal] = useState(false)
  const owedModalShownRef = useRef(false)

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

  // Trigger the reconciliation modal when stats first arrives with owed > 0.
  // Tied to a ref so it fires exactly once per mount even if React re-renders.
  useEffect(() => {
    if (owedModalShownRef.current) return
    if (stats && (stats.stockOwed ?? 0) > 0) {
      owedModalShownRef.current = true
      setShowOwedModal(true)
    }
  }, [stats])
  const { data: brands = [], isLoading: brandsLoading } = useBrands()
  const { data: categories = [], isLoading: categoriesLoading } = useCategoriesQuery()
  const { data: containerTypes = [], isLoading: containerTypesLoading } = useContainerTypesQuery()
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
        category: data.category?.id,
        containerType: data.containerType.id,
        brand: data.brand?.id,
        unitOfMeasurement: data.unitOfMeasurement.id,
        currentStock: data.currentStock || 0,
        sellingPrice: data.sellingPrice || 0,
        sellingPriceBasis: data.sellingPriceBasis,
        ...(canViewCostPrices && data.costPrice !== undefined ? { costPrice: data.costPrice } : {}),
        ...(canViewCostPrices && data.costPriceBasis !== undefined ? { costPriceBasis: data.costPriceBasis } : {}),
        description: data.bundleInfo,
        status: 'active',
        canSellLoose: data.canSellLoose,
        containerCapacity: data.containerCapacity,
        discountFlags: data.discountFlags,
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

  // ── Error state ──
  if (inventoryError) {
    return (
      <div className="inv-page p-12 bg-white min-h-screen">
        <PoppinsStyle />
        <div className="max-w-lg mx-auto mt-24">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">Error</p>
          <h2 className="font-light text-[40px] leading-[1.05] mt-3 text-[#0A0A0A]">Could not load inventory.</h2>
          <p className="text-sm text-[#6B7280] mt-4 max-w-md">There was an error reaching the inventory service. Try reloading; if it persists, check the network log.</p>
          <button
            onClick={() => window.location.reload()}
            className="group inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-7 py-3 mt-8 text-[11px] uppercase tracking-[0.28em] hover:bg-black transition-colors"
          >
            Retry
            <span className="text-base normal-case tracking-normal opacity-80 group-hover:translate-x-0.5 transition-transform">→</span>
          </button>
        </div>
      </div>
    )
  }

  // ── Loading state (first load only) ──
  if (isInitialLoad) {
    return (
      <div className="inv-page p-12 bg-white min-h-screen">
        <PoppinsStyle />
        <div className="animate-pulse">
          <div className="h-3 w-32 bg-[#E5E7EB] mb-4" />
          <div className="h-12 w-1/2 bg-[#E5E7EB] mb-12" />
          <div className="grid grid-cols-4 gap-10 mb-12 border-y border-[#E5E7EB] py-8">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="h-2 w-16 bg-[#E5E7EB] mb-3" />
                <div className="h-10 w-20 bg-[#E5E7EB]" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => <div key={i} className="h-10 bg-[#F3F4F6]"></div>)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="inv-page bg-white min-h-screen">
      <PoppinsStyle />

      <div className="px-12 pt-12 pb-20 inv-rise">

        {/* ── Masthead ── */}
        <header className="flex items-end justify-between border-b border-[#E5E7EB] pb-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">Inventory</p>
            <h1 className="font-light text-[48px] leading-[1] mt-3 text-[#0A0A0A]">Ledger</h1>
            <p className="text-sm text-[#6B7280] mt-3 italic font-light">
              <span className="tabular-nums">{pagination.total}</span> products on file
              {isFetching && <span className="ml-2 text-[#9CA3AF]">· refreshing…</span>}
            </p>
          </div>
          <div className="flex items-center gap-7">
            <DebouncedSearchInput onSearch={handleSearch} />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`text-[11px] uppercase tracking-[0.28em] py-2 transition-colors flex items-center gap-2 ${showFilters ? 'text-[#0A0A0A] border-b border-[#0A0A0A]' : 'text-[#6B7280] hover:text-[#0A0A0A]'}`}
            >
              <HiFunnel className="h-3 w-3" /> Filter
            </button>
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280] hover:text-[#0A0A0A] py-2 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <HiArrowDownTray className="h-3 w-3" />}
              Export
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              disabled={!canAddProducts}
              className="group inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-7 py-2.5 text-[11px] uppercase tracking-[0.28em] hover:bg-black disabled:bg-[#9CA3AF] disabled:cursor-not-allowed transition-colors"
            >
              <HiPlus className="h-3 w-3" /> New product
              <span className="text-base normal-case tracking-normal opacity-80 group-hover:translate-x-0.5 transition-transform">→</span>
            </button>
          </div>
        </header>

        {/* ── Stats masthead ── */}
        <section className="grid grid-cols-4 gap-10 border-b border-[#E5E7EB] py-8">
          <button onClick={() => handleCardFilter("all")} className="text-left group">
            <p className={`text-[10px] uppercase tracking-[0.32em] transition-colors ${stockStatusFilter === "all" ? "text-[#0A0A0A]" : "text-[#6B7280] group-hover:text-[#0A0A0A]"}`}>
              i. Total products
            </p>
            <p className="font-light text-[44px] leading-none tabular-nums mt-3 text-[#0A0A0A]">{stats?.totalProducts ?? 0}</p>
            <p className="text-xs text-[#6B7280] mt-2 italic font-light">
              <span className="tabular-nums">{stats?.activeProducts ?? 0}</span> active
            </p>
          </button>

          <button onClick={() => handleCardFilter(stockStatusFilter === "out_of_stock" ? "all" : "out_of_stock")} className="text-left group">
            <p className={`text-[10px] uppercase tracking-[0.32em] transition-colors ${stockStatusFilter === "out_of_stock" ? "text-[#DC2626]" : "text-[#6B7280] group-hover:text-[#0A0A0A]"}`}>
              ii. Out of stock
            </p>
            <p className={`font-light text-[44px] leading-none tabular-nums mt-3 ${(stats?.outOfStock ?? 0) > 0 ? "text-[#DC2626]" : "text-[#16A34A]"}`}>
              {stats?.outOfStock ?? 0}
            </p>
            <p className="text-xs text-[#6B7280] mt-2 italic font-light">
              {(stats?.outOfStock ?? 0) > 0 ? "needs attention" : "all clear"}
            </p>
          </button>

          {(stats?.stockOwed ?? 0) > 0 ? (
            <button onClick={() => handleCardFilter(stockStatusFilter === "owed" ? "all" : "owed")} className="text-left group"
              title="Click to filter to owed items — these need restocking to reconcile reports">
              <p className={`text-[10px] uppercase tracking-[0.32em] transition-colors ${stockStatusFilter === "owed" ? "text-[#EA580C]" : "text-[#6B7280] group-hover:text-[#EA580C]"}`}>
                iii. Stock owed
              </p>
              <p className="font-light text-[44px] leading-none tabular-nums mt-3 text-[#EA580C]">
                {stats?.stockOwed ?? 0}
              </p>
              <p className="text-xs text-[#EA580C] mt-2 italic font-light">
                {canViewCostPrices && (stats?.totalOwedValue ?? 0) > 0
                  ? `${formatCurrency(stats?.totalOwedValue ?? 0)} to reconcile`
                  : "to reconcile"}
              </p>
            </button>
          ) : (
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-[#6B7280]">iii. Low stock</p>
              <p className="font-light text-[44px] leading-none tabular-nums mt-3 text-[#0A0A0A]">{stats?.lowStock ?? 0}</p>
              <p className="text-xs text-[#6B7280] mt-2 italic font-light">below threshold</p>
            </div>
          )}

          {canViewCostPrices ? (
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-[#6B7280]">iv. Inventory value</p>
              <p className="font-light text-[44px] leading-none tabular-nums mt-3 text-[#0A0A0A]">
                {formatCurrency(stats?.totalValue ?? 0)}
              </p>
              <p className="text-xs text-[#6B7280] mt-2 italic font-light">at cost</p>
            </div>
          ) : (
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-[#6B7280]">iv. Expiring</p>
              <p className="font-light text-[44px] leading-none tabular-nums mt-3 text-[#0A0A0A]">{stats?.expiringSoon ?? 0}</p>
              <p className="text-xs text-[#6B7280] mt-2 italic font-light">within 30 days</p>
            </div>
          )}
        </section>

        {/* ── Filters (collapsible) ── */}
        {showFilters && (
          <section className="border-b border-[#E5E7EB] py-6 grid grid-cols-3 gap-10">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280] mb-1">Category</p>
              <select value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1) }}
                className="w-full bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#0A0A0A] focus:outline-none focus:ring-0 px-0 py-2 text-sm text-[#0A0A0A] cursor-pointer"
              >
                <option value="all">All categories</option>
                {categories.map((cat: ProductCategory) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280] mb-1">Brand</p>
              <select value={brandFilter}
                onChange={(e) => { setBrandFilter(e.target.value); setCurrentPage(1) }}
                className="w-full bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#0A0A0A] focus:outline-none focus:ring-0 px-0 py-2 text-sm text-[#0A0A0A] cursor-pointer"
              >
                <option value="all">All brands</option>
                {brands.map((brand: Brand) => (
                  <option key={brand._id} value={brand._id}>{brand.name}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280] mb-1">Stock status</p>
              <select value={stockStatusFilter}
                onChange={(e) => { setStockStatusFilter(e.target.value); setCurrentPage(1) }}
                className="w-full bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#0A0A0A] focus:outline-none focus:ring-0 px-0 py-2 text-sm text-[#0A0A0A] cursor-pointer"
              >
                <option value="all">All stock</option>
                <option value="in_stock">In stock</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="owed">Stock owed</option>
              </select>
            </div>
          </section>
        )}

        {/* ── Bulk action bar (sticky reveal) ── */}
        {selectedProducts.size > 0 && (
          <div className="flex items-center justify-between bg-[#0A0A0A] text-white px-6 py-3 mt-6">
            <span className="text-[11px] uppercase tracking-[0.28em]">
              <span className="tabular-nums">{selectedProducts.size}</span> selected
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="text-[11px] uppercase tracking-[0.28em] text-[#FCA5A5] hover:text-white transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {bulkDeleteMutation.isPending ? "Deleting…" : "Delete selected"}
              <span className="text-base normal-case tracking-normal">→</span>
            </button>
          </div>
        )}

        {/* ── Ledger table ── */}
        <section className="mt-8">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#0A0A0A]">
                <th className="text-left py-3 pr-2 w-8 align-bottom">
                  <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} />
                </th>
                <th className="text-left py-3 align-bottom text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">
                  <button onClick={() => handleSort('name')} className="flex items-center hover:text-[#0A0A0A] transition-colors">
                    Product {renderSortIcon('name')}
                  </button>
                </th>
                <th className="text-left py-3 align-bottom text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Unit</th>
                <th className="text-right py-3 align-bottom text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Capacity</th>
                <th className="text-left py-3 align-bottom text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">
                  <button onClick={() => handleSort('category')} className="flex items-center hover:text-[#0A0A0A] transition-colors">
                    Category {renderSortIcon('category')}
                  </button>
                </th>
                <th className="text-left py-3 align-bottom text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">
                  <button onClick={() => handleSort('brand')} className="flex items-center hover:text-[#0A0A0A] transition-colors">
                    Brand {renderSortIcon('brand')}
                  </button>
                </th>
                {canViewCostPrices && (
                  <th className="text-right py-3 align-bottom text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">
                    <button onClick={() => handleSort('costPrice')} className="flex items-center justify-end w-full hover:text-[#0A0A0A] transition-colors">
                      Cost {renderSortIcon('costPrice')}
                    </button>
                  </th>
                )}
                <th className="text-right py-3 align-bottom text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">
                  <button onClick={() => handleSort('sellingPrice')} className="flex items-center justify-end w-full hover:text-[#0A0A0A] transition-colors">
                    Price {renderSortIcon('sellingPrice')}
                  </button>
                </th>
                <th className="text-right py-3 align-bottom text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">
                  <button onClick={() => handleSort('currentStock')} className="flex items-center justify-end w-full hover:text-[#0A0A0A] transition-colors">
                    On hand {renderSortIcon('currentStock')}
                  </button>
                </th>
                <th className="text-right py-3 align-bottom text-[10px] uppercase tracking-[0.28em] text-[#6B7280] w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product: Product) => {
                const stock = product.currentStock ?? 0
                const capacity = product.containerCapacity || 1
                const unit = product.unitOfMeasurement?.abbreviation || 'units'
                const isOut = stock <= 0
                const isOwed = stock < 0
                const stockColor = isOwed ? '#EA580C' : isOut ? '#DC2626' : '#0A0A0A'
                const containers = capacity > 1 ? Math.floor(Math.abs(stock) / capacity) : null

                return (
                  <tr key={product._id} className="border-b border-[#E5E7EB] hover:bg-[#FAFAFA] transition-colors group">
                    <td className="py-4 pr-2">
                      <Checkbox
                        checked={selectedProducts.has(product._id)}
                        onCheckedChange={(checked) => handleSelectProduct(product._id, checked as boolean)}
                      />
                    </td>
                    <td className="py-4 pr-4">
                      <p className="text-[14px] text-[#0A0A0A] font-medium">{product.name}</p>
                      {product.sku && <p className="text-[11px] text-[#9CA3AF] font-mono mt-0.5 tracking-wide">SKU · {product.sku}</p>}
                    </td>
                    <td className="py-4 text-[12px] text-[#6B7280]">{product.unitOfMeasurement?.name || '—'}</td>
                    <td className="text-right py-4 text-[12px] text-[#6B7280] tabular-nums">{product.containerCapacity || '—'}</td>
                    <td className="py-4 text-[12px] text-[#6B7280]">{product.category?.name || '—'}</td>
                    <td className="py-4 text-[12px] italic font-light text-[#6B7280]">{product.brand?.name || '—'}</td>
                    {canViewCostPrices && (
                      <td className="text-right py-4 text-[12px] text-[#6B7280] tabular-nums">{formatCurrency(product.costPrice || 0)}</td>
                    )}
                    <td className="text-right py-4 text-[13px] text-[#0A0A0A] tabular-nums">{formatCurrency(product.sellingPrice || 0)}</td>
                    <td className="text-right py-4">
                      <div className="flex flex-col items-end">
                        <p className="text-[16px] tabular-nums leading-none font-light" style={{ color: stockColor }}>
                          {stock}
                          <span className="text-[11px] text-[#9CA3AF] ml-1.5 font-normal">{unit}</span>
                        </p>
                        {containers !== null && stock !== 0 && (
                          <p className="text-[10px] italic text-[#9CA3AF] mt-1 font-light">
                            {containers} {containers === 1 ? 'ctn' : 'ctns'}
                          </p>
                        )}
                        {(product.looseStock ?? 0) > 0 && (
                          <p className="text-[10px] text-[#16A34A] mt-1 tracking-wide">
                            + {product.looseStock} loose
                          </p>
                        )}
                        {isOwed && (
                          <p className="text-[9px] uppercase tracking-[0.22em] text-[#EA580C] mt-1">Owed</p>
                        )}
                        {isOut && !isOwed && (
                          <p className="text-[9px] uppercase tracking-[0.22em] text-[#DC2626] mt-1">Out</p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditProduct(product)} disabled={!canEditProducts}
                          title={canEditProducts ? `Edit ${product.name}` : 'No permission to edit'}
                          className="text-[#6B7280] hover:text-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-30 transition-colors">
                          <HiPencil className="h-3.5 w-3.5" />
                        </button>
                        {product.canSellLoose && (product.containerCapacity ?? 1) > 1 && (
                          <button onClick={() => handleOpenPoolDialog(product)}
                            title="Manage loose pool — open or seal containers"
                            className="text-[#6B7280] hover:text-[#16A34A] transition-colors text-sm font-light italic leading-none">
                            ~
                          </button>
                        )}
                        <button onClick={() => handleDeleteProduct(product)}
                          disabled={deleteMutation.isPending || !canDeleteProducts}
                          title={canDeleteProducts ? `Delete ${product.name}` : 'No permission to delete'}
                          className="text-[#6B7280] hover:text-[#DC2626] disabled:cursor-not-allowed disabled:opacity-30 transition-colors">
                          <HiTrash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={canViewCostPrices ? 10 : 9} className="text-center py-20">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">Nothing to show</p>
                    <p className="text-sm italic font-light text-[#6B7280] mt-3">No products match the current filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* ── Pagination — editorial caption + arrow nav ── */}
        <div className="flex items-center justify-between mt-10">
          <div className="flex items-center gap-8">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280]">
              <span className="tabular-nums text-[#0A0A0A]">
                {pagination.total === 0 ? 0 : ((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>
              {' '}of{' '}
              <span className="tabular-nums text-[#0A0A0A]">{pagination.total}</span>
            </p>
            <select value={itemsPerPage.toString()}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1) }}
              className="bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#0A0A0A] focus:outline-none focus:ring-0 px-0 pb-1 text-[10px] uppercase tracking-[0.22em] text-[#6B7280] cursor-pointer"
            >
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center gap-7">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280] hover:text-[#0A0A0A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                <span className="text-base normal-case tracking-normal">←</span> Previous
              </button>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280]">
                Page <span className="tabular-nums text-[#0A0A0A]">{currentPage}</span> of <span className="tabular-nums text-[#0A0A0A]">{pagination.pages}</span>
              </p>
              <button onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))} disabled={currentPage === pagination.pages}
                className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280] hover:text-[#0A0A0A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                Next <span className="text-base normal-case tracking-normal">→</span>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Add Product Modal */}
      <AddProductModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSubmit={handleAddProduct}
        containerTypes={Array.isArray(containerTypes) ? containerTypes.filter(ct => ct && (ct.id || ct._id)).map(ct => ({
          ...ct, id: ct._id || ct.id, name: ct.name || 'Unknown'
        })) : []}
        categories={Array.isArray(categories) ? categories.filter(cat => cat && cat.id).map(cat => ({
          ...cat, id: cat.id, name: cat.name || 'Unknown Category'
        })) : []}
        units={Array.isArray(units) ? units : []}
        brands={Array.isArray(brands) ? brands.map(brand => ({
          ...brand, id: brand._id,
          status: brand.active ? 'active' as const : 'inactive' as const,
          isActive: brand.active, isExclusive: false
        })) : []}
        loading={createMutation.isPending || containerTypesLoading || categoriesLoading || unitsLoading || brandsLoading}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        onSubmit={handleEditSubmit}
        product={productToEdit ? {
          ...productToEdit,
          containerType: productToEdit.containerType || undefined,
          brand: productToEdit.brand ? {
            id: productToEdit.brand._id || '',
            name: productToEdit.brand.name,
            status: 'active' as const, isActive: true, isExclusive: false
          } : undefined,
          sku: productToEdit.sku || '',
          unitOfMeasurement: productToEdit.unitOfMeasurement || { id: '', name: '', abbreviation: '', type: 'count' as const, isActive: true },
          quantity: productToEdit.currentStock,
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
        containerTypes={Array.isArray(containerTypes) ? containerTypes.filter(ct => ct && (ct.id || ct._id)).map(ct => ({
          ...ct, id: ct._id || ct.id, name: ct.name || 'Unknown'
        })) : []}
        categories={Array.isArray(categories) ? categories.filter(cat => cat && cat.id).map(cat => ({
          ...cat, id: cat.id, name: cat.name || 'Unknown Category'
        })) : []}
        units={Array.isArray(units) ? units : []}
        brands={Array.isArray(brands) ? brands.map(brand => ({
          ...brand, id: brand._id,
          status: brand.active ? 'active' as const : 'inactive' as const,
          isActive: brand.active, isExclusive: false
        })) : []}
        loading={updateMutation.isPending || containerTypesLoading || categoriesLoading || unitsLoading || brandsLoading}
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

      {/* Stock Owed Reconciliation Modal */}
      <EditorialModal
        open={showOwedModal}
        onOpenChange={setShowOwedModal}
        kicker="Reconciliation"
        kickerTone="warning"
        title="Inventory needs reconciling."
      >
        <div className="flex items-baseline gap-3">
          <span className="font-light text-[56px] leading-none tabular-nums text-[#EA580C]">
            {stats?.stockOwed ?? 0}
          </span>
          <span className="text-sm text-[#6B7280] italic font-light">
            item{(stats?.stockOwed ?? 0) === 1 ? "" : "s"} owed from oversold sales
          </span>
        </div>
        {canViewCostPrices && (stats?.totalOwedValue ?? 0) > 0 && (
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280] mt-3">
            Est. value <span className="tabular-nums text-[#0A0A0A] normal-case tracking-normal text-sm ml-1">{formatCurrency(stats?.totalOwedValue ?? 0)}</span>
          </p>
        )}

        <div className="mt-7 border-l-2 border-[#EA580C] bg-[#FFF7ED] px-5 py-4">
          <p className="text-[13px] text-[#0A0A0A] leading-relaxed">
            Reports stay accurate only when these items are restocked back to their real physical count.
            Open <span className="text-[#EA580C]">Owed items</span> to reconcile now.
          </p>
        </div>

        <EditorialModalFooter>
          <EditorialButton variant="ghost" onClick={() => setShowOwedModal(false)}>
            Remind me later
          </EditorialButton>
          <EditorialButton
            variant="primary"
            arrow
            onClick={() => {
              setStockStatusFilter("owed")
              setCurrentPage(1)
              setShowOwedModal(false)
            }}
          >
            Show owed items
          </EditorialButton>
        </EditorialModalFooter>
      </EditorialModal>
    </div>
  )
}
