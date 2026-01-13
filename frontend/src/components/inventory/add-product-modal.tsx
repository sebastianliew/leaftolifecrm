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
import { useToast } from "@/components/ui/toast"
import { usePermissions } from "@/hooks/usePermissions"
import type { ProductCategory, Brand } from "@/types/inventory/product.types"
import type { UnitOfMeasurement } from "@/types/units"

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  unitOfMeasurement: z.string().min(1, "Unit is required"),
  containerCapacity: z.number().min(0, "Capacity must be positive").optional(),
  brand: z.string().optional(),
  costPrice: z.number().min(0, "Cost price must be positive").optional(),
  sellingPrice: z.number().min(0, "Selling price must be positive").optional(),
  reorderPoint: z.number().min(0, "Reorder point must be positive"),
  currentStock: z.number().min(0, "Stock must be positive"),
  bundleInfo: z.string().optional(),
  bundlePrice: z.number().min(0, "Bundle price must be positive").optional(),
  category: z.string().min(1, "Category is required"),
})

type AddProductFormData = z.infer<typeof productSchema>

export interface AddProductSubmitData {
  name: string
  unitOfMeasurement: { id: string }
  category: { id: string }
  brand?: { id: string }
  containerType?: { id: string }
  containerCapacity?: number
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
        // Only include cost price if user has permission
        costPrice: canEditCostPrices ? data.costPrice : 0,
        sellingPrice: data.sellingPrice,
        reorderPoint: data.reorderPoint,
        // Always include current stock for product creation
        currentStock: data.currentStock || 0,
        bundleInfo: data.bundleInfo,
        bundlePrice: showBundlePrice ? data.bundlePrice : undefined,
        hasBundle: !!showBundlePrice
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reorderPoint">Reorder Point *</Label>
              <Input
                id="reorderPoint"
                type="number"
                step="0.01"
                {...register("reorderPoint", { valueAsNumber: true })}
                placeholder="10"
              />
              {errors.reorderPoint && (
                <p className="text-sm text-red-500">{errors.reorderPoint.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentStock">Current Stock *</Label>
              <Input
                id="currentStock"
                type="number"
                step="0.01"
                {...register("currentStock", {
                  setValueAs: (value) => {
                    return value === "" || value === undefined || isNaN(Number(value)) ? 0 : Number(value)
                  }
                })}
                placeholder="0"
                // Remove disabled state for stock field
                title="Enter the current stock quantity"
              />
              {errors.currentStock && (
                <p className="text-sm text-red-500">{errors.currentStock.message}</p>
              )}
              {/* Stock field is always enabled for product creation */}
            </div>
          </div>

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