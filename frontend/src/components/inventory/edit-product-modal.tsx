"use client"

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { formatContainerBreakdown } from "@/lib/pricing"
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Package } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/usePermissions"
import { PoolManager } from "./pool-manager"
import type { Product, ProductCategory, UnitOfMeasurement, Brand } from "@/types/inventory"

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  unitOfMeasurement: z.string().min(1, "Unit is required"),
  containerCapacity: z.number().min(0, "Capacity must be positive").optional(),
  canSellLoose: z.boolean().optional(),
  brand: z.string().optional(),
  costPrice: z.number().min(0, "Cost price must be positive").optional(),
  sellingPrice: z.number().min(0, "Selling price must be positive").optional(),
  reorderPoint: z.number().min(0, "Reorder point must be positive"),
  currentStock: z.number().min(0, "Stock must be positive"),
  bundleInfo: z.string().optional(),
  bundlePrice: z.number().min(0, "Bundle price must be positive").optional(),
  category: z.string().min(1, "Category is required"),
}).refine(
  (data) => !data.canSellLoose || (data.containerCapacity !== undefined && data.containerCapacity > 1),
  {
    message: "Container capacity must be greater than 1 when loose selling is enabled (e.g. 75 for a 75ml bottle)",
    path: ["containerCapacity"],
  }
)

type EditProductFormData = z.infer<typeof productSchema>

export interface EditProductSubmitData {
  name: string
  unitOfMeasurement: { id: string }
  category: { id: string }
  brand?: { id: string }
  containerType?: { id: string }
  containerCapacity?: number
  canSellLoose?: boolean
  costPrice?: number
  sellingPrice?: number
  reorderPoint: number
  currentStock: number
  totalQuantity?: number
  expiryDate?: string
  bundleInfo?: string
  bundlePrice?: number
  hasBundle: boolean
}

interface EditProductModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: EditProductSubmitData) => Promise<void>
  product: Product | null
  categories: ProductCategory[]
  units: UnitOfMeasurement[]
  brands: Brand[]
  loading?: boolean
}

export function EditProductModal({
  open,
  onOpenChange,
  onSubmit,
  product,
  categories,
  units,
  brands,
  loading = false
}: EditProductModalProps) {
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stockInputMode, setStockInputMode] = useState<'units' | 'containers'>('containers')

  // Check permissions
  const canEditProducts = hasPermission('inventory', 'canEditProducts')
  const canEditCostPrices = hasPermission('inventory', 'canEditCostPrices')
  const canManageStock = hasPermission('inventory', 'canManageStock')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<EditProductFormData>({
    resolver: zodResolver(productSchema),
  })

  useEffect(() => {
    if (product && open) {
      const formData = {
        name: product.name,
        unitOfMeasurement: product.unitOfMeasurement._id || product.unitOfMeasurement.id || "",
        containerCapacity: product.containerCapacity || 1,
        canSellLoose: product.canSellLoose || false,
        brand: product.brand?._id || product.brand?.id || "_none",
        costPrice: product.costPrice || 0,
        sellingPrice: product.sellingPrice || 0,
        reorderPoint: product.reorderPoint || 10,
        currentStock: product.currentStock || 0,
        bundleInfo: product.bundleInfo?.hasBundle ? "Yes" : "",
        bundlePrice: product.bundleInfo?.bundlePrice || 0,
        category: product.category._id || product.category.id || ""
      }
      
      reset(formData)
    }
  }, [product, open, reset])

  const bundleInfo = watch('bundleInfo')
  const showBundlePrice = bundleInfo && bundleInfo.trim() !== '' && bundleInfo !== '-'

  const onFormSubmit = async (data: EditProductFormData) => {
    if (isSubmitting || loading || !product) return
    
    // Check if user has permission to edit
    if (!canEditProducts) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to edit products.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      // Transform data to match the expected format
      const transformedData = {
        name: data.name,
        unitOfMeasurement: { id: data.unitOfMeasurement },
        category: { id: data.category },
        brand: data.brand && data.brand !== '_none' ? { id: data.brand } : undefined,
        containerCapacity: data.containerCapacity,
        canSellLoose: data.canSellLoose || false,
        // Only include cost price if user has permission
        costPrice: canEditCostPrices ? data.costPrice : product.costPrice,
        sellingPrice: data.sellingPrice,
        reorderPoint: data.reorderPoint,
        // Only update stock if user has permission
        currentStock: canManageStock ? data.currentStock : product.currentStock,
        bundleInfo: data.bundleInfo,
        bundlePrice: showBundlePrice ? data.bundlePrice : undefined,
        hasBundle: !!showBundlePrice
      }

      await onSubmit(transformedData)
      onOpenChange(false)
    } catch (error) {
      console.error('Form submission error:', error)
      toast({
        title: "Error",
        description: "Failed to update product. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Update the product details. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          {/* Product Name and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Enter product name"
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select 
                value={watch('category') || ''} 
                onValueChange={(value) => setValue('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories && categories.length > 0 ? categories.map((category) => {
                    if (!category) return null
                    const categoryId = category._id || category.id || ''
                    if (!categoryId) return null
                    return (
                      <SelectItem key={categoryId} value={categoryId}>
                        {category.name || 'Unknown Category'}
                      </SelectItem>
                    )
                  }) : (
                    <SelectItem value="" disabled>No categories available</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-red-500">{errors.category.message}</p>
              )}
            </div>
          </div>

          {/* Unit and Capacity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unitOfMeasurement">Unit *</Label>
              <Select 
                value={watch('unitOfMeasurement') || ''} 
                onValueChange={(value) => setValue('unitOfMeasurement', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units && units.length > 0 ? units.map((unit) => {
                    if (!unit) return null
                    const unitId = unit._id || unit.id || ''
                    if (!unitId) return null
                    return (
                      <SelectItem key={unitId} value={unitId}>
                        {unit.name || 'Unknown'} ({unit.abbreviation || 'N/A'})
                      </SelectItem>
                    )
                  }) : (
                    <SelectItem value="" disabled>No units available</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.unitOfMeasurement && (
                <p className="text-sm text-red-500">{errors.unitOfMeasurement.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="containerCapacity">Container Capacity</Label>
              <Input
                id="containerCapacity"
                type="number"
                step="0.01"
                {...register("containerCapacity", { valueAsNumber: true })}
                placeholder="1"
              />
              {errors.containerCapacity && (
                <p className="text-sm text-red-500">{errors.containerCapacity.message}</p>
              )}
            </div>
          </div>

          {/* Can Sell Loose Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="canSellLoose" className="text-base font-medium cursor-pointer">
                  Can Sell Loose
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable selling individual units. When off, only whole containers can be sold.
                </p>
              </div>
            </div>
            <Switch
              id="canSellLoose"
              checked={watch('canSellLoose') || false}
              onCheckedChange={(checked) => setValue('canSellLoose', checked)}
            />
          </div>

          {/* Pool Manager — shown immediately when loose is enabled */}
          {watch('canSellLoose') && product && (
            <PoolManager
              product={{ ...product, ...{ canSellLoose: watch('canSellLoose'), containerCapacity: watch('containerCapacity') || product.containerCapacity } } as Product}
              onUpdate={(updated) => {
                setValue('currentStock', updated.currentStock || 0)
              }}
            />
          )}

          {/* Brand */}
          <div className="space-y-2">
            <Label htmlFor="brand">Brand/Supplier</Label>
            <Select 
              value={watch('brand') || ''} 
              onValueChange={(value) => setValue('brand', value || '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select brand (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No brand</SelectItem>
                {brands && brands.length > 0 ? brands.map((brand) => {
                  if (!brand) return null
                  const brandId = brand._id || brand.id || ''
                  if (!brandId) return null
                  return (
                    <SelectItem key={brandId} value={brandId}>
                      {brand.name || 'Unknown Brand'}
                    </SelectItem>
                  )
                }) : null}
              </SelectContent>
            </Select>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            {canEditCostPrices && (
              <div className="space-y-2">
                <Label htmlFor="costPrice">Cost Price</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  {...register("costPrice", { valueAsNumber: true })}
                  placeholder="0.00"
                />
                {errors.costPrice && (
                  <p className="text-sm text-red-500">{errors.costPrice.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="sellingPrice">Selling Price</Label>
              <Input
                id="sellingPrice"
                type="number"
                step="0.01"
                {...register("sellingPrice", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {errors.sellingPrice && (
                <p className="text-sm text-red-500">{errors.sellingPrice.message}</p>
              )}
            </div>
          </div>

          {/* Stock Information */}
          {(() => {
            const selUnit = units.find(u => (u._id || u.id) === watch('unitOfMeasurement'))
            const unitLabel = selUnit?.abbreviation || 'units'
            const cap = watch('containerCapacity') || 1
            const hasContainers = cap > 1
            const inContainerMode = hasContainers && stockInputMode === 'containers'

            const stockVal = watch('currentStock') || 0
            const reorderVal = watch('reorderPoint') || 0

            return (
              <div className="space-y-3">
                {/* Mode toggle — only shown for container products */}
                {hasContainers && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Enter as:</span>
                    <button type="button"
                      className={`px-2 py-1 rounded ${stockInputMode === 'containers' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                      onClick={() => setStockInputMode('containers')}>
                      Containers
                    </button>
                    <button type="button"
                      className={`px-2 py-1 rounded ${stockInputMode === 'units' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                      onClick={() => setStockInputMode('units')}>
                      {unitLabel}
                    </button>
                  </div>
                )}

                {(() => {
                  // All inputs are controlled via watch()/setValue() — no register() on visible inputs.
                  const displayStock = inContainerMode ? Math.round(stockVal / cap) : stockVal
                  const displayReorder = inContainerMode ? Math.round(reorderVal / cap) : reorderVal
                  const stepVal = inContainerMode ? '1' : '0.01'

                  const onStockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                    const raw = e.target.value === '' ? 0 : Number(e.target.value)
                    const baseUnits = inContainerMode ? Math.max(0, Math.round(raw)) * cap : Math.max(0, raw)
                    setValue('currentStock', +baseUnits.toFixed(2), { shouldValidate: true })
                  }
                  const onReorderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                    const raw = e.target.value === '' ? 0 : Number(e.target.value)
                    const baseUnits = inContainerMode ? Math.max(0, Math.round(raw)) * cap : Math.max(0, raw)
                    setValue('reorderPoint', +baseUnits.toFixed(2), { shouldValidate: true })
                  }

                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Reorder Point * {inContainerMode ? '(containers)' : `(${unitLabel})`}</Label>
                        <Input type="number" min="0" step={stepVal}
                          value={displayReorder} onChange={onReorderChange} placeholder="0" />
                        {hasContainers && (
                          <p className="text-xs text-muted-foreground">
                            {inContainerMode
                              ? `= ${reorderVal} ${unitLabel}`
                              : formatContainerBreakdown(reorderVal, cap, unitLabel)}
                          </p>
                        )}
                        {errors.reorderPoint && <p className="text-sm text-red-500">{errors.reorderPoint.message}</p>}
                        <input type="hidden" {...register("reorderPoint", { valueAsNumber: true })} />
                      </div>

                      <div className="space-y-2">
                        <Label>Current Stock * {inContainerMode ? '(containers)' : `(${unitLabel})`}</Label>
                        <Input type="number" min="0" step={stepVal}
                          value={displayStock} onChange={onStockChange} placeholder="0"
                          disabled={!canManageStock} />
                        {hasContainers && (
                          <p className="text-xs text-muted-foreground">
                            {inContainerMode
                              ? `= ${stockVal} ${unitLabel}`
                              : formatContainerBreakdown(stockVal, cap, unitLabel)}
                          </p>
                        )}
                        {errors.currentStock && <p className="text-sm text-red-500">{errors.currentStock.message}</p>}
                        {!canManageStock && <p className="text-sm text-yellow-600">Stock management requires permission</p>}
                        <input type="hidden" {...register("currentStock", { valueAsNumber: true })} />
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })()}

          {/* Bundle Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bundleInfo">Bundle Info</Label>
              <Input
                id="bundleInfo"
                {...register("bundleInfo")}
                placeholder="e.g., x3, bundle of 3 (leave empty if no bundle)"
              />
            </div>

            {showBundlePrice && (
              <div className="space-y-2">
                <Label htmlFor="bundlePrice">Bundle Price</Label>
                <Input
                  id="bundlePrice"
                  type="number"
                  step="0.01"
                  {...register("bundlePrice", { valueAsNumber: true })}
                  placeholder="0.00"
                />
                {errors.bundlePrice && (
                  <p className="text-sm text-red-500">{errors.bundlePrice.message}</p>
                )}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isSubmitting || loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || loading}
            >
              {(isSubmitting || loading) ? "Updating..." : "Update Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}