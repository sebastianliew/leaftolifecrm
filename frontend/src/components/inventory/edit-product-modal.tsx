"use client"

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { formatContainerBreakdown } from "@/lib/pricing"
import { z } from 'zod'
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-client"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/usePermissions"
import { useRestock } from "@/hooks/useRestock"
import { PoolManager } from "./pool-manager"
import type { Product, ProductCategory, UnitOfMeasurement, Brand } from "@/types/inventory"
import type { ContainerType } from "@/types/inventory/container-type.types"

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  containerType: z.string().min(1, "Container type is required"),
  unitOfMeasurement: z.string().min(1, "Unit is required"),
  containerCapacity: z.number().min(0, "Capacity must be positive").optional(),
  canSellLoose: z.boolean().optional(),
  brand: z.string().optional(),
  costPrice: z.number().min(0, "Cost price must be positive").optional(),
  sellingPrice: z.number().min(0, "Selling price must be positive").optional(),
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

/** API-ready payload — all IDs are flat strings, no nested objects. */
export interface EditProductSubmitData {
  name: string
  unitOfMeasurement: string
  containerType: string
  category?: string
  brand?: string
  containerCapacity?: number
  canSellLoose?: boolean
  costPrice?: number
  sellingPrice?: number
  currentStock: number
  expiryDate?: string
  bundleInfo?: string
  bundlePrice?: number
  hasBundle: boolean
  status: string
}

interface EditProductModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: EditProductSubmitData) => Promise<void>
  product: Product | null
  containerTypes: ContainerType[]
  categories: ProductCategory[]
  units: UnitOfMeasurement[]
  brands: Brand[]
  loading?: boolean
}

/* ── Editorial input primitives — bottom-rule, type-led, no boxes ── */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] uppercase tracking-[0.22em] text-[#6B7280] font-medium leaf-body">
      {children}
    </span>
  )
}

function RuleInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return (
    <input
      {...rest}
      className={`w-full bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#0A0A0A] focus:outline-none focus:ring-0 px-0 py-2 text-[15px] leaf-body text-[#0A0A0A] placeholder:text-[#9CA3AF] transition-colors ${className}`}
    />
  )
}

function RuleSelect({
  value, onChange, children, disabled,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#0A0A0A] focus:outline-none focus:ring-0 px-0 py-2 pr-6 text-[15px] leaf-body text-[#0A0A0A] cursor-pointer transition-colors"
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[#6B7280]"
        width="10" height="10" viewBox="0 0 10 10" fill="none"
      >
        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function SectionHeader({ kicker, children }: { kicker?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 mb-5 mt-8 first:mt-0">
      {kicker && (
        <span className="leaf-display text-[#16A34A] text-base italic font-light tabular-nums">{kicker}</span>
      )}
      <span className="text-[10px] uppercase tracking-[0.32em] text-[#6B7280] leaf-body font-medium">
        {children}
      </span>
      <span className="flex-1 h-px bg-[#E5E7EB]" />
    </div>
  )
}

export function EditProductModal({
  open,
  onOpenChange,
  onSubmit,
  product,
  containerTypes,
  categories,
  units,
  brands,
  loading = false
}: EditProductModalProps) {
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()
  const { restockProduct, isLoading: isRestocking } = useRestock()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stockInputMode, setStockInputMode] = useState<'units' | 'containers'>('containers')

  const [stockAction, setStockAction] = useState<'add' | 'set'>('add')
  const [addQuantity, setAddQuantity] = useState<string>('')

  // Auto-clear UOM when container type changes if the current UOM type is no longer allowed
  useEffect(() => {
    const ctVal = watch('containerType')
    const uomVal = watch('unitOfMeasurement')
    if (!ctVal || !uomVal) return
    const selectedCt = containerTypes.find(c => (c._id || c.id) === ctVal)
    const allowedTypes = selectedCt?.allowedUomTypes ?? []
    if (allowedTypes.length === 0) return
    const currentUnit = units.find(u => (u._id || u.id) === uomVal)
    if (currentUnit?.type && !allowedTypes.includes(currentUnit.type as never)) {
      setValue('unitOfMeasurement', '')
    }
  }) // runs on every render — container type change triggers re-render which triggers this

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
      const ct = product.containerType as { _id?: string; id?: string } | undefined
      const formData = {
        name: product.name,
        containerType: ct?._id || ct?.id || "",
        unitOfMeasurement: product.unitOfMeasurement._id || product.unitOfMeasurement.id || "",
        containerCapacity: product.containerCapacity || 1,
        canSellLoose: product.canSellLoose || false,
        brand: product.brand?._id || product.brand?.id || "_none",
        costPrice: product.costPrice || 0,
        sellingPrice: product.sellingPrice || 0,
        currentStock: product.currentStock || 0,
        bundleInfo: product.bundleInfo?.hasBundle ? "Yes" : "",
        bundlePrice: product.bundleInfo?.bundlePrice || 0,
        category: product.category?._id || product.category?.id || ""
      }

      reset(formData)
      setStockAction('add')
      setAddQuantity('')
    }
  }, [product, open, reset])

  const bundleInfo = watch('bundleInfo')
  const showBundlePrice = bundleInfo && bundleInfo.trim() !== '' && bundleInfo !== '-'

  const onFormSubmit = async (data: EditProductFormData) => {
    if (isSubmitting || loading || !product) return

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
      const transformedData: EditProductSubmitData = {
        name: data.name,
        unitOfMeasurement: data.unitOfMeasurement,
        containerType: data.containerType,
        category: data.category || undefined,
        brand: data.brand && data.brand !== '_none' ? data.brand : undefined,
        containerCapacity: data.containerCapacity,
        canSellLoose: data.canSellLoose ?? false,
        costPrice: canEditCostPrices ? data.costPrice : product.costPrice,
        sellingPrice: data.sellingPrice,
        currentStock: canManageStock ? data.currentStock : product.currentStock,
        bundleInfo: data.bundleInfo,
        bundlePrice: showBundlePrice ? data.bundlePrice : undefined,
        hasBundle: !!showBundlePrice,
        status: 'active',
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

  const selUnit = units.find(u => (u._id || u.id) === watch('unitOfMeasurement'))
  const unitLabel = selUnit?.abbreviation || 'units'
  const cap = watch('containerCapacity') || 1
  const hasContainers = cap > 1
  const inContainerMode = hasContainers && stockInputMode === 'containers'
  const stockVal = watch('currentStock') || 0
  const originalStock = product?.currentStock ?? 0
  const stockSanityWarning = hasContainers && stockVal > 50000

  const addRaw = addQuantity === '' ? 0 : Number(addQuantity)
  const addBaseUnits = inContainerMode ? Math.max(0, Math.round(addRaw)) * cap : Math.max(0, addRaw)
  const projectedTotal = originalStock + addBaseUnits

  const handleAddStock = async () => {
    if (!product || !canManageStock) return
    if (addBaseUnits <= 0) {
      toast({ title: "Enter a quantity", description: "Quantity to add must be greater than 0.", variant: "destructive" })
      return
    }
    try {
      const result = await restockProduct({
        productId: product._id,
        quantity: addBaseUnits,
      })
      toast({
        title: "Stock added",
        description: `${product.name}: ${result.previousStock} → ${result.newStock} ${unitLabel}`,
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory, refetchType: 'all' })
      setAddQuantity('')
      onOpenChange(false)
    } catch (err) {
      toast({
        title: "Failed to add stock",
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: "destructive",
      })
    }
  }

  const costVal = watch('costPrice') || 0
  const sellVal = watch('sellingPrice') || 0
  const hasLoose = watch('canSellLoose') && cap > 1

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 border-none shadow-[0_30px_80px_-20px_rgba(0,0,0,0.25)] bg-white"
        style={{ borderRadius: 0 }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap');
          .leaf-display { font-family: 'Poppins', ui-sans-serif, system-ui, sans-serif; }
          .leaf-body { font-family: 'Poppins', ui-sans-serif, system-ui, sans-serif; }
          .leaf-modal { font-family: 'Poppins', ui-sans-serif, system-ui, sans-serif; color: #0A0A0A; }
          .leaf-modal input::-webkit-outer-spin-button,
          .leaf-modal input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
          .leaf-modal input[type=number] { -moz-appearance: textfield; }
          @keyframes leafRise {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .leaf-rise > * { animation: leafRise 520ms cubic-bezier(0.2, 0.7, 0.1, 1) both; }
          .leaf-rise > *:nth-child(1) { animation-delay: 30ms; }
          .leaf-rise > *:nth-child(2) { animation-delay: 90ms; }
          .leaf-rise > *:nth-child(3) { animation-delay: 150ms; }
          .leaf-rise > *:nth-child(4) { animation-delay: 210ms; }
          .leaf-rise > *:nth-child(5) { animation-delay: 270ms; }
          .leaf-rise > *:nth-child(6) { animation-delay: 330ms; }
          .leaf-rise > *:nth-child(7) { animation-delay: 390ms; }
        `}</style>

        <DialogTitle className="sr-only">Edit Product</DialogTitle>

        <div className="leaf-modal relative bg-white">
          {/* Editorial header — paper-warm with deep ink and a thin botanical mark */}
          <header className="relative px-12 pt-12 pb-8">
            <div className="absolute top-12 right-12 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#6B7280]">
              <span className="leaf-display italic text-[#16A34A] text-sm normal-case tracking-normal">Leaf to Life</span>
              <span className="h-px w-6 bg-[#E5E7EB]" />
              <span>Inventory</span>
            </div>

            <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">Edit Product</p>
            <h2 className="leaf-display text-[44px] leading-[1.05] font-light text-[#0A0A0A] mt-3 max-w-[28ch]">
              {product?.name || 'Untitled product'}
            </h2>
            <div className="mt-4 flex items-center gap-4 text-[11px] text-[#6B7280]">
              {product?.sku && <span className="font-mono tracking-wide">SKU · {product.sku}</span>}
              {product?.brand?.name && (
                <>
                  <span className="h-1 w-1 rounded-full bg-[#E5E7EB]" />
                  <span className="leaf-display italic text-[13px]">{product.brand.name}</span>
                </>
              )}
            </div>
          </header>

          <form onSubmit={handleSubmit(onFormSubmit)} className="px-12 pb-12 leaf-rise">

            {/* ── Identity ── */}
            <div>
              <SectionHeader kicker="i.">Identity</SectionHeader>
              <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                <div>
                  <FieldLabel>Product name</FieldLabel>
                  <RuleInput {...register("name")} placeholder="Echinacea Tincture" />
                  {errors.name && <p className="text-[11px] text-[#DC2626] mt-1 leaf-body">{errors.name.message}</p>}
                </div>
                <div>
                  <FieldLabel>Category</FieldLabel>
                  <RuleSelect
                    value={watch('category') || ''}
                    onChange={(v) => setValue('category', v, { shouldValidate: true })}
                  >
                    <option value="">— select —</option>
                    {categories?.filter(cat => cat && cat.id).map((cat) => (
                      <option key={cat._id || cat.id} value={cat._id || cat.id || ''}>{cat.name || 'Unknown'}</option>
                    ))}
                  </RuleSelect>
                  {errors.category && <p className="text-[11px] text-[#DC2626] mt-1">{errors.category.message}</p>}
                </div>
                <div>
                  <FieldLabel>Brand / Supplier</FieldLabel>
                  <RuleSelect
                    value={watch('brand') || ''}
                    onChange={(v) => setValue('brand', v || '')}
                  >
                    <option value="_none">No brand</option>
                    {brands?.filter(b => b && (b._id || b.id)).map((brand) => (
                      <option key={brand._id || brand.id} value={brand._id || brand.id || ''}>{brand.name || 'Unknown'}</option>
                    ))}
                  </RuleSelect>
                </div>
              </div>
            </div>

            {/* ── Container & Unit ── */}
            <div>
              <SectionHeader kicker="ii.">Container &amp; Unit</SectionHeader>
              <div className="grid grid-cols-3 gap-x-10 gap-y-6">
                <div>
                  <FieldLabel>Container</FieldLabel>
                  <RuleSelect
                    value={watch('containerType') || ''}
                    onChange={(v) => setValue('containerType', v)}
                  >
                    <option value="">— select —</option>
                    {containerTypes?.filter(ct => ct && (ct._id || ct.id)).map((ct) => (
                      <option key={ct._id || ct.id} value={ct._id || ct.id || ''}>{ct.name || 'Unknown'}</option>
                    ))}
                  </RuleSelect>
                  {errors.containerType && <p className="text-[11px] text-[#DC2626] mt-1">{errors.containerType.message}</p>}
                </div>
                <div>
                  <FieldLabel>Unit of measure</FieldLabel>
                  {(() => {
                    const selectedCtId = watch('containerType')
                    const selectedCt = containerTypes.find(c => (c._id || c.id) === selectedCtId)
                    const allowedTypes = selectedCt?.allowedUomTypes ?? []
                    const filteredUnits = allowedTypes.length > 0
                      ? units.filter(u => u.type && allowedTypes.includes(u.type as never))
                      : units
                    return (
                      <RuleSelect
                        value={watch('unitOfMeasurement') || ''}
                        onChange={(v) => setValue('unitOfMeasurement', v)}
                      >
                        <option value="">— select —</option>
                        {filteredUnits.map((unit) => (
                          <option key={unit._id || unit.id} value={unit._id || unit.id || ''}>
                            {unit.name} ({unit.abbreviation})
                          </option>
                        ))}
                      </RuleSelect>
                    )
                  })()}
                  {errors.unitOfMeasurement && <p className="text-[11px] text-[#DC2626] mt-1">{errors.unitOfMeasurement.message}</p>}
                </div>
                <div>
                  <FieldLabel>Capacity per container</FieldLabel>
                  <RuleInput
                    type="number" step="0.01"
                    {...register("containerCapacity", { valueAsNumber: true })}
                    placeholder="1"
                  />
                  {errors.containerCapacity && <p className="text-[11px] text-[#DC2626] mt-1">{errors.containerCapacity.message}</p>}
                </div>
              </div>

              {/* Loose toggle — editorial inline row */}
              <div className="mt-8 flex items-center justify-between border-t border-[#E5E7EB] pt-5">
                <div className="max-w-md">
                  <p className="leaf-display text-[18px] text-[#0A0A0A] italic font-light">Sell loose</p>
                  <p className="text-[11px] text-[#6B7280] mt-1 leaf-body leading-relaxed">
                    Decant from sealed containers and sell by individual unit.
                    When off, only whole containers leave the shelf.
                  </p>
                </div>
                <Switch
                  checked={watch('canSellLoose') || false}
                  onCheckedChange={(checked) => setValue('canSellLoose', checked)}
                />
              </div>

              {watch('canSellLoose') && product && (
                <div className="mt-6 rounded-none border-t border-b border-[#E5E7EB] py-4">
                  <PoolManager
                    product={{ ...product, ...{ canSellLoose: watch('canSellLoose'), containerCapacity: watch('containerCapacity') || product.containerCapacity } } as Product}
                    onUpdate={(updated) => {
                      setValue('currentStock', updated.currentStock || 0)
                    }}
                  />
                </div>
              )}
            </div>

            {/* ── Pricing ── */}
            <div>
              <SectionHeader kicker="iii.">Pricing</SectionHeader>
              <div className={`grid ${canEditCostPrices ? 'grid-cols-2' : 'grid-cols-1'} gap-x-10 gap-y-6`}>
                {canEditCostPrices && (
                  <div>
                    <FieldLabel>Cost price{hasLoose ? ' (per container)' : ''}</FieldLabel>
                    <div className="flex items-baseline gap-2">
                      <span className="leaf-display text-[#6B7280] text-lg">$</span>
                      <RuleInput
                        type="number" step="0.01"
                        {...register("costPrice", { valueAsNumber: true })}
                        placeholder="0.00"
                      />
                    </div>
                    {hasLoose && costVal > 0 && (
                      <p className="text-[11px] text-[#6B7280] mt-2 leaf-display italic">
                        ${(costVal / cap).toFixed(4)} per {unitLabel}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <FieldLabel>Selling price{hasLoose ? ' (per container)' : ''}</FieldLabel>
                  <div className="flex items-baseline gap-2">
                    <span className="leaf-display text-[#16A34A] text-lg">$</span>
                    <RuleInput
                      type="number" step="0.01"
                      {...register("sellingPrice", { valueAsNumber: true })}
                      placeholder="0.00"
                    />
                  </div>
                  {hasLoose && sellVal > 0 && (
                    <p className="text-[11px] text-[#16A34A] mt-2 leaf-display italic">
                      ${(sellVal / cap).toFixed(4)} per {unitLabel}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Stock — the typographic centerpiece ── */}
            <div>
              <SectionHeader kicker="iv.">Stock</SectionHeader>

              {/* Big serif current-stock figure */}
              <div className="flex items-end justify-between border-b border-[#E5E7EB] pb-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#6B7280]">On hand</p>
                  <div className="flex items-baseline gap-3 mt-2">
                    <span className="leaf-display text-[72px] leading-none font-light tabular-nums text-[#0A0A0A]">
                      {originalStock}
                    </span>
                    <span className="leaf-display italic text-[20px] text-[#6B7280]">{unitLabel}</span>
                  </div>
                  {hasContainers && (
                    <p className="text-[11px] text-[#6B7280] mt-2 leaf-display italic">
                      {formatContainerBreakdown(originalStock, cap, unitLabel)}
                    </p>
                  )}
                </div>

                {hasContainers && canManageStock && (
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em]">
                    <span className="text-[#6B7280] mr-2">Enter as</span>
                    <button type="button"
                      onClick={() => setStockInputMode('containers')}
                      className={`px-2 py-1 leaf-body transition-colors ${stockInputMode === 'containers' ? 'text-[#0A0A0A] border-b border-[#0A0A0A]' : 'text-[#6B7280] hover:text-[#0A0A0A]'}`}>
                      Containers
                    </button>
                    <span className="text-[#E5E7EB]">/</span>
                    <button type="button"
                      onClick={() => setStockInputMode('units')}
                      className={`px-2 py-1 leaf-body transition-colors ${stockInputMode === 'units' ? 'text-[#0A0A0A] border-b border-[#0A0A0A]' : 'text-[#6B7280] hover:text-[#0A0A0A]'}`}>
                      {unitLabel}
                    </button>
                  </div>
                )}
              </div>

              {canManageStock && (
                <>
                  {/* Action tabs — editorial underline */}
                  <div className="mt-7 flex items-center gap-8 border-b border-[#E5E7EB]">
                    <button type="button"
                      onClick={() => setStockAction('add')}
                      className={`pb-3 text-[11px] uppercase tracking-[0.3em] leaf-body transition-colors -mb-px border-b-2 ${stockAction === 'add' ? 'border-[#16A34A] text-[#16A34A]' : 'border-transparent text-[#6B7280] hover:text-[#0A0A0A]'}`}>
                      <span className="leaf-display italic normal-case tracking-normal text-[16px] mr-1.5">+</span>
                      Add stock
                    </button>
                    <button type="button"
                      onClick={() => setStockAction('set')}
                      className={`pb-3 text-[11px] uppercase tracking-[0.3em] leaf-body transition-colors -mb-px border-b-2 ${stockAction === 'set' ? 'border-[#EA580C] text-[#EA580C]' : 'border-transparent text-[#6B7280] hover:text-[#0A0A0A]'}`}>
                      <span className="leaf-display italic normal-case tracking-normal text-[16px] mr-1.5">≈</span>
                      Override (correction)
                    </button>
                  </div>

                  <input type="hidden" {...register("currentStock", { valueAsNumber: true })} />

                  {stockAction === 'add' && (
                    <div className="mt-7">
                      <div className="grid grid-cols-[1fr_auto] gap-8 items-end">
                        <div>
                          <FieldLabel>Quantity to add</FieldLabel>
                          <div className="flex items-baseline gap-3">
                            <RuleInput
                              type="number" min="0"
                              step={inContainerMode ? '1' : '0.01'}
                              value={addQuantity}
                              onChange={(e) => setAddQuantity(e.target.value)}
                              placeholder="0"
                              className="text-[24px] leaf-display"
                            />
                            <span className="leaf-display italic text-[16px] text-[#6B7280] pb-2 whitespace-nowrap">
                              {inContainerMode ? 'containers' : unitLabel}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddStock}
                          disabled={isRestocking || addBaseUnits <= 0}
                          className="group relative inline-flex items-center gap-2 bg-[#16A34A] text-[#FFFFFF] px-7 py-3 leaf-body text-[11px] uppercase tracking-[0.28em] hover:bg-[#15803D] disabled:bg-[#9CA3AF] disabled:cursor-not-allowed transition-colors"
                        >
                          {isRestocking ? 'Adding…' : 'Add to stock'}
                          <span className="leaf-display italic text-base normal-case tracking-normal opacity-80 group-hover:translate-x-0.5 transition-transform">→</span>
                        </button>
                      </div>

                      {/* Math display — the centerpiece moment */}
                      {addBaseUnits > 0 && (
                        <div className="mt-7 px-6 py-5 bg-[#F0FDF4] border-l-2 border-[#16A34A]">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-[#16A34A] mb-2">After adding</p>
                          <p className="leaf-display text-[28px] tabular-nums leading-none text-[#0A0A0A]">
                            <span className="text-[#6B7280]">{originalStock}</span>
                            <span className="text-[#6B7280] mx-2 italic font-light">+</span>
                            <span className="text-[#16A34A]">{addBaseUnits}</span>
                            <span className="text-[#6B7280] mx-2 italic font-light">=</span>
                            <span className="font-normal">{projectedTotal}</span>
                            <span className="leaf-display italic text-[18px] text-[#6B7280] ml-2">{unitLabel}</span>
                          </p>
                          {hasContainers && (
                            <p className="text-[11px] text-[#6B7280] mt-2 leaf-display italic">
                              {formatContainerBreakdown(projectedTotal, cap, unitLabel)}
                            </p>
                          )}
                        </div>
                      )}
                      <p className="text-[11px] text-[#6B7280] mt-4 leaf-display italic max-w-md">
                        Recorded as an audited stock movement. Other field changes save separately when you commit below.
                      </p>
                    </div>
                  )}

                  {stockAction === 'set' && (() => {
                    const displayStock = inContainerMode ? Math.round(stockVal / cap) : stockVal
                    const stepVal = inContainerMode ? '1' : '0.01'
                    const onStockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                      const raw = e.target.value === '' ? 0 : Number(e.target.value)
                      const baseUnits = inContainerMode ? Math.max(0, Math.round(raw)) * cap : Math.max(0, raw)
                      setValue('currentStock', +baseUnits.toFixed(2), { shouldValidate: true })
                    }
                    return (
                      <div className="mt-7 px-6 py-5 bg-[#FFF7ED] border-l-2 border-[#EA580C]">
                        <FieldLabel>New on-hand value</FieldLabel>
                        <div className="flex items-baseline gap-3 mt-1">
                          <input
                            type="number" min="0" step={stepVal}
                            value={displayStock}
                            onChange={onStockChange}
                            placeholder="0"
                            className="bg-transparent border-0 border-b border-[#EA580C]/40 focus:border-[#EA580C] focus:outline-none focus:ring-0 px-0 py-1 leaf-display text-[28px] tabular-nums text-[#0A0A0A] w-32"
                          />
                          <span className="leaf-display italic text-[16px] text-[#6B7280]">
                            {inContainerMode ? 'containers' : unitLabel}
                          </span>
                        </div>
                        {hasContainers && (
                          <p className="text-[11px] text-[#6B7280] mt-2 leaf-display italic">
                            {inContainerMode
                              ? `= ${stockVal} ${unitLabel}`
                              : formatContainerBreakdown(stockVal, cap, unitLabel)}
                          </p>
                        )}
                        {errors.currentStock && <p className="text-[11px] text-[#DC2626] mt-1">{errors.currentStock.message}</p>}
                        {stockSanityWarning && (
                          <p className="text-[11px] text-[#EA580C] mt-2 leaf-display italic">
                            ⚠ That&apos;s {stockVal.toLocaleString()} {unitLabel} total — is this correct?
                          </p>
                        )}
                        <p className="text-[11px] text-[#6B7280] mt-3 leaf-display italic max-w-md leading-relaxed">
                          Overwrites without an audit movement. Reserve for physical-count corrections — restocks belong in <span className="text-[#16A34A]">Add stock</span>.
                        </p>
                      </div>
                    )
                  })()}
                </>
              )}

              {!canManageStock && (
                <p className="text-[11px] text-[#EA580C] mt-4 leaf-display italic">Stock management requires permission.</p>
              )}
            </div>

            {/* ── Bundle ── */}
            <div>
              <SectionHeader kicker="v.">Bundle</SectionHeader>
              <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                <div>
                  <FieldLabel>Bundle label</FieldLabel>
                  <RuleInput {...register("bundleInfo")} placeholder="e.g. x3, pack of three" />
                </div>
                {showBundlePrice && (
                  <div>
                    <FieldLabel>Bundle price</FieldLabel>
                    <div className="flex items-baseline gap-2">
                      <span className="leaf-display text-[#16A34A] text-lg">$</span>
                      <RuleInput
                        type="number" step="0.01"
                        {...register("bundlePrice", { valueAsNumber: true })}
                        placeholder="0.00"
                      />
                    </div>
                    {errors.bundlePrice && <p className="text-[11px] text-[#DC2626] mt-1">{errors.bundlePrice.message}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer actions ── */}
            <div className="mt-12 pt-6 border-t border-[#0A0A0A] flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#6B7280] leaf-body">
                Last edited · just now
              </p>
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting || loading}
                  className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280] hover:text-[#0A0A0A] leaf-body transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || loading}
                  className="group inline-flex items-center gap-2 bg-[#0A0A0A] text-[#FFFFFF] px-8 py-3 text-[11px] uppercase tracking-[0.28em] leaf-body hover:bg-[#000] disabled:bg-[#6B7280] disabled:cursor-not-allowed transition-colors"
                >
                  {(isSubmitting || loading) ? 'Committing…' : 'Commit changes'}
                  <span className="leaf-display italic text-base normal-case tracking-normal opacity-80 group-hover:translate-x-0.5 transition-transform">→</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
