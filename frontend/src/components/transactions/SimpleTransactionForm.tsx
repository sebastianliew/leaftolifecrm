"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FaTrash, FaShoppingCart, FaUserPlus, FaEdit, FaGift, FaPercent } from "react-icons/fa"
import { FiRefreshCw, FiAlertTriangle } from "react-icons/fi"
import { ImSpinner8 } from "react-icons/im"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { EditorialButton, EditorialModal, EditorialModalFooter, EditorialPill } from "@/components/ui/editorial"
import type { TransactionFormData, TransactionItem, PaymentMethod, PaymentStatus } from "@/types/transaction"
import type { Product } from "@/types/inventory"
import type { Transaction } from "@/types/transaction"
import type { Patient } from "@/types/patient"
import { normalizePatient } from "@/types/patient"
import { TransactionTypeSelector } from "./TransactionTypeSelector"
import { SimpleProductSelector } from "./SimpleProductSelector"
import { SimpleQuantityInput } from "./SimpleQuantityInput"
import { SimpleBlendSelector } from "./SimpleBlendSelector"
import { FixedBlendSelector } from "./FixedBlendSelector"
import { CustomBlendCreator } from "./CustomBlendCreator"
import { BundleSelector } from "./BundleSelector"
import { PatientSelector } from "./PatientSelector"
import { ConsultationSelector } from "./ConsultationSelector"
import { MiscellaneousSelector } from "./MiscellaneousSelector"
import { useUnits } from "@/hooks/useUnits"
import { computeUnitPrice, detectPriceMismatch, getTransactionQuantityDisplayParts, perUnitCost } from "@/lib/pricing"
import { DiscountService } from "@/services/DiscountService"
import { formatCurrency } from "@/utils/currency"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/api-client"
import { usePermissions } from "@/hooks/usePermissions"
import {
  canUseDiscountOverride,
  clearDiscountMetadata,
  getBillDiscountBase,
  getBillDiscountBlockedItems,
  getItemDiscountLabel,
  getLineSubtotal,
  isDiscountOverrideEligibleItem,
  isGiftEligibleItem,
  isGiftItem,
  isManualDiscountItem,
  normalizeManualDiscount,
  prepareDiscountOverrideItem,
  roundCurrency,
} from "@/lib/transactions/discountOverrides"

/** Fetch a patient by ID from the backend and normalize _id → id. */
async function fetchPatient(patientId: string): Promise<Patient | null> {
  // Use summary endpoint — only fetches fields needed for transactions (no medical data)
  const response = await api.get<Patient & { _id?: string }>(`/patients/${patientId}/summary`)
  if (!response.ok || !response.data) return null
  return normalizePatient(response.data)
}

interface SimpleTransactionFormProps {
  products: Product[]
  onSubmit: (data: TransactionFormData) => Promise<void>
  onSaveDraft?: (data: TransactionFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
  initialData?: Transaction
}

interface ManualDiscountDraft {
  itemId: string
  itemName: string
  mode: 'amount' | 'percentage'
  value: string
  reason: string
  subtotal: number
}

export function SimpleTransactionForm({ products, onSubmit, onSaveDraft, onCancel, loading, initialData }: SimpleTransactionFormProps) {
  const { units, getUnits } = useUnits()
  const { toast } = useToast()
  const { user } = usePermissions()
  const allowDiscountOverride = canUseDiscountOverride(user)
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [showQuantityInput, setShowQuantityInput] = useState(false)
  const [showBlendSelector, setShowBlendSelector] = useState(false)
  const [showFixedBlendSelector, setShowFixedBlendSelector] = useState(false)
  const [showCustomBlendCreator, setShowCustomBlendCreator] = useState(false)
  const [showBundleSelector, setShowBundleSelector] = useState(false)
  const [showPatientSelector, setShowPatientSelector] = useState(false)
  const [showConsultationSelector, setShowConsultationSelector] = useState(false)
  const [showMiscellaneousSelector, setShowMiscellaneousSelector] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [editingCartItem, setEditingCartItem] = useState<TransactionItem | null>(null)
  const [editingConsultationId, setEditingConsultationId] = useState<string | null>(null)
  const [editingCustomBlend, setEditingCustomBlend] = useState<TransactionItem | null>(null)
  const [editingFixedBlend, setEditingFixedBlend] = useState<TransactionItem | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  // const [hasPurchaseHistory, setHasPurchaseHistory] = useState(false) // See purchase history TODO above
  const [discountMode, setDiscountMode] = useState<'amount' | 'percentage'>('amount')
  const [discountValue, setDiscountValue] = useState<string>('')
  const [manualDiscountDraft, setManualDiscountDraft] = useState<ManualDiscountDraft | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  // Ref-based submission lock to prevent double-clicks (independent of React state timing)
  const isSubmittingRef = useRef(false)

  // Transaction numbers are now generated server-side to avoid conflicts

  const [formData, setFormData] = useState<TransactionFormData>(() => {
    if (initialData) {
      return {
        ...initialData,
        customerId: initialData.customerId, // CRITICAL: preserve customerId
        // Ensure all customer fields have string defaults to prevent controlled/uncontrolled input warnings
        customerName: initialData.customerName || "",
        customerEmail: initialData.customerEmail || "",
        customerPhone: initialData.customerPhone || "",
        items: (initialData.items || []).map(item => {
          // Handle both string IDs and object IDs for productId
          const productId = typeof item.productId === 'object' && item.productId !== null 
            ? (item.productId as { _id: string })._id 
            : item.productId;
          
          // Find and hydrate the product reference for existing items
          let product = products.find(p => p._id === productId);
          
          // For fixed blends, create synthetic product if not found in products array
          if (!product && item.itemType === 'fixed_blend') {
            product = {
              _id: productId,
              discountFlags: {
                discountableForMembers: true,
                discountableForAll: true,
                discountableInBlends: false
              }
            } as Partial<Product> as Product;
          }
          
          // Debug custom blend data during initialization
          if (item.itemType === 'custom_blend') {
            console.log('🔍 Processing custom blend item during initialization:', {
              name: item.name,
              customBlendData: item.customBlendData,
              hasCustomBlendData: !!item.customBlendData
            });
          }
          
          return {
            ...item,
            id: item.id || `item_${Date.now()}_${Math.random()}`,
            productId: productId, // Ensure we store the string ID
            product: product || undefined, // Hydrate the product reference
            unitOfMeasurementId: typeof item.unitOfMeasurementId === 'object' && item.unitOfMeasurementId !== null
              ? (item.unitOfMeasurementId as { _id?: string; id?: string })._id || (item.unitOfMeasurementId as { _id?: string; id?: string }).id || ''
              : item.unitOfMeasurementId || '',
            // Explicitly preserve customBlendData to ensure it's not lost
            customBlendData: item.customBlendData
          };
        })
      }
    }
    return {
      type: "DRAFT",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      items: [],
      subtotal: 0,
      discountAmount: 0,
      totalAmount: 0,
      currency: "SGD",
      paymentMethod: "cash" as PaymentMethod,
      paymentStatus: "pending" as PaymentStatus,
      paidAmount: 0,
      changeAmount: 0,
      transactionDate: new Date().toISOString(),
      invoiceGenerated: false,
      createdBy: "current_user",
      transactionNumber: '', // Will be generated server-side
      status: "pending",
    }
  })

  useEffect(() => {
    getUnits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restore selectedPatient when editing a draft transaction
  useEffect(() => {
    const restorePatientFromDraft = async () => {
      if (initialData?.customerId) {
        try {
          const patient = await fetchPatient(initialData.customerId)
          if (patient) {
            console.log('[Discount] Restoring patient in edit mode:', patient.firstName, patient.lastName, {
              membershipTier: patient.memberBenefits?.membershipTier,
              discountPercentage: patient.memberBenefits?.discountPercentage
            });
            setSelectedPatient(patient)

            // Recalculate discounts via backend when restoring patient in edit mode
            if (patient.memberBenefits?.discountPercentage) {
              // Call backend to recalculate all prices and discounts
              try {
                const result = await DiscountService.calculateTransactionServer(
                  formData.items.map(item => {
                    const preparedItem = prepareDiscountOverrideItem(item, allowDiscountOverride)
                    return {
                      productId: preparedItem.productId,
                      name: preparedItem.name,
                      quantity: preparedItem.quantity,
                      unitPrice: preparedItem.unitPrice,
                      itemType: preparedItem.itemType,
                      isService: preparedItem.isService,
                      saleType: preparedItem.saleType,
                      discountAmount: preparedItem.discountAmount,
                      discountSource: preparedItem.discountSource,
                      discountReason: preparedItem.discountReason,
                      customBlendData: preparedItem.customBlendData,
                    }
                  }),
                  initialData.customerId,
                  formData.discountAmount
                )

                if (result.success) {
                  setFormData(prev => {
                    const updatedItems = prev.items.map(item => {
                      const serverItem = result.items.find(si => si.productId === item.productId && si.name === item.name)
                      if (serverItem) {
                        return {
                          ...item,
                          unitPrice: serverItem.unitPrice,
                          discountAmount: serverItem.discountAmount,
                          discountSource: serverItem.discountSource,
                          discountReason: serverItem.discountReason,
                          totalPrice: serverItem.totalPrice,
                        }
                      }
                      return item
                    })

                    const discountedCount = updatedItems.filter(i => (i.discountAmount || 0) > 0).length
                    if (discountedCount > 0) {
                      toast({
                        title: "Member Discount Restored",
                        description: `${patient.memberBenefits!.discountPercentage}% ${patient.memberBenefits!.membershipTier?.toUpperCase()} discount applied to ${discountedCount} eligible item(s)`,
                      })
                    }

                    return {
                      ...prev,
                      items: updatedItems,
                      subtotal: result.subtotal,
                      totalAmount: result.totalAmount,
                    }
                  })
                }
              } catch (error) {
                console.warn('[Discount] Server calculation failed in edit mode, keeping existing values:', error)
              }
            }

          }
        } catch {
          // Silently fail - patient restoration is optional
        }
      }
    }

    // Only run when initialData.customerId exists (i.e., when editing a draft)
    if (initialData?.customerId) {
      restorePatientFromDraft()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.customerId, products])

  // Refresh patient data when window regains focus (e.g., after editing patient)
  useEffect(() => {
    const handleFocus = async () => {
      if (selectedPatient?.id) {
        try {
          const updatedPatient = await fetchPatient(selectedPatient.id)
          if (updatedPatient) {

            // Check if discount rate changed
            const oldDiscount = selectedPatient.memberBenefits?.discountPercentage || 0
            const newDiscount = updatedPatient.memberBenefits?.discountPercentage || 0
            const discountChanged = oldDiscount !== newDiscount

            if (discountChanged) {
              // Update patient and recalculate all discounts via backend
              setSelectedPatient(updatedPatient)

              try {
                const result = await DiscountService.calculateTransactionServer(
                  formData.items.map(item => {
                    const preparedItem = prepareDiscountOverrideItem(item, allowDiscountOverride)
                    return {
                      productId: preparedItem.productId,
                      name: preparedItem.name,
                      quantity: preparedItem.quantity,
                      unitPrice: preparedItem.unitPrice,
                      itemType: preparedItem.itemType,
                      isService: preparedItem.isService,
                      saleType: preparedItem.saleType,
                      discountAmount: preparedItem.discountAmount,
                      discountSource: preparedItem.discountSource,
                      discountReason: preparedItem.discountReason,
                      customBlendData: preparedItem.customBlendData,
                    }
                  }),
                  updatedPatient.id,
                  formData.discountAmount
                )

                if (result.success) {
                  setFormData(prev => {
                    const updatedItems = prev.items.map(item => {
                      const serverItem = result.items.find(si => si.productId === item.productId && si.name === item.name)
                      if (serverItem) {
                        return {
                          ...item,
                          unitPrice: serverItem.unitPrice,
                          discountAmount: serverItem.discountAmount,
                          discountSource: serverItem.discountSource,
                          discountReason: serverItem.discountReason,
                          totalPrice: serverItem.totalPrice,
                        }
                      }
                      return isManualDiscountItem(item)
                        ? normalizeManualDiscount(item)
                        : { ...clearDiscountMetadata(item), discountAmount: 0, totalPrice: item.quantity * item.unitPrice }
                    })
                    return { ...prev, items: updatedItems, subtotal: result.subtotal, totalAmount: result.totalAmount }
                  })
                }
              } catch (error) {
                console.warn('[Discount] Server calculation failed on focus refresh:', error)
              }
            }
          }
        } catch (error) {
          console.error('Failed to refresh patient data:', error)
        }
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [selectedPatient?.id, selectedPatient?.memberBenefits?.discountPercentage, formData.items, formData.discountAmount, products, allowDiscountOverride])

  useEffect(() => {
    // Subtotal = sum of original prices (without any discounts)
    const subtotal = formData.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
    // Total item discounts (membership discounts)
    const itemDiscounts = formData.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0)
    // Total amount = subtotal - item discounts - additional discount
    const totalAmount = subtotal - itemDiscounts - formData.discountAmount
    setFormData(prev => ({ ...prev, subtotal, totalAmount }))
  }, [formData.items, formData.discountAmount])

  const handleDiscountChange = useCallback((value: string) => {
    setDiscountValue(value)
    setIsTyping(true)

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Set new timeout
    debounceRef.current = setTimeout(async () => {
      const numValue = Number.parseFloat(value) || 0

      const blockedItems = getBillDiscountBlockedItems(formData.items, allowDiscountOverride)
      if (numValue > 0 && blockedItems.length > 0) {
        setFormData(prev => ({ ...prev, discountAmount: 0 }))
        setDiscountValue('')
        setIsTyping(false)
        toast({
          title: "Discount not applied",
          description: `Bill-level discounts cannot include pre-priced or non-discountable lines: ${blockedItems.slice(0, 3).map(item => item.name).join(', ')}${blockedItems.length > 3 ? '...' : ''}`,
          variant: "destructive",
        })
        return
      }

      // Calculate bill-level discount amount from remaining positive charge lines.
      // Negative credit adjustment lines do not expand the percentage base.
      const additionalDiscountBase = getBillDiscountBase(formData.items, allowDiscountOverride)
      const billDiscountAmount = discountMode === 'percentage'
        ? (additionalDiscountBase * numValue / 100)
        : numValue
      const sanitizedAmount = Math.min(Math.max(0, billDiscountAmount), additionalDiscountBase)

      // Apply optimistic local value immediately
      setFormData(prev => ({ ...prev, discountAmount: sanitizedAmount }))

      // Reconcile with server calculation
      try {
        const result = await DiscountService.calculateTransactionServer(
          formData.items.map(item => {
            const preparedItem = prepareDiscountOverrideItem(item, allowDiscountOverride)
            return {
              productId: preparedItem.productId,
              name: preparedItem.name,
              quantity: preparedItem.quantity,
              unitPrice: preparedItem.unitPrice,
              itemType: preparedItem.itemType,
              isService: preparedItem.isService,
              saleType: preparedItem.saleType,
              discountAmount: preparedItem.discountAmount,
              discountSource: preparedItem.discountSource,
              discountReason: preparedItem.discountReason,
              customBlendData: preparedItem.customBlendData,
            }
          }),
          formData.customerId,
          sanitizedAmount
        )
        if (result.success) {
          setFormData(prev => ({
            ...prev,
            subtotal: result.subtotal,
            discountAmount: result.billDiscountAmount ?? sanitizedAmount,
            totalAmount: result.totalAmount,
          }))
        }
      } catch {
        // Keep optimistic values on error
      }

      setIsTyping(false)
    }, 1000)
  }, [formData.items, formData.customerId, discountMode, allowDiscountOverride, toast])

  // Sync discount value with mode changes (but not when user is typing)
  useEffect(() => {
    if (!isTyping && formData.discountAmount > 0) {
      if (discountMode === 'amount') {
        setDiscountValue(formData.discountAmount.toString())
      } else {
        const additionalDiscountBase = getBillDiscountBase(formData.items, allowDiscountOverride)
        const percentage = additionalDiscountBase > 0 ? (formData.discountAmount / additionalDiscountBase * 100) : 0
        setDiscountValue(percentage.toFixed(2))
      }
    } else if (!isTyping && formData.discountAmount === 0) {
      setDiscountValue('')
    }
  }, [formData.discountAmount, discountMode, formData.items, isTyping, allowDiscountOverride])

  // Note: Membership discounts are now applied at the item level, not transaction level
  // The bottom discount section is for additional manual discounts only

  // Auto-update paid amount when payment status changes
  useEffect(() => {
    if (formData.paymentStatus === 'paid') {
      setFormData(prev => ({ 
        ...prev, 
        paidAmount: prev.totalAmount,
        changeAmount: 0 
      }))
    } else if (formData.paymentStatus === 'pending') {
      setFormData(prev => ({ 
        ...prev, 
        paidAmount: 0,
        changeAmount: 0 
      }))
    }
  }, [formData.paymentStatus, formData.totalAmount])

  const handleTypeSelection = (type: 'product' | 'blend' | 'bundle' | 'consultation' | 'miscellaneous') => {

    // Close all modals first to prevent overlaps
    setShowTypeSelector(false)
    setShowProductSelector(false)
    setShowQuantityInput(false)
    setShowBlendSelector(false)
    setShowFixedBlendSelector(false)
    setShowCustomBlendCreator(false)
    setShowBundleSelector(false)
    setShowConsultationSelector(false)
    setShowMiscellaneousSelector(false)

    // Add a small delay to ensure clean state transitions
    setTimeout(() => {

      switch (type) {
        case 'product':
          setShowProductSelector(true)
          break
        case 'blend':
          setShowBlendSelector(true)
          break
        case 'bundle':
          setShowBundleSelector(true)
          break
        case 'consultation':
          setShowConsultationSelector(true)
          break
        case 'miscellaneous':
          setShowMiscellaneousSelector(true)
          break
      }
    }, 50)
  }

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    setShowProductSelector(false)
    // Unified flow — SimpleQuantityInput auto-detects loose vs container mode
    setShowQuantityInput(true)
  }

  // Unified quantity handler — saleType is auto-determined by SimpleQuantityInput
  const handleQuantityConfirm = (quantity: number, saleType: 'quantity' | 'volume' = 'quantity', unitDisplay?: string) => {
    if (!selectedProduct) return

    const unitOfMeasurement = selectedProduct.unitOfMeasurement
    let unitId = ''
    let baseUnit = unitDisplay || 'unit'

    if (typeof unitOfMeasurement === 'object' && unitOfMeasurement !== null) {
      unitId = unitOfMeasurement._id || unitOfMeasurement.id || ''
      if (!unitDisplay) baseUnit = unitOfMeasurement.abbreviation || unitOfMeasurement.name || 'unit'
    } else if (typeof unitOfMeasurement === 'string') {
      unitId = unitOfMeasurement
      if (!unitDisplay) baseUnit = unitOfMeasurement
    }

    const unitPrice = computeUnitPrice(selectedProduct.sellingPrice, selectedProduct.containerCapacity, saleType)
    const basePrice = unitPrice * quantity

    const baseItem: TransactionItem = {
      id: editingCartItem?.id || `item_${Date.now()}`,
      productId: selectedProduct._id,
      product: selectedProduct,
      name: selectedProduct.name,
      description: selectedProduct.description,
      quantity: quantity,
      unitPrice: unitPrice,
      totalPrice: basePrice,
      discountAmount: 0,
      isService: false,
      itemType: 'product',
      saleType: saleType,
      unitOfMeasurementId: unitId,
      baseUnit: baseUnit,
      convertedQuantity: saleType === 'volume' ? quantity : quantity, // backend overrides this
      sku: selectedProduct.sku
    }

    const newItem = applyMemberDiscount(baseItem)

    setFormData(prev => ({
      ...prev,
      items: editingCartItem
        ? prev.items.map(i => i.id === editingCartItem.id ? newItem : i)  // replace
        : [...prev.items, newItem]                                        // add
    }))
    setSelectedProduct(null)
    setEditingCartItem(null)
  }

  const handleEditCartItem = (item: TransactionItem) => {
    // Find the product in the products array to get full product data
    const product = products.find(p => p._id === item.productId)
    if (!product) return
    setSelectedProduct(product)
    setEditingCartItem(item)
    setShowQuantityInput(true)
  }

  const handleBlendSelection = (blendItem: TransactionItem) => {
    // This function is only for adding new blends
    // handleUpdateCustomBlend handles editing
    // Member discounts apply to fixed blends but not custom blends

    // Apply member discount if this is a fixed blend
    const finalBlendItem = blendItem.itemType === 'fixed_blend'
      ? applyMemberDiscount(blendItem)
      : blendItem;

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        ...finalBlendItem,
        customBlendData: blendItem.customBlendData
      }]
    }))

    setShowFixedBlendSelector(false)
    setShowCustomBlendCreator(false)
  }

  const handleBundleSelection = (bundleItem: TransactionItem) => {
    // NO member discounts for bundles
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, bundleItem]
    }))
    setShowBundleSelector(false)
  }

  const handleConsultationSelection = (consultationItem: TransactionItem) => {
    // NO member discounts for consultations
    if (editingConsultationId) {
      // Replace existing consultation item
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.id === editingConsultationId ? consultationItem : item
        )
      }))
      setEditingConsultationId(null)
    } else {
      // Add new consultation item
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, consultationItem]
      }))
    }
    setShowConsultationSelector(false)
  }

  const handleMiscellaneousSelection = (miscItem: TransactionItem) => {
    // NO member discounts for miscellaneous items
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, miscItem]
    }))
    setShowMiscellaneousSelector(false)
  }

  const removeItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }))
  }

  // Centralized function to apply member discounts to REGULAR PRODUCTS AND FIXED BLENDS
  const applyMemberDiscount = (item: TransactionItem): TransactionItem => {
    if (isManualDiscountItem(item)) {
      return normalizeManualDiscount(item)
    }

    console.log('[Discount] Checking item:', item.name, {
      itemType: item.itemType,
      saleType: item.saleType,
      isService: item.isService,
      patientDiscount: selectedPatient?.memberBenefits?.discountPercentage
    });

    // Apply discounts to regular products and fixed blends (including Sell in Parts) - exclude custom blends, bundles, etc.
    if (!selectedPatient?.memberBenefits?.discountPercentage ||
        item.isService ||
        (item.itemType !== 'product' && item.itemType !== 'fixed_blend')) {  // Include fixed blends
      console.log('[Discount] Item not eligible:', {
        reason: !selectedPatient?.memberBenefits?.discountPercentage ? 'No patient discount' :
                item.isService ? 'Is a service' :
                'Not product or fixed blend'
      });
      return item
    }

    // For regular products, use the existing product
    // For fixed blends, create a synthetic product object for discount calculation
    let productForDiscount = item.product;
    
    if (item.itemType === 'fixed_blend' && !item.product) {
      // Synthetic product for fixed-blend discount eligibility — fixed blends are
      // discountable by default; the real product (if any) overrides via lookup.
      productForDiscount = {
        _id: item.productId || '',
        discountFlags: {
          discountableForMembers: true,
          discountableForAll: true,
          discountableInBlends: false
        }
      } as Partial<Product> as Product;
    }

    // Skip if we still don't have a product reference (for regular products)
    // Reset any existing discount if product is unavailable
    if (!productForDiscount) {
      console.log('[Discount] Product not available for:', item.name, '- resetting discount');
      return {
        ...clearDiscountMetadata(item),
        discountAmount: 0,
        totalPrice: item.quantity * item.unitPrice
      };
    }

    const customerForDiscount = {
      _id: selectedPatient.id,
      discountRate: selectedPatient.memberBenefits.discountPercentage
    }

    const discountCalc = DiscountService.calculateItemDiscount(
      productForDiscount,
      item.quantity,
      item.unitPrice,
      customerForDiscount,
      { itemType: item.itemType }
    )

    if (discountCalc.eligible && discountCalc.discountCalculation) {
      console.log('[Discount] ✓ Applied discount to:', item.name, {
        originalPrice: item.unitPrice * item.quantity,
        discountAmount: discountCalc.discountCalculation.discountAmount,
        finalPrice: discountCalc.discountCalculation.finalPrice,
        discountPercentage: discountCalc.discountCalculation.discountPercentage
      });
      return {
        ...item,
        discountAmount: discountCalc.discountCalculation.discountAmount,
        discountSource: 'membership' as const,
        discountReason: undefined,
        totalPrice: discountCalc.discountCalculation.finalPrice
      }
    }

    // Item is eligible but no discount calculated (e.g., product not discountable)
    // Reset any existing discount
    console.log('[Discount] Item eligible but no discount calculated for:', item.name, '- resetting discount');
    return {
      ...clearDiscountMetadata(item),
      discountAmount: 0,
      totalPrice: item.quantity * item.unitPrice
    }
  }
  
  const handlePatientSelect = async (patient: Patient) => {
    const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
    console.log('[Discount] Patient selected:', fullName, {
      membershipTier: patient.memberBenefits?.membershipTier,
      discountPercentage: patient.memberBenefits?.discountPercentage,
      existingItemsCount: formData.items.length
    });

    // Calculate discounts first to get accurate count for toast
    let updatedItemsForToast: TransactionItem[] = [];

    // Recalculate prices and discounts for all existing items when patient changes
    setFormData(prev => {
      console.log('[Discount] Recalculating discounts for', prev.items.length, 'existing items');

      const updatedItems = prev.items.map((item) => {
        if (isManualDiscountItem(item)) {
          return normalizeManualDiscount(item)
        }

        // Skip recalculation for non-eligible items for membership discounts (services, custom blends, bundles, etc.)
        // Note: "Sell in Parts" items (saleType: 'volume') ARE eligible for member discounts
        if (item.isService ||
            (item.itemType !== 'product' && item.itemType !== 'fixed_blend')) {
          return item;
        }

        // Get the product for discount calculation
        let product = item.product;
        if (item.itemType === 'product') {
          // Try multiple sources for product data to handle race conditions
          const foundProduct = products.find(p => p._id === item.productId);
          if (foundProduct) {
            product = foundProduct;
          } else if (item.product) {
            product = item.product;
          } else {
            // Create minimal product with default discount flags (discountable by default)
            product = {
              _id: item.productId || '',
              discountFlags: { discountableForMembers: true, discountableForAll: true, discountableInBlends: false }
            } as Partial<Product> as Product;
          }
        } else if (item.itemType === 'fixed_blend' && !product) {
          product = {
            _id: item.productId || '',
            discountFlags: { discountableForMembers: true, discountableForAll: true, discountableInBlends: false }
          } as Partial<Product> as Product;
        }

        // Create customer object compatible with DiscountService
        const customerForDiscount = patient.memberBenefits?.discountPercentage ? {
          _id: patient.id,
          discountRate: patient.memberBenefits!.discountPercentage
        } : null;

        if (customerForDiscount && product) {
          // Calculate member discount for this item
          const discountResult = DiscountService.calculateItemDiscount(
            product,
            item.quantity,
            item.unitPrice,
            customerForDiscount,
            { itemType: item.itemType }
          );


          if (discountResult.eligible && discountResult.discountCalculation) {
            // Apply the member discount
            console.log('[Discount] ✓ Recalculated discount for:', item.name, {
              discountAmount: discountResult.discountCalculation.discountAmount,
              finalPrice: discountResult.discountCalculation.finalPrice
            });
            return {
              ...item,
              discountAmount: discountResult.discountCalculation.discountAmount,
              discountSource: 'membership' as const,
              discountReason: undefined,
              totalPrice: discountResult.discountCalculation.finalPrice
            };
          }
        }

        // If no discount applicable, reset any existing discounts
        console.log('[Discount] Resetting discount for:', item.name);
        return {
          ...clearDiscountMetadata(item),
          discountAmount: 0,
          totalPrice: item.quantity * item.unitPrice
        };
      });

      const discountedItemsCount = updatedItems.filter(i => (i.discountAmount || 0) > 0).length;
      console.log('[Discount] Recalculation complete:', discountedItemsCount, 'items with discounts out of', updatedItems.length);

      // Store for toast notification
      updatedItemsForToast = updatedItems;

      return {
        ...prev,
        customerName: fullName,
        customerEmail: patient.email || '',
        customerPhone: patient.phone || '',
        customerId: patient.id,
        items: updatedItems
      };
    });

    // Show toast notification if discounts were applied (using updated items, not stale formData)
    if (patient.memberBenefits?.discountPercentage && updatedItemsForToast.length > 0) {
      const discountedCount = updatedItemsForToast.filter(i => (i.discountAmount || 0) > 0).length;
      if (discountedCount > 0) {
        toast({
          title: "Member Discount Applied",
          description: `${patient.memberBenefits!.discountPercentage}% ${patient.memberBenefits!.membershipTier?.toUpperCase()} discount applied to ${discountedCount} eligible item(s)`,
        });
      }
    }

    setSelectedPatient(patient)
  }

  // Helper to detect price mismatch between draft item and current inventory
  const getPriceMismatch = useCallback((item: TransactionItem): {
    hasMismatch: boolean;
    currentPrice: number | null;
    difference: number
  } => {
    // Only check regular products — skip bundles, blends, services, miscellaneous
    if (
      item.itemType !== 'product' ||
      item.isService
    ) {
      return { hasMismatch: false, currentPrice: null, difference: 0 };
    }

    const currentProduct = products.find(p => p._id === item.productId);
    if (!currentProduct) {
      return { hasMismatch: false, currentPrice: null, difference: 0 };
    }

    // Use centralized price comparison that handles both quantity and volume sale types
    const result = detectPriceMismatch(
      item.unitPrice,
      currentProduct.sellingPrice,
      currentProduct.containerCapacity,
      item.saleType,
    );

    return {
      hasMismatch: result.hasMismatch,
      currentPrice: result.currentPrice,
      difference: result.difference,
    };
  }, [products]);

  // Helper to detect ingredient price mismatches in custom blends
  const getCustomBlendMismatch = useCallback((item: TransactionItem): {
    hasMismatch: boolean;
    changedIngredients: Array<{
      name: string;
      originalCost: number;
      currentCost: number;
      difference: number;
    }>;
    totalDifference: number;
    newTotalIngredientCost: number;
  } => {
    if (item.itemType !== 'custom_blend' || !item.customBlendData?.ingredients) {
      return { hasMismatch: false, changedIngredients: [], totalDifference: 0, newTotalIngredientCost: 0 };
    }

    const changedIngredients: Array<{
      name: string;
      originalCost: number;
      currentCost: number;
      difference: number;
    }> = [];

    let newTotalIngredientCost = 0;

    for (const ingredient of item.customBlendData.ingredients) {
      const currentProduct = products.find(p => p._id === ingredient.productId);
      const originalCost = ingredient.costPerUnit || 0;
      const currentCost = currentProduct ? (perUnitCost(currentProduct) ?? originalCost) : originalCost;
      const ingredientTotal = ingredient.quantity * currentCost;
      newTotalIngredientCost += ingredientTotal;

      if (Math.abs(currentCost - originalCost) > 0.001) {
        changedIngredients.push({
          name: ingredient.name,
          originalCost,
          currentCost,
          difference: currentCost - originalCost
        });
      }
    }

    const originalTotal = item.customBlendData.totalIngredientCost || 0;
    const totalDifference = newTotalIngredientCost - originalTotal;

    return {
      hasMismatch: changedIngredients.length > 0,
      changedIngredients,
      totalDifference,
      newTotalIngredientCost
    };
  }, [products]);

  // Handler to refresh single item's price to current inventory price
  const handleRefreshPrice = useCallback((itemId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id !== itemId) return item;

        const currentProduct = products.find(p => p._id === item.productId);
        if (!currentProduct) return item;

        // Use centralized pricing — correctly divides by containerCapacity for volume items
        const newUnitPrice = computeUnitPrice(currentProduct.sellingPrice, currentProduct.containerCapacity, item.saleType);
        const baseTotal = newUnitPrice * item.quantity;
        const repricedItem = {
          ...item,
          unitPrice: newUnitPrice,
        }

        if (isManualDiscountItem(repricedItem)) {
          return normalizeManualDiscount(repricedItem)
        }

        // Recalculate member discount if applicable
        if (selectedPatient?.memberBenefits?.discountPercentage &&
            item.itemType === 'product' &&
            !item.isService) {
          const customerForDiscount = {
            _id: selectedPatient.id || (selectedPatient as { _id?: string })._id || '',
            discountRate: selectedPatient.memberBenefits.discountPercentage
          };

          const discountCalc = DiscountService.calculateItemDiscount(
            currentProduct,
            item.quantity,
            newUnitPrice,
            customerForDiscount,
            { itemType: item.itemType }
          );

          if (discountCalc.eligible && discountCalc.discountCalculation) {
            return {
              ...item,
              unitPrice: newUnitPrice,
              discountAmount: discountCalc.discountCalculation.discountAmount,
              discountSource: 'membership' as const,
              discountReason: undefined,
              totalPrice: discountCalc.discountCalculation.finalPrice
            };
          }
        }

        return {
          ...clearDiscountMetadata(item),
          unitPrice: newUnitPrice,
          discountAmount: 0,
          totalPrice: baseTotal
        };
      })
    }));

    toast({
      title: "Price Updated",
      description: "Item price has been updated to current inventory price",
    });
  }, [products, selectedPatient, toast]);

  // Handler to refresh custom blend ingredient prices to current inventory prices
  const handleRefreshCustomBlendPrices = useCallback((itemId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id !== itemId || item.itemType !== 'custom_blend' || !item.customBlendData) {
          return item;
        }

        // Update each ingredient's costPerUnit to current per-base-unit cost via shared utility.
        const updatedIngredients = item.customBlendData.ingredients.map(ingredient => {
          const currentProduct = products.find(p => p._id === ingredient.productId);
          const derivedCost = currentProduct ? perUnitCost(currentProduct) : undefined;
          return {
            ...ingredient,
            costPerUnit: derivedCost ?? ingredient.costPerUnit
          };
        });

        // Recalculate total ingredient cost
        const newTotalIngredientCost = updatedIngredients.reduce(
          (sum, ing) => sum + (ing.quantity * (ing.costPerUnit || 0)),
          0
        );

        // Calculate the ratio to maintain the same margin/markup
        const originalTotal = item.customBlendData.totalIngredientCost || 1;
        const priceRatio = item.unitPrice / originalTotal;
        const newUnitPrice = newTotalIngredientCost * priceRatio;
        const newTotalPrice = newUnitPrice * item.quantity;

        const updatedItem = {
          ...item,
          unitPrice: newUnitPrice,
          totalPrice: newTotalPrice,
          customBlendData: {
            ...item.customBlendData,
            ingredients: updatedIngredients,
            totalIngredientCost: newTotalIngredientCost
          }
        };

        return isManualDiscountItem(updatedItem)
          ? normalizeManualDiscount(updatedItem)
          : updatedItem;
      })
    }));

    toast({
      title: "Blend Prices Updated",
      description: "Ingredient prices have been updated to current inventory prices",
    });
  }, [products, toast]);

  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId)
      return
    }

    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          if (isManualDiscountItem(item)) {
            return normalizeManualDiscount({
              ...item,
              quantity: newQuantity,
              convertedQuantity: newQuantity
            })
          }

          // Recalculate discount and price for products and fixed blends (not services/bundles/custom blends)
          if (!item.isService && selectedPatient?.memberBenefits?.discountPercentage && 
              (item.itemType === 'product' || item.itemType === 'fixed_blend')) {
            
            // Get or create product for discount calculation
            let productForDiscount = item.product;
            if (item.itemType === 'product') {
              // Try multiple sources for product data to handle race conditions
              const foundProduct = products.find(p => p._id === item.productId);
              if (foundProduct) {
                productForDiscount = foundProduct;
              } else if (!productForDiscount) {
                // Create minimal product with default discount flags (discountable by default)
                productForDiscount = {
                  _id: item.productId || '',
                  discountFlags: { discountableForMembers: true, discountableForAll: true, discountableInBlends: false }
                } as Partial<Product> as Product;
              }
            } else if (item.itemType === 'fixed_blend' && !productForDiscount) {
              productForDiscount = {
                _id: item.productId || '',
                discountFlags: { discountableForMembers: true, discountableForAll: true, discountableInBlends: false }
              } as Partial<Product> as Product;
            }

            if (productForDiscount) {
            const customerForDiscount = {
              _id: selectedPatient.id,
              discountRate: selectedPatient.memberBenefits.discountPercentage
            }
            
            const discountCalc = DiscountService.calculateItemDiscount(
              productForDiscount,
              newQuantity,
              item.unitPrice,
              customerForDiscount,
              { itemType: item.itemType }
            );
            
            const discountAmount = discountCalc.eligible && discountCalc.discountCalculation 
              ? discountCalc.discountCalculation.discountAmount 
              : 0;
            const totalPrice = discountCalc.eligible && discountCalc.discountCalculation 
              ? discountCalc.discountCalculation.finalPrice 
              : item.unitPrice * newQuantity;

            return {
              ...item,
              quantity: newQuantity,
              totalPrice,
              discountAmount,
              discountSource: discountAmount > 0 ? 'membership' as const : undefined,
              discountReason: undefined,
              convertedQuantity: newQuantity
            }
            }
          } else {
            // For services, bundles, custom blends, or when no patient selected - no discount recalculation
            return {
              ...clearDiscountMetadata(item),
              quantity: newQuantity,
              totalPrice: item.unitPrice * newQuantity,
              convertedQuantity: newQuantity
            }
          }
        }
        return item
      })
    }))
  }

  const handleEditConsultation = (item: TransactionItem) => {
    setEditingConsultationId(item.id!)
    setShowConsultationSelector(true)
  }

  const handleEditCustomBlend = (item: TransactionItem) => {
    console.log('🔍 Editing custom blend item:', item)
    console.log('🔍 Custom blend data:', item.customBlendData)
    // Create a stable deep copy of the item to prevent reference changes
    const stableCopy = JSON.parse(JSON.stringify(item))
    console.log('🔍 Stable copy:', stableCopy)
    setEditingCustomBlend(stableCopy)
    setShowCustomBlendCreator(true)
  }

  const handleEditFixedBlend = (item: TransactionItem) => {
    // Create a stable deep copy of the item to prevent reference changes
    const stableCopy = JSON.parse(JSON.stringify(item))
    setEditingFixedBlend(stableCopy)
    setShowFixedBlendSelector(true)
  }

  const handleUpdateCustomBlend = (updatedBlend: TransactionItem) => {
    // NO member discounts for custom blends
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        // Match by id first, fallback to productId for custom blends (id might not be preserved in drafts)
        const isMatch = item.id === updatedBlend.id ||
          (item.itemType === 'custom_blend' && item.productId === updatedBlend.productId)
        return isMatch ? updatedBlend : item
      })
    }))
    setShowCustomBlendCreator(false)
    setEditingCustomBlend(null)
  }

  const handleUpdateFixedBlend = (updatedBlend: TransactionItem) => {
    // Apply member discount if applicable
    const finalBlendItem = applyMemberDiscount(updatedBlend)
    
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === updatedBlend.id ? finalBlendItem : item
      )
    }))
    setShowFixedBlendSelector(false)
    setEditingFixedBlend(null)
  }

  const isConsultationItem = (item: TransactionItem) => {
    return item.isService && item.productId === "consultation-fee"
  }

  const toggleGiftItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        const canGiftItem = allowDiscountOverride
          ? isDiscountOverrideEligibleItem(item)
          : isGiftEligibleItem(item)
        if (item.id !== itemId || !canGiftItem) return item

        if (isGiftItem(item)) {
          const restoredItem = {
            ...clearDiscountMetadata(item),
            discountAmount: 0,
            totalPrice: getLineSubtotal(item),
          }
          return applyMemberDiscount(restoredItem)
        }

        return normalizeManualDiscount({
          ...item,
          discountSource: 'gift' as const,
          discountReason: 'Gift / free of charge',
        })
      })
    }))
  }

  const handleManualDiscountOverride = (itemId: string) => {
    const item = formData.items.find(cartItem => cartItem.id === itemId)
    if (!item || !isDiscountOverrideEligibleItem(item)) return

    const subtotal = getLineSubtotal(item)
    const currentDiscount = item.discountAmount || 0
    setManualDiscountDraft({
      itemId,
      itemName: item.name,
      mode: 'amount',
      value: currentDiscount.toString(),
      reason: item.discountReason || '',
      subtotal,
    })
  }

  const applyManualDiscountOverride = () => {
    if (!manualDiscountDraft) return

    const parsedValue = Number.parseFloat(manualDiscountDraft.value)
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      toast({
        title: "Discount not applied",
        description: "Enter a positive amount, 0, or a percentage.",
        variant: "destructive",
      })
      return
    }

    const requestedDiscount = manualDiscountDraft.mode === 'percentage'
      ? manualDiscountDraft.subtotal * parsedValue / 100
      : parsedValue
    const clampedDiscount = Math.min(Math.max(roundCurrency(requestedDiscount), 0), manualDiscountDraft.subtotal)

    if (clampedDiscount === 0) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(cartItem => {
          if (cartItem.id !== manualDiscountDraft.itemId) return cartItem
          const restoredItem = {
            ...clearDiscountMetadata(cartItem),
            discountAmount: 0,
            totalPrice: getLineSubtotal(cartItem),
          }
          return applyMemberDiscount(restoredItem)
        })
      }))
      setManualDiscountDraft(null)
      return
    }

    setFormData(prev => ({
      ...prev,
      items: prev.items.map(cartItem => {
        if (cartItem.id !== manualDiscountDraft.itemId) return cartItem
        return normalizeManualDiscount({
          ...cartItem,
          discountAmount: clampedDiscount,
          discountSource: 'manual_override' as const,
          discountReason: manualDiscountDraft.reason.trim() || undefined,
        })
      })
    }))
    setManualDiscountDraft(null)
  }

  // const handleAddReorderItems = (items: Array<{ productId: string; name: string; quantity?: number; itemType: string }>) => { ... } // See purchase history TODO above

  // const handleQuickReorder = async (transactionId: string) => {
  //   try {
  //     const response = await fetch('/api/transactions/quick-reorder', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ 
  //         transactionId,
  //         customerId: formData.customerId,
  //         createDraft: true 
  //       })
  //     })
      
  //     if (!response.ok) throw new Error('Failed to create reorder')
  //     const data = await response.json()
      
  //     // Redirect to the new transaction
  //     window.location.href = `/transactions/${data.transaction._id}`
  //   } catch {
  //     alert('Failed to create reorder')
  //   }
  // }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // CRITICAL: Ref-based lock to prevent double-clicks regardless of React state timing
    // This check runs synchronously before any async operations
    if (isSubmittingRef.current) {
      console.log('[SimpleTransactionForm] Blocked duplicate submission (ref lock)')
      return
    }

    // Also check the prop-based loading state as a fallback
    if (loading) {
      console.log('[SimpleTransactionForm] Blocked submission (loading prop)')
      return
    }

    // Set the ref lock IMMEDIATELY (synchronous, before any async work)
    isSubmittingRef.current = true

    try {
      if (!formData.customerName.trim()) {
        alert('Please enter customer name')
        return
      }

      if (formData.items.length === 0) {
        alert('Please add at least one item')
        return
      }

      // Validate all items have valid names (prevent "Unknown Item" entries)
      const invalidItems = formData.items.filter(item =>
        !item.name || item.name.trim() === '' || item.name === 'Unknown Item'
      )
      if (invalidItems.length > 0) {
        alert(`Cannot submit: ${invalidItems.length} item(s) have missing or invalid names. Please remove or fix these items.`)
        return
      }

      // Auto-set payment status based on paidAmount when completing a transaction
      const submitData = {
        ...formData,
        items: formData.items.map(item => prepareDiscountOverrideItem(item, allowDiscountOverride)),
      }
      if (formData.paymentStatus === 'pending') {
        if (submitData.paidAmount >= submitData.totalAmount) {
          submitData.paymentStatus = 'paid'
          submitData.changeAmount = submitData.paidAmount - submitData.totalAmount
        } else if (submitData.paidAmount > 0) {
          submitData.paymentStatus = 'partial'
        }
        // If paidAmount === 0, keep as 'pending'
      }

      console.log('🔍 handleSubmit - submitData:', submitData)
      console.log('🔍 handleSubmit - items with customBlendData:',
        submitData.items.filter(item => item.itemType === 'custom_blend').map(item => ({
          name: item.name,
          customBlendData: item.customBlendData
        }))
      )
      await onSubmit(submitData)
    } finally {
      // Release the lock after submission completes (success or failure)
      isSubmittingRef.current = false
    }
  }

  const toggleDiscountMode = () => {
    const newMode = discountMode === 'amount' ? 'percentage' : 'amount'
    setDiscountMode(newMode)
    
    // Convert current value to new mode
    if (discountValue) {
      const numValue = Number.parseFloat(discountValue) || 0
      const additionalDiscountBase = getBillDiscountBase(formData.items, allowDiscountOverride)
      
      // Convert between discount modes manually
      if (discountMode === 'percentage') {
        // Converting from percentage to amount
        const convertedAmount = additionalDiscountBase * numValue / 100
        setDiscountValue(convertedAmount.toString())
      } else {
        // Converting from amount to percentage
        const convertedPercentage = additionalDiscountBase > 0 ? (numValue / additionalDiscountBase * 100) : 0
        setDiscountValue(convertedPercentage.toString())
      }
    }
  }

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return

    // Prevent duplicate draft saves using the same ref lock
    // Also check loading prop which now includes draft saving state
    if (isSubmittingRef.current || loading) {
      console.log('[SimpleTransactionForm] Blocked duplicate draft save (ref lock or loading)')
      return
    }

    if (formData.items.length === 0) {
      alert('Please add at least one item to save as draft')
      return
    }

    isSubmittingRef.current = true

    try {
      const draftData = {
        ...formData,
        items: formData.items.map(item => prepareDiscountOverrideItem(item, allowDiscountOverride)),
        isDraft: true,
        status: 'draft' as const
      }

      // Call parent handler - it will show toast
      await onSaveDraft(draftData)
    } finally {
      isSubmittingRef.current = false
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-0">
      {/* Customer Information */}
      <section className="border-b border-[#E5E7EB] pb-8">
        <header className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">i. Customer information</p>
          <EditorialButton
            variant="ghost"
            type="button"
            icon={<FaUserPlus className="h-3 w-3" />}
            onClick={() => setShowPatientSelector(true)}
          >
            Select patient
          </EditorialButton>
        </header>
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Name *</Label>
              <Input
                id="customerName"
                value={formData.customerName}
                onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                placeholder="Customer name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerEmail">Email</Label>
              <Input
                id="customerEmail"
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                placeholder="Email (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Phone</Label>
              <Input
                id="customerPhone"
                value={formData.customerPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                placeholder="Phone (optional)"
              />
            </div>
          </div>
          {selectedPatient?.memberBenefits?.discountPercentage && selectedPatient.memberBenefits.discountPercentage > 0 && (
            <div className="mt-6 border-l-2 border-[#16A34A] bg-[#F0FDF4] px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[13px] text-[#0A0A0A]">
                  <span className="text-[10px] uppercase tracking-[0.28em] text-[#16A34A] mr-3">Member discount · {selectedPatient.memberBenefits.discountPercentage}%</span>
                  <span className="italic font-light text-[#6B7280]">applied automatically to eligible items</span>
                </p>
                {selectedPatient.memberBenefits && selectedPatient.memberBenefits.membershipTier && (
                  <EditorialPill tone="ok">
                    {selectedPatient.memberBenefits.membershipTier.toUpperCase()}
                  </EditorialPill>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Cart Items */}
      <section className="border-b border-[#E5E7EB] py-8">
        <header className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">ii. Cart items</p>
          <EditorialButton
            variant="primary"
            type="button"
            arrow
            onClick={() => setShowTypeSelector(true)}
          >
            Add item
          </EditorialButton>
        </header>
        <div>
          {formData.items.length === 0 ? (
            <div className="text-center py-16">
              <FaShoppingCart className="w-8 h-8 mx-auto mb-4 text-[#D1D5DB]" />
              <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">Cart is empty</p>
              <p className="text-sm italic font-light text-[#6B7280] mt-3">Click &ldquo;Add item&rdquo; to start.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {formData.items.map((item) => {
                const priceMismatch = getPriceMismatch(item);
                const customBlendMismatch = getCustomBlendMismatch(item);
                const discountLabel = getItemDiscountLabel(item, selectedPatient?.memberBenefits?.discountPercentage);
                const quantityDisplay = getTransactionQuantityDisplayParts({
                  quantity: item.quantity,
                  saleType: item.saleType,
                  baseUnit: item.baseUnit,
                  convertedQuantity: item.convertedQuantity,
                  unitPrice: item.unitPrice,
                  containerCapacity: item.containerCapacity,
                  containerCapacityAtSale: item.containerCapacityAtSale,
                  containerType: item.containerType,
                  product: item.product,
                });

                return (
                <div key={item.id} className={`flex items-center gap-4 py-4 ${
                  (item.discountAmount || 0) > 0 ? 'border-l-2 border-[#16A34A] pl-4' :
                  (priceMismatch.hasMismatch || customBlendMismatch.hasMismatch) ? 'border-l-2 border-[#EA580C] pl-4' : ''
                }`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-[14px] text-[#0A0A0A] font-medium">{item.name}</p>
                      {item.saleType === 'volume' && (
                        <EditorialPill tone="warning">Sold in parts</EditorialPill>
                      )}
                    </div>
                    {item.sku && (
                      <p className="text-[11px] text-[#9CA3AF] font-mono tracking-wide mt-0.5">SKU · {item.sku}</p>
                    )}
                    {item.description && (
                      <p className="text-[12px] text-[#6B7280] italic font-light mt-0.5">{item.description}</p>
                    )}
                    {priceMismatch.hasMismatch && priceMismatch.currentPrice !== null && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center text-[10px] uppercase tracking-[0.22em] text-[#EA580C]">
                          <FiAlertTriangle className="w-3 h-3 mr-1" />
                          Price changed
                        </span>
                        <span className="text-[11px] text-[#EA580C] tabular-nums">
                          Now: {formatCurrency(priceMismatch.currentPrice)}
                          {priceMismatch.difference > 0
                            ? ` (+${formatCurrency(priceMismatch.difference)})`
                            : ` (${formatCurrency(priceMismatch.difference)})`}
                        </span>
                      </div>
                    )}
                    {customBlendMismatch.hasMismatch && (
                      <div className="mt-2 space-y-1">
                        <span className="inline-flex items-center text-[10px] uppercase tracking-[0.22em] text-[#EA580C]">
                          <FiAlertTriangle className="w-3 h-3 mr-1" />
                          Ingredient prices changed
                        </span>
                        <div className="text-[11px] text-[#EA580C] space-y-0.5 tabular-nums">
                          {customBlendMismatch.changedIngredients.map((ing, idx) => (
                            <div key={idx}>
                              {ing.name}: now {formatCurrency(ing.currentCost)}
                              {ing.difference > 0
                                ? ` (+${formatCurrency(ing.difference)})`
                                : ` (${formatCurrency(ing.difference)})`}
                            </div>
                          ))}
                          <div className="font-medium pt-1 border-t border-[#FED7AA] mt-1">
                            Total: {formatCurrency(customBlendMismatch.newTotalIngredientCost)}
                            {customBlendMismatch.totalDifference > 0
                              ? ` (+${formatCurrency(customBlendMismatch.totalDifference)})`
                              : ` (${formatCurrency(customBlendMismatch.totalDifference)})`}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {!isConsultationItem(item) && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        className="h-7 w-7 border border-[#E5E7EB] hover:border-[#0A0A0A] text-[#6B7280] hover:text-[#0A0A0A] transition-colors text-sm"
                        onClick={() => updateItemQuantity(item.id!, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="w-20 text-center text-[12px] text-[#0A0A0A] tabular-nums">
                        {quantityDisplay.quantityText}{' '}
                        <span className="text-[#9CA3AF]">{quantityDisplay.unitLabel}</span>
                      </span>
                      <button
                        type="button"
                        className="h-7 w-7 border border-[#E5E7EB] hover:border-[#0A0A0A] text-[#6B7280] hover:text-[#0A0A0A] transition-colors text-sm"
                        onClick={() => updateItemQuantity(item.id!, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  )}
                  {isConsultationItem(item) && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] uppercase tracking-[0.22em] text-[#6B7280]">Qty <span className="tabular-nums text-[#0A0A0A] normal-case tracking-normal text-sm ml-1">{quantityDisplay.quantityText}</span></span>
                    </div>
                  )}
                  <div className="text-right shrink-0">
                    {(item.discountAmount || 0) > 0 ? (
                      <div>
                        <p className="text-[11px] text-[#9CA3AF] line-through tabular-nums">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-[#16A34A] mt-1">
                          {discountLabel}
                        </p>
                        <p className="text-[10px] text-[#16A34A] tabular-nums italic font-light">
                          save {formatCurrency(item.discountAmount || 0)}
                        </p>
                        <p className="text-[16px] text-[#16A34A] tabular-nums mt-1">{formatCurrency(item.totalPrice)}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[14px] text-[#0A0A0A] tabular-nums">{formatCurrency(item.totalPrice)}</p>
                        {selectedPatient?.memberBenefits?.discountPercentage && (item.discountAmount || 0) === 0 && (
                          <>
                            {(item.itemType === 'product' || item.itemType === 'fixed_blend') &&
                             !item.isService && item.saleType !== 'volume' && (
                              <p className="text-[10px] uppercase tracking-[0.22em] text-[#9CA3AF] mt-1">
                                {item.product?.discountFlags?.discountableForAll === false
                                  ? 'Non-discountable'
                                  : item.product?.discountFlags?.discountableForMembers === false
                                  ? 'Not eligible'
                                  : 'No discount'}
                              </p>
                            )}
                            {(item.isService ||
                              (item.itemType !== 'product' && item.itemType !== 'fixed_blend')) && (
                              <p className="text-[10px] uppercase tracking-[0.22em] text-[#EA580C] mt-1">
                                {item.itemType === 'bundle' ? 'Bundle pricing' :
                                 item.itemType === 'custom_blend' ? 'Custom blend' :
                                 item.isService ? 'Service' :
                                 'Not eligible'}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {allowDiscountOverride && isDiscountOverrideEligibleItem(item) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={`transition-colors ${item.discountSource === 'manual_override' ? 'text-[#0F766E] hover:text-[#0A0A0A]' : 'text-[#6B7280] hover:text-[#0F766E]'}`}
                              onClick={() => handleManualDiscountOverride(item.id!)}
                              title={item.discountSource === 'manual_override' ? 'Edit manual discount' : 'Add manual discount'}
                            >
                              <FaPercent className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{item.discountSource === 'manual_override' ? 'Edit manual discount' : 'Add manual discount'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {allowDiscountOverride && isDiscountOverrideEligibleItem(item) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={`transition-colors ${isGiftItem(item) ? 'text-[#0F766E] hover:text-[#0A0A0A]' : 'text-[#6B7280] hover:text-[#0F766E]'}`}
                              onClick={() => toggleGiftItem(item.id!)}
                              title={isGiftItem(item) ? 'Remove gift' : 'Mark as gift'}
                            >
                              <FaGift className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{isGiftItem(item) ? 'Remove gift' : 'Mark as gift'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {isConsultationItem(item) && (
                      <button
                        type="button"
                        className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                        onClick={() => handleEditConsultation(item)}
                        title="Edit consultation"
                      >
                        <FaEdit className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {item.itemType === 'custom_blend' && (
                      <button
                        type="button"
                        className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                        onClick={() => handleEditCustomBlend(item)}
                        title="Edit custom blend formula"
                      >
                        <FaEdit className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {customBlendMismatch.hasMismatch && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="text-[#EA580C] hover:opacity-80 transition-opacity"
                              onClick={() => handleRefreshCustomBlendPrices(item.id!)}
                            >
                              <FiRefreshCw className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-center">
                            <p>Refresh to use current inventory prices</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {item.itemType === 'fixed_blend' && (
                      <button
                        type="button"
                        className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                        onClick={() => handleEditFixedBlend(item)}
                        title="Edit fixed blend"
                      >
                        <FaEdit className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {item.itemType === 'product' && (
                      <button
                        type="button"
                        className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                        onClick={() => handleEditCartItem(item)}
                        title="Edit item"
                      >
                        <FaEdit className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {priceMismatch.hasMismatch && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="text-[#EA580C] hover:opacity-80 transition-opacity"
                              onClick={() => handleRefreshPrice(item.id!)}
                            >
                              <FiRefreshCw className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-center">
                            <p>Refresh to use current inventory price</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <button
                      type="button"
                      className="text-[#6B7280] hover:text-[#DC2626] transition-colors"
                      onClick={() => removeItem(item.id!)}
                      title="Remove"
                    >
                      <FaTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      </section>

      {/* Payment Details */}
      <section className="border-b border-[#E5E7EB] py-8">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280] mb-6">iii. Payment details</p>
        <div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select
                  value={formData.paymentMethod || undefined}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, paymentMethod: value as PaymentMethod }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="offset_from_credit">Offset from Credit</SelectItem>
                    <SelectItem value="paynow">PayNow</SelectItem>
                    <SelectItem value="nets">Nets</SelectItem>
                    <SelectItem value="web_store">Web Store</SelectItem>
                    <SelectItem value="misc">Misc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentStatus">Payment Status</Label>
                <Select
                  value={formData.paymentStatus || undefined}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, paymentStatus: value as PaymentStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Auto-update notice for draft transactions */}
            {initialData?.status === 'draft' && formData.paymentStatus === 'pending' && (
              <div className="mt-2 border-l-2 border-[#0A0A0A] bg-[#FAFAFA] px-5 py-3">
                <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">Note</p>
                <p className="text-[13px] text-[#0A0A0A] mt-1">
                  Payment status will be set to &ldquo;Paid&rdquo; automatically when you complete this transaction.
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discountAmount" className="flex items-center justify-between">
                  <span>Discount</span>
                  <button
                    type="button"
                    onClick={toggleDiscountMode}
                    className="text-[10px] uppercase tracking-[0.22em] text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                    title={`Click to enter discount as ${discountMode === 'amount' ? 'percentage' : 'amount'}`}
                  >
                    Switch to {discountMode === 'amount' ? '%' : 'SGD'}
                  </button>
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="discountAmount"
                    type="number"
                    value={discountValue}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    placeholder="0"
                    min="0"
                    max={discountMode === 'percentage' ? "100" : undefined}
                    step={discountMode === 'percentage' ? "0.1" : "0.01"}
                  />
                  <span className="text-sm text-muted-foreground w-4">
                    {discountMode === 'percentage' ? '%' : ''}
                  </span>
                </div>
                {formData.discountAmount > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {discountMode === 'percentage' 
                      ? `= ${formatCurrency(formData.discountAmount)}`
                      : (() => {
                          const additionalDiscountBase = getBillDiscountBase(formData.items, allowDiscountOverride)
                          return additionalDiscountBase > 0 ? `= ${(formData.discountAmount / additionalDiscountBase * 100).toFixed(1)}%` : ''
                        })()
                    }
                  </div>
                )}
              </div>
            </div>
          </div>

          <dl className="mt-6 space-y-3 max-w-md ml-auto pt-4 border-t border-[#E5E7EB]">
            <div className="flex justify-between items-baseline">
              <dt className="text-[12px] text-[#6B7280]">Subtotal</dt>
              <dd className="text-[14px] text-[#0A0A0A] tabular-nums">{formatCurrency(formData.subtotal)}</dd>
            </div>
            {formData.items.some(item => (item.discountAmount || 0) > 0) && (
              <div className="flex justify-between items-baseline">
                <dt className="text-[12px] text-[#16A34A]">Item discounts</dt>
                <dd className="text-[14px] text-[#16A34A] tabular-nums">−{formatCurrency(formData.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0))}</dd>
              </div>
            )}
            {formData.discountAmount > 0 && (
              <div className="flex justify-between items-baseline">
                <dt className="text-[12px] text-[#EA580C]">Additional discount</dt>
                <dd className="text-[14px] text-[#EA580C] tabular-nums">−{formatCurrency(formData.discountAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-3 border-t border-[#0A0A0A]">
              <dt className="text-[10px] uppercase tracking-[0.32em] text-[#0A0A0A]">Total</dt>
              <dd className="font-light text-[28px] leading-none tabular-nums text-[#0A0A0A]">{formatCurrency(formData.totalAmount)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Actions */}
      <div className="mt-8 flex items-center justify-end gap-6 flex-wrap">
        <EditorialButton variant="ghost" type="button" onClick={onCancel} disabled={loading}>
          Cancel
        </EditorialButton>
        {onSaveDraft && (
          <EditorialButton
            variant="ghost"
            type="button"
            onClick={handleSaveDraft}
            disabled={loading || formData.items.length === 0}
          >
            {loading ? (
              <>
                <ImSpinner8 className="w-3 h-3 mr-2 animate-spin" />
                {initialData ? "Updating draft…" : "Saving draft…"}
              </>
            ) : (
              initialData ? "Update draft" : "Save as draft"
            )}
          </EditorialButton>
        )}
        <EditorialButton variant="primary" arrow type="submit" disabled={loading || formData.items.length === 0}>
          {loading ? (
            <>
              <ImSpinner8 className="w-3 h-3 mr-2 animate-spin" />
              Processing…
            </>
          ) : (
            "Complete transaction"
          )}
        </EditorialButton>
      </div>

      {/* Modals */}
      <EditorialModal
        open={!!manualDiscountDraft}
        onOpenChange={(open) => {
          if (!open) setManualDiscountDraft(null)
        }}
        kicker="Super admin"
        title="Manual line discount"
        description={manualDiscountDraft ? manualDiscountDraft.itemName : undefined}
        size="sm"
      >
        {manualDiscountDraft && (
          <div className="space-y-5">
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <div className="space-y-2">
                <Label htmlFor="manualDiscountMode">Mode</Label>
                <Select
                  value={manualDiscountDraft.mode}
                  onValueChange={(mode) => {
                    setManualDiscountDraft(prev => prev ? { ...prev, mode: mode as 'amount' | 'percentage' } : prev)
                  }}
                >
                  <SelectTrigger id="manualDiscountMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">SGD</SelectItem>
                    <SelectItem value="percentage">Percent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualDiscountValue">Discount</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="manualDiscountValue"
                    type="number"
                    min="0"
                    step={manualDiscountDraft.mode === 'percentage' ? "0.1" : "0.01"}
                    max={manualDiscountDraft.mode === 'percentage' ? "100" : undefined}
                    value={manualDiscountDraft.value}
                    onChange={(event) => {
                      setManualDiscountDraft(prev => prev ? { ...prev, value: event.target.value } : prev)
                    }}
                  />
                  <span className="w-8 text-sm text-[#6B7280]">
                    {manualDiscountDraft.mode === 'percentage' ? '%' : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manualDiscountReason">Reason</Label>
              <Input
                id="manualDiscountReason"
                value={manualDiscountDraft.reason}
                onChange={(event) => {
                  setManualDiscountDraft(prev => prev ? { ...prev, reason: event.target.value } : prev)
                }}
                placeholder="B2B discount"
                maxLength={200}
              />
            </div>

            <div className="border-t border-[#E5E7EB] pt-4 text-[12px] text-[#6B7280]">
              Line subtotal: {formatCurrency(manualDiscountDraft.subtotal)}
            </div>

            <EditorialModalFooter>
              <EditorialButton
                type="button"
                variant="ghost"
                onClick={() => setManualDiscountDraft(null)}
              >
                Cancel
              </EditorialButton>
              <EditorialButton
                type="button"
                variant="primary"
                onClick={applyManualDiscountOverride}
              >
                Apply discount
              </EditorialButton>
            </EditorialModalFooter>
          </div>
        )}
      </EditorialModal>

      <TransactionTypeSelector
        open={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
        onSelectType={handleTypeSelection}
      />

      <SimpleProductSelector
        open={showProductSelector}
        onClose={() => setShowProductSelector(false)}
        onSelectProduct={handleProductSelect}
        products={products}
      />

      <SimpleQuantityInput
        open={showQuantityInput}
        onClose={() => { setShowQuantityInput(false); setEditingCartItem(null) }}
        onConfirm={handleQuantityConfirm}
        product={selectedProduct}
        initialQuantity={editingCartItem?.quantity}
        initialSaleType={editingCartItem?.saleType}
      />

      <SimpleBlendSelector
        open={showBlendSelector}
        onClose={() => setShowBlendSelector(false)}
        onSelectFixedBlend={() => {
          setShowBlendSelector(false)
          setShowFixedBlendSelector(true)
        }}
        onSelectCustomBlend={() => {
          setShowBlendSelector(false)
          setShowCustomBlendCreator(true)
        }}
      />

      <FixedBlendSelector
        open={showFixedBlendSelector}
        onClose={() => {
          setShowFixedBlendSelector(false)
          setEditingFixedBlend(null)
        }}
        onSelectBlend={handleBlendSelection}
        onUpdateBlend={handleUpdateFixedBlend}
        editingBlend={editingFixedBlend || undefined}
        loading={loading}
      />

      <CustomBlendCreator
        open={showCustomBlendCreator}
        onClose={() => {
          setShowCustomBlendCreator(false)
          setEditingCustomBlend(null)
        }}
        onCreateBlend={handleBlendSelection}
        onUpdateBlend={handleUpdateCustomBlend}
        editingBlend={editingCustomBlend || undefined}
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

      <PatientSelector
        open={showPatientSelector}
        onClose={() => setShowPatientSelector(false)}
        onSelectPatient={handlePatientSelect}
      />

      <ConsultationSelector
        open={showConsultationSelector}
        onClose={() => {
          setShowConsultationSelector(false)
          setEditingConsultationId(null)
        }}
        onSelectConsultation={handleConsultationSelection}
        loading={loading}
        editingItem={editingConsultationId ? formData.items.find(item => item.id === editingConsultationId) : undefined}
      />

      <MiscellaneousSelector
        open={showMiscellaneousSelector}
        onClose={() => setShowMiscellaneousSelector(false)}
        onSelectMiscellaneous={handleMiscellaneousSelection}
        loading={loading}
      />
    </form>
  )
}
