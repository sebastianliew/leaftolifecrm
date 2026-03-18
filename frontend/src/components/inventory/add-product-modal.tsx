"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Package } from "lucide-react"
import { formatContainerBreakdown } from "@/lib/pricing"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/usePermissions"
import type { ProductCategory, Brand } from "@/types/inventory/product.types"
import type { UnitOfMeasurement } from "@/types/units"

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

type AddProductFormData = z.infer<typeof productSchema>

export interface AddProductSubmitData {
  name: string
  unitOfMeasurement: { id: string }
  category: { id: string }
  brand?: { id: string }
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
  initialContainersToOpen?: number
}

interface AddProductModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: AddProductSubmitData) => Promise<void>
  categories: ProductCategory[]
  units: UnitOfMeasurement[]
  brands: Brand[]
  loading?: boolean
}

export function AddProductModal({
  open,
  onOpenChange,
  onSubmit,
  categories,
  units,
  brands,
  loading = false
}: AddProductModalProps) {
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [containersToOpen, setContainersToOpen] = useState<number | "">(0)
  const [stockInputMode, setStockInputMode] = useState<'units' | 'containers'>('containers')
  
  // Check permissions
  const canAddProducts = hasPermission('inventory', 'canAddProducts')
  const canEditCostPrices = hasPermission('inventory', 'canEditCostPrices')
  // Remove stock permission check as it's causing issues with async permission loading
  const _canManageStock = true // Always allow stock management for product creation
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<AddProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      unitOfMeasurement: "",
      containerCapacity: 1,
      canSellLoose: false,
      brand: "",
      costPrice: undefined,
      sellingPrice: undefined,
      reorderPoint: 10,
      currentStock: 0,
      bundleInfo: "",
      bundlePrice: undefined,
      category: ""
    }
  })

  const bundleInfo = watch('bundleInfo')
  const showBundlePrice = bundleInfo && bundleInfo.trim() !== '' && bundleInfo !== '-'

  const _currentStockValue = watch("currentStock")

  const onFormSubmit = async (data: AddProductFormData) => {
    if (isSubmitting || loading) return
    
    // Check if user has permission to add products
    if (!canAddProducts) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to add products.",
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
        costPrice: canEditCostPrices ? data.costPrice : 0,
        sellingPrice: data.sellingPrice,
        reorderPoint: data.reorderPoint,
        // Always include current stock for product creation
        currentStock: data.currentStock || 0,
        bundleInfo: data.bundleInfo,
        bundlePrice: showBundlePrice ? data.bundlePrice : undefined,
        hasBundle: !!showBundlePrice,
        // containersToOpen always stores base units — no mode conversion needed
        initialContainersToOpen: (data.canSellLoose && containersToOpen) ? Number(containersToOpen) : 0,
      }

      await onSubmit(transformedData)
      reset()
      onOpenChange(false)
    } catch (error) {
      console.error('Form submission error:', error)
      toast({
        title: "Error",
        description: "Failed to add product. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    reset()
    setContainersToOpen(0)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Fill in the product details. Fields marked with * are required.
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
                    const categoryId = category.id || ''
                    if (!categoryId) return null
                    return (
                      <SelectItem key={categoryId} value={categoryId}>
                        {category.name || 'Unknown Category'}
                      </SelectItem>
                    )
                  }) : (
                    <SelectItem value="no-categories" disabled>No categories available</SelectItem>
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
                    <SelectItem value="no-units" disabled>No units available</SelectItem>
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

          {watch('canSellLoose') && (() => {
            const cap = watch('containerCapacity') || 1
            const stock = watch('currentStock') || 0
            const hasContainers = cap > 1
            const sealedContainers = hasContainers ? Math.floor(stock / cap) : stock
            const unitSel = units.find(u => (u._id || u.id) === watch('unitOfMeasurement'))
            const unitLabel = unitSel?.abbreviation || 'units'
            const inContainerMode = hasContainers && stockInputMode === 'containers'

            // containersToOpen always stores BASE UNITS — display is derived from mode
            const looseBaseUnits = Number(containersToOpen) || 0
            const displayLoose = inContainerMode ? Math.round(looseBaseUnits / cap) : looseBaseUnits
            const inputLabel = inContainerMode ? 'containers' : unitLabel

            const onLooseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target.value === '') { setContainersToOpen(''); return }
              const raw = Number(e.target.value)
              const baseUnits = inContainerMode ? Math.max(0, Math.round(raw)) * cap : Math.max(0, raw)
              setContainersToOpen(baseUnits)
            }

            return (
              <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4 space-y-3">
                <p className="text-sm font-medium text-blue-900">Loose Sale Pool</p>

                {/* Current stock summary */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border bg-white p-2 text-center">
                    <p className="text-xl font-bold text-gray-800">{sealedContainers}</p>
                    <p className="text-xs text-muted-foreground">Sealed containers</p>
                    {hasContainers && <p className="text-xs text-blue-600">{stock} {unitLabel} total</p>}
                  </div>
                  <div className="rounded-md border bg-white p-2 text-center">
                    <p className="text-xl font-bold text-green-700">{looseBaseUnits}</p>
                    <p className="text-xs text-muted-foreground">{unitLabel} loose on save</p>
                  </div>
                </div>

                {/* Amount to move to loose pool */}
                <div className="space-y-1">
                  <Label className="text-sm">Move to loose pool on creation ({inputLabel})</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={inContainerMode ? sealedContainers : stock}
                      step={inContainerMode ? "1" : "any"}
                      value={displayLoose}
                      onChange={onLooseChange}
                      placeholder="0"
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">{inputLabel}</span>
                  </div>
                  {looseBaseUnits > 0 && hasContainers && (
                    <p className="text-xs text-muted-foreground">
                      {inContainerMode
                        ? `= ${looseBaseUnits} ${unitLabel} (${cap} ${unitLabel} per container)`
                        : formatContainerBreakdown(looseBaseUnits, cap, unitLabel)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Leave at 0 to set up the loose pool later.</p>
                </div>
              </div>
            )
          })()}

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

            // All inputs are controlled via watch()/setValue() so toggling modes always reflects the correct value.
            // Hidden inputs sync the form for react-hook-form validation/submission.
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
              <div className="space-y-3">
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
                      value={displayStock} onChange={onStockChange} placeholder="0" />
                    {hasContainers && (
                      <p className="text-xs text-muted-foreground">
                        {inContainerMode
                          ? `= ${stockVal} ${unitLabel}`
                          : formatContainerBreakdown(stockVal, cap, unitLabel)}
                      </p>
                    )}
                    {errors.currentStock && <p className="text-sm text-red-500">{errors.currentStock.message}</p>}
                    <input type="hidden" {...register("currentStock", { setValueAs: (v) => v === "" || v === undefined || isNaN(Number(v)) ? 0 : Number(v) })} />
                  </div>
                </div>
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
              {(isSubmitting || loading) ? "Adding..." : "Add Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}