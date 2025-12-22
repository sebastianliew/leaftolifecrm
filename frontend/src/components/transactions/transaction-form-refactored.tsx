"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { ImSpinner8 } from "react-icons/im"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"

import type { TransactionFormData, Transaction, TransactionItem } from "@/types/transaction"
import type { Product } from "@/types/inventory"
import type { BlendTemplate, CustomBlendData } from "@/types/blend"
import type { Bundle } from "@/types/bundle"
import type { Patient } from "@/types/patient"

import { usePatients } from "@/hooks/usePatients"
import { useUnits } from "@/hooks/useUnits"
import { useAuth } from "@/hooks/useAuth"
import { useTransactionForm } from "@/hooks/useTransactionForm"
import { DiscountService } from "@/services/DiscountService"

import { CustomerSection } from "./CustomerSection"
import { ProductSection } from "./ProductSection"
import { TransactionItemsTable } from "./TransactionItemsTable"
import { PaymentSection } from "./PaymentSection"
import { QuantitySelectorModal } from "./quantity-selector-modal"
// TODO: Re-enable these imports when modal interfaces are fixed
// import { BlendTypeSelector } from "./BlendTypeSelector"
// import { FixedBlendSelector } from "./FixedBlendSelector"
// import { CustomBlendCreator } from "./CustomBlendCreator"
// import { BundleSelector } from "./BundleSelector"

export interface TransactionFormProps {
  products: Product[]
  onSubmit: (data: TransactionFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
  initialData?: Transaction
  onRefreshProducts?: () => Promise<void>
}

export function TransactionForm({ 
  products, 
  onSubmit, 
  onCancel, 
  loading, 
  initialData, 
  onRefreshProducts: _onRefreshProducts 
}: TransactionFormProps) {
  const { patients } = usePatients()
  const { units } = useUnits()
  const { user } = useAuth()
  
  const {
    formData,
    updateFormData,
    addItem,
    updateItem,
    removeItem,
    validateInventory
  } = useTransactionForm({ initialData, products, patients })

  // Modal states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showQuantitySelector, setShowQuantitySelector] = useState(false)
  const [_showBlendTypeSelector, _setShowBlendTypeSelector] = useState(false)
  const [_showFixedBlendSelector, _setShowFixedBlendSelector] = useState(false)
  const [_showCustomBlendCreator, _setShowCustomBlendCreator] = useState(false)
  const [_showBundleSelector, _setShowBundleSelector] = useState(false)

  const canApplyDiscount = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'manager'

  // Restore selected patient when loading from initial data or draft
  useEffect(() => {
    if (initialData?.customerId) {
      const patient = patients.find(p => p.id === initialData.customerId)
      if (patient) {
        setSelectedPatient(patient)
      }
    }
  }, [initialData?.customerId, patients])

  const handleCustomerChange = (updates: Partial<TransactionFormData>) => {
    // Track selected patient when customer changes
    if (updates.customerId) {
      const patient = patients.find(p => p.id === updates.customerId)
      setSelectedPatient(patient || null)
    } else if (updates.customerId === '') {
      setSelectedPatient(null)
    }
    
    updateFormData(updates)
  }

  const handleProductSelect = (product: Product) => {
    if (product.currentStock <= 0) {
      toast({
        title: "Product Unavailable",
        description: "This product is out of stock",
        variant: "destructive"
      })
      return
    }
    setSelectedProduct(product)
    setShowQuantitySelector(true)
  }

  const handleQuantityConfirm = (totalQuantity: number, totalPrice: number, selectedUnit: string, saleType?: string) => {
    if (!selectedProduct) return
    
    // Apply member discount if customer is selected and eligible
    let finalTotalPrice = totalPrice
    let discountAmount = 0
    
    if (selectedPatient?.memberBenefits?.discountPercentage && selectedPatient.memberBenefits.discountPercentage > 0 && saleType !== "volume") {
      const customerForDiscount = {
        _id: selectedPatient.id,
        discountRate: selectedPatient.memberBenefits.discountPercentage
      }
      
      const discountCalc = DiscountService.calculateItemDiscount(
        selectedProduct,
        totalQuantity,
        selectedProduct.sellingPrice,
        customerForDiscount,
        { itemType: 'product' }
      )
      
      if (discountCalc.eligible && discountCalc.discountCalculation) {
        discountAmount = discountCalc.discountCalculation.discountAmount
        finalTotalPrice = discountCalc.discountCalculation.finalPrice
      }
    }
    
    const newItem: TransactionItem = {
      id: `item_${Date.now()}_${Math.random()}`,
      productId: selectedProduct._id,
      name: selectedProduct.name,
      sku: selectedProduct.sku || "",
      quantity: totalQuantity,
      unitPrice: selectedProduct.sellingPrice,
      totalPrice: finalTotalPrice,
      discountAmount: discountAmount,
      saleType: saleType === "volume" ? "volume" : "quantity",
      unitOfMeasurementId: selectedProduct.unitOfMeasurement?.id || "",
      baseUnit: selectedProduct.unitOfMeasurement?.baseUnit || selectedProduct.unitOfMeasurement?.name || "",
      convertedQuantity: totalQuantity,
      product: selectedProduct
    }

    const validation = validateInventory(newItem, selectedProduct)
    if (!validation.valid) {
      toast({
        title: "Insufficient Stock",
        description: validation.message,
        variant: "destructive"
      })
      return
    }

    addItem(newItem)
    setShowQuantitySelector(false)
    setSelectedProduct(null)
  }

  const handleItemQuantityUpdate = (itemId: string, quantity: number) => {
    const item = formData.items.find(i => i.id === itemId)
    if (!item) return

    const validation = validateInventory({ ...item, quantity }, item.product)
    if (!validation.valid) {
      toast({
        title: "Insufficient Stock",
        description: validation.message,
        variant: "destructive"
      })
      return
    }

    updateItem(itemId, { quantity })
  }

  const handleItemVolumeUpdate = (itemId: string, volume: number) => {
    const item = formData.items.find(i => i.id === itemId)
    if (!item) return

    const updatedItem = { ...item, quantity: volume, convertedQuantity: volume, totalPrice: item.unitPrice * volume }
    const validation = validateInventory(updatedItem, item.product)
    if (!validation.valid) {
      toast({
        title: "Insufficient Stock",
        description: validation.message,
        variant: "destructive"
      })
      return
    }

    updateItem(itemId, { quantity: volume, convertedQuantity: volume, totalPrice: item.unitPrice * volume })
  }

  const _handleFixedBlendSelection = (blend: BlendTemplate, quantity: number) => {
    const blendItem: TransactionItem = {
      id: `blend_${Date.now()}_${Math.random()}`,
      productId: blend._id,
      name: blend.name,
      sku: `BLEND-${blend._id}`,
      quantity,
      unitPrice: 0, // Blend pricing varies by batch
      totalPrice: 0,
      saleType: "quantity",
      unitOfMeasurementId: typeof blend.unitOfMeasurementId === 'string' 
        ? blend.unitOfMeasurementId 
        : blend.unitOfMeasurementId?._id || blend.unitOfMeasurementId?.id || "",
      baseUnit: "unit",
      convertedQuantity: quantity,
      itemType: "fixed_blend",
      blendTemplateId: blend._id
    }
    
    addItem(blendItem)
    _setShowFixedBlendSelector(false)
  }

  const _handleCustomBlendCreation = (blend: CustomBlendData) => {
    const blendItem: TransactionItem = {
      id: `custom_blend_${Date.now()}_${Math.random()}`,
      productId: `custom_blend_${Date.now()}`,
      name: blend.name,
      sku: `CUSTOM-BLEND-${Date.now()}`,
      quantity: 1,
      unitPrice: blend.totalIngredientCost,
      totalPrice: blend.totalIngredientCost,
      saleType: "quantity",
      unitOfMeasurementId: "",
      baseUnit: "unit",
      convertedQuantity: 1,
      itemType: "custom_blend",
      customBlendData: {
        name: blend.name,
        ingredients: blend.ingredients.map(ing => ({
          productId: ing.productId,
          name: ing.name,
          quantity: ing.quantity,
          unitOfMeasurementId: typeof ing.unitOfMeasurementId === 'string' 
            ? ing.unitOfMeasurementId 
            : ing.unitOfMeasurementId?._id || ing.unitOfMeasurementId?.id || '',
          unitName: ing.unitName,
          costPerUnit: ing.costPerUnit || 0,
          selectedContainers: ing.selectedContainers
        })),
        totalIngredientCost: blend.totalIngredientCost,
        preparationNotes: blend.preparationNotes,
        mixedBy: blend.mixedBy,
        mixedAt: blend.mixedAt
      }
    }
    
    addItem(blendItem)
    _setShowCustomBlendCreator(false)
  }

  const _handleBundleSelection = (bundle: Bundle, quantity: number) => {
    const bundleItem: TransactionItem = {
      id: `bundle_${Date.now()}_${Math.random()}`,
      productId: bundle._id,
      name: bundle.name,
      sku: `BUNDLE-${bundle._id}`,
      quantity,
      unitPrice: bundle.bundlePrice,
      totalPrice: bundle.bundlePrice * quantity,
      saleType: "quantity",
      unitOfMeasurementId: "",
      baseUnit: "unit",
      convertedQuantity: quantity,
      itemType: "bundle",
      bundleId: bundle._id,
      bundleData: {
        bundleId: bundle._id,
        bundleName: bundle.name,
        bundleProducts: bundle.bundleProducts,
        individualTotalPrice: bundle.individualTotalPrice,
        savings: bundle.savings,
        savingsPercentage: bundle.savingsPercentage
      }
    }
    
    addItem(bundleItem)
    _setShowBundleSelector(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.customerName || !formData.customerPhone) {
      toast({
        title: "Missing Information",
        description: "Please enter customer name and phone number",
        variant: "destructive"
      })
      return
    }

    if (formData.items.length === 0) {
      toast({
        title: "No Items",
        description: "Please add at least one item to the transaction",
        variant: "destructive"
      })
      return
    }

    try {
      await onSubmit(formData)
    } catch (error) {
      console.error("Transaction submission error:", error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <CustomerSection
        formData={formData}
        patients={patients}
        onCustomerChange={handleCustomerChange}
        selectedPatient={selectedPatient}
        disabled={loading}
      />

      <ProductSection
        products={products}
        onAddProduct={handleProductSelect}
        onShowBlendTypeSelector={() => _setShowBlendTypeSelector(true)}
        onShowBundleSelector={() => _setShowBundleSelector(true)}
        disabled={loading}
      />

      {formData.items.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Transaction Items</h3>
          <TransactionItemsTable
            items={formData.items}
            onUpdateQuantity={handleItemQuantityUpdate}
            onUpdateVolume={handleItemVolumeUpdate}
            onRemoveItem={removeItem}
            disabled={loading}
          />
        </div>
      )}

      <PaymentSection
        formData={formData}
        subtotal={formData.subtotal}
        totalAmount={formData.totalAmount}
        onPaymentChange={updateFormData}
        canApplyDiscount={canApplyDiscount}
        disabled={loading}
      />

      {/* Modals */}
      {selectedProduct && (
        <QuantitySelectorModal
          isOpen={showQuantitySelector}
          onClose={() => {
            setShowQuantitySelector(false)
            setSelectedProduct(null)
          }}
          product={selectedProduct}
          unitPrice={selectedProduct.sellingPrice}
          unitOfMeasurements={units}
          onConfirm={handleQuantityConfirm}
        />
      )}

      {/* TODO: Fix BlendTypeSelector props interface
      <BlendTypeSelector
        open={showBlendTypeSelector}
        onClose={() => setShowBlendTypeSelector(false)}
        onSelectFixed={() => {
          setShowBlendTypeSelector(false)
          setShowFixedBlendSelector(true)
        }}
        onSelectCustom={() => {
          setShowBlendTypeSelector(false)
          setShowCustomBlendCreator(true)
        }}
      />
      */}

      {/* TODO: Fix remaining modal component props interfaces
      <FixedBlendSelector
        open={showFixedBlendSelector}
        onClose={() => setShowFixedBlendSelector(false)}
        onSelectBlend={handleFixedBlendSelection}
        loading={loading}
      />

      <CustomBlendCreator
        open={showCustomBlendCreator}
        onClose={() => setShowCustomBlendCreator(false)}
        onCreateBlend={handleCustomBlendCreation}
        products={products}
        unitOfMeasurements={units}
        loading={loading}
      />

      <BundleSelector
        open={showBundleSelector}
        onClose={() => setShowBundleSelector(false)}
        onSelectBundle={handleBundleSelection}
        loading={loading}
      />
      */}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <ImSpinner8 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            "Create Transaction"
          )}
        </Button>
      </div>
    </form>
  )
}