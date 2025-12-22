"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { FaTrash, FaShoppingCart, FaUserPlus, FaEdit } from "react-icons/fa"
import { ImSpinner8 } from "react-icons/im"
import type { TransactionFormData, TransactionItem, PaymentMethod, PaymentStatus } from "@/types/transaction"
import type { Product } from "@/types/inventory"
import type { Transaction } from "@/types/transaction"
import type { Patient } from "@/types/patient"
import { TransactionTypeSelector } from "./TransactionTypeSelector"
import { SimpleProductSelector } from "./SimpleProductSelector"
import { SimpleQuantityInput } from "./SimpleQuantityInput"
import { PartialQuantitySelector } from "./PartialQuantitySelector"
import { SimpleBlendSelector } from "./SimpleBlendSelector"
import { FixedBlendSelector } from "./FixedBlendSelector"
import { CustomBlendCreator } from "./CustomBlendCreator"
import { BundleSelector } from "./BundleSelector"
import { PatientSelector } from "./PatientSelector"
import { ConsultationSelector } from "./ConsultationSelector"
import { MiscellaneousSelector } from "./MiscellaneousSelector"
import { useUnits } from "@/hooks/useUnits"
import { ReorderSuggestions } from "./ReorderSuggestions"
import { DiscountService } from "@/services/DiscountService"
import { formatCurrency } from "@/utils/currency"
import { useToast } from "@/hooks/use-toast"

interface SimpleTransactionFormProps {
  products: Product[]
  onSubmit: (data: TransactionFormData) => Promise<void>
  onSaveDraft?: (data: TransactionFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
  initialData?: Transaction
}

export function SimpleTransactionForm({ products, onSubmit, onSaveDraft, onCancel, loading, initialData }: SimpleTransactionFormProps) {
  const { units, getUnits } = useUnits()
  const { toast } = useToast()
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [showQuantityInput, setShowQuantityInput] = useState(false)
  const [showPartialQuantitySelector, setShowPartialQuantitySelector] = useState(false)
  const [showBlendSelector, setShowBlendSelector] = useState(false)
  const [showFixedBlendSelector, setShowFixedBlendSelector] = useState(false)
  const [showCustomBlendCreator, setShowCustomBlendCreator] = useState(false)
  const [showBundleSelector, setShowBundleSelector] = useState(false)
  const [showPatientSelector, setShowPatientSelector] = useState(false)
  const [showConsultationSelector, setShowConsultationSelector] = useState(false)
  const [showMiscellaneousSelector, setShowMiscellaneousSelector] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isPartialMode, setIsPartialMode] = useState(false)
  const [editingConsultationId, setEditingConsultationId] = useState<string | null>(null)
  const [editingCustomBlend, setEditingCustomBlend] = useState<TransactionItem | null>(null)
  const [editingFixedBlend, setEditingFixedBlend] = useState<TransactionItem | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [hasPurchaseHistory, setHasPurchaseHistory] = useState(false)
  const [discountMode, setDiscountMode] = useState<'amount' | 'percentage'>('amount')
  const [discountValue, setDiscountValue] = useState<string>('')
  const [isTyping, setIsTyping] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

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
        items: initialData.items.map(item => {
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
                discountableForAll: false,
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
          const response = await fetch(`/api/patients/${initialData.customerId}`)
          if (response.ok) {
            const patient = await response.json()
            console.log('[Discount] Restoring patient in edit mode:', patient.firstName, patient.lastName, {
              membershipTier: patient.memberBenefits?.membershipTier,
              discountPercentage: patient.memberBenefits?.discountPercentage
            });
            setSelectedPatient(patient)

            // CRITICAL FIX: Recalculate discounts for all items when restoring patient in edit mode
            // Only recalculate if products have loaded (products.length > 0) or if all items are fixed blends
            if (patient.memberBenefits?.discountPercentage) {
              console.log('[Discount] Edit mode restoration - products loaded:', products.length);

              // Check if we should wait for products to load
              const hasRegularProducts = initialData.items.some(i => i.itemType === 'product');
              const shouldWaitForProducts = hasRegularProducts && products.length === 0;

              if (shouldWaitForProducts) {
                console.log('[Discount] Waiting for products to load before applying discounts in edit mode');
                // Products dependency will trigger this effect again when products load
                return;
              }

              console.log('[Discount] Recalculating discounts for edit mode with patient discount:', patient.memberBenefits.discountPercentage + '%');
              setFormData(prev => {
                const updatedItems = prev.items.map((item) => {
                  // Skip non-eligible items
                  if (item.isService || item.saleType === 'volume' ||
                      (item.itemType !== 'product' && item.itemType !== 'fixed_blend')) {
                    return item
                  }

                  // Get product for discount calculation
                  let product = item.product;
                  if (item.itemType === 'product') {
                    product = products.find(p => p._id === item.productId) || item.product;
                  } else if (item.itemType === 'fixed_blend' && !product) {
                    product = {
                      _id: item.productId || '',
                      discountFlags: { discountableForMembers: true, discountableForAll: false, discountableInBlends: false }
                    } as Partial<Product> as Product;
                  }

                  if (product) {
                    const customerForDiscount = {
                      _id: patient.id,
                      discountRate: patient.memberBenefits.discountPercentage
                    };

                    const discountResult = DiscountService.calculateItemDiscount(
                      product,
                      item.quantity,
                      item.unitPrice,
                      customerForDiscount,
                      { itemType: item.itemType }
                    );

                    if (discountResult.eligible && discountResult.discountCalculation) {
                      console.log('[Discount] ✓ Applied edit mode discount to:', item.name);
                      return {
                        ...item,
                        discountAmount: discountResult.discountCalculation.discountAmount,
                        totalPrice: discountResult.discountCalculation.finalPrice
                      };
                    }
                  } else {
                    console.log('[Discount] ⚠️ Product not available for:', item.name);
                  }

                  return item;
                });

                const discountedCount = updatedItems.filter(i => (i.discountAmount || 0) > 0).length;
                if (discountedCount > 0) {
                  toast({
                    title: "Member Discount Restored",
                    description: `${patient.memberBenefits.discountPercentage}% ${patient.memberBenefits.membershipTier?.toUpperCase()} discount applied to ${discountedCount} eligible item(s)`,
                  });
                }

                return { ...prev, items: updatedItems };
              });
            }

            // Check if customer has purchase history for reorder suggestions
            try {
              const historyResponse = await fetch(`/api/customers/${patient.id}/purchase-history?limit=1`)
              if (historyResponse.ok) {
                const historyData = await historyResponse.json()
                setHasPurchaseHistory(historyData.transactions && historyData.transactions.length > 0)
              }
            } catch {
              // Silently fail - purchase history is optional
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
          const response = await fetch(`/api/patients/${selectedPatient.id}`)
          if (response.ok) {
            const updatedPatient = await response.json()

            // Check if discount rate changed
            const oldDiscount = selectedPatient.memberBenefits?.discountPercentage || 0
            const newDiscount = updatedPatient.memberBenefits?.discountPercentage || 0
            const discountChanged = oldDiscount !== newDiscount

            if (discountChanged) {
              // Update patient and recalculate all discounts
              setSelectedPatient(updatedPatient)

              // Recalculate all item discounts with new patient data
              setFormData(prev => {
                const updatedItems = prev.items.map((item) => {
                  // Skip non-eligible items for membership discounts
                  if (item.isService || item.saleType === 'volume' || 
                      (item.itemType !== 'product' && item.itemType !== 'fixed_blend')) {
                    return item
                  }

                  // For regular products, find in products array; for fixed blends, create synthetic product
                  let product = item.product;
                  if (item.itemType === 'product') {
                    product = products.find(p => p._id === item.productId) || item.product;
                  } else if (item.itemType === 'fixed_blend' && !product) {
                    product = {
                      _id: item.productId || '',
                      discountFlags: { discountableForMembers: true, discountableForAll: false, discountableInBlends: false }
                    } as Partial<Product> as Product;
                  }

                  const discountRate = updatedPatient.memberBenefits?.discountPercentage

                  if (discountRate && product) {
                    const customerForDiscount = {
                      _id: updatedPatient.id,
                      discountRate: discountRate
                    }
                    
                    const discountCalc = DiscountService.calculateItemDiscount(
                      product,
                      item.quantity,
                      item.unitPrice,
                      customerForDiscount,
                      { itemType: item.itemType }
                    )

                    if (discountCalc.eligible && discountCalc.discountCalculation) {
                      return {
                        ...item,
                        discountAmount: discountCalc.discountCalculation.discountAmount,
                        totalPrice: discountCalc.discountCalculation.finalPrice
                      }
                    }
                  }

                  // No discount applicable
                  return {
                    ...item,
                    discountAmount: 0,
                    totalPrice: item.quantity * item.unitPrice
                  }
                })

                return { ...prev, items: updatedItems }
              })
            }
          }
        } catch (error) {
          console.error('Failed to refresh patient data:', error)
        }
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [selectedPatient?.id, selectedPatient?.memberBenefits?.discountPercentage, products])

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
    debounceRef.current = setTimeout(() => {
      const numValue = Number.parseFloat(value) || 0
      
      // Calculate total membership discounts
      const memberDiscountTotal = formData.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0)
      
      const calculation = DiscountService.calculateAdditionalDiscount(
        discountMode === 'percentage' 
          ? ((formData.subtotal - memberDiscountTotal) * numValue / 100)
          : numValue
      )
      
      setFormData(prev => ({ ...prev, discountAmount: calculation.discountAmount }))
      setIsTyping(false)
    }, 1000)
  }, [formData.subtotal, formData.items, discountMode])

  // Sync discount value with mode changes (but not when user is typing)
  useEffect(() => {
    if (!isTyping && formData.discountAmount > 0) {
      if (discountMode === 'amount') {
        setDiscountValue(formData.discountAmount.toString())
      } else {
        // Calculate percentage based on after-membership total, not subtotal
        const memberDiscountTotal = formData.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0)
        const afterMembershipTotal = formData.subtotal - memberDiscountTotal
        const percentage = afterMembershipTotal > 0 ? (formData.discountAmount / afterMembershipTotal * 100) : 0
        setDiscountValue(percentage.toFixed(2))
      }
    } else if (!isTyping && formData.discountAmount === 0) {
      setDiscountValue('')
    }
  }, [formData.discountAmount, discountMode, formData.subtotal, formData.items, isTyping])

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

  const handleTypeSelection = (type: 'product' | 'blend' | 'bundle' | 'consultation' | 'partial' | 'miscellaneous') => {
    
    // Close all modals first to prevent overlaps
    setShowTypeSelector(false)
    setShowProductSelector(false)
    setShowQuantityInput(false)
    setShowPartialQuantitySelector(false)
    setShowBlendSelector(false)
    setShowFixedBlendSelector(false)
    setShowCustomBlendCreator(false)
    setShowBundleSelector(false)
    setShowConsultationSelector(false)
    setShowMiscellaneousSelector(false)
    setIsPartialMode(false)
    
    // Add a small delay to ensure clean state transitions
    setTimeout(() => {
      
      switch (type) {
        case 'product':
          setShowProductSelector(true)
          break
        case 'partial':
          setIsPartialMode(true)
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
    if (isPartialMode) {
      setShowPartialQuantitySelector(true)
    } else {
      setShowQuantityInput(true)
    }
  }

  const handleQuantityConfirm = (quantity: number) => {
    if (!selectedProduct) return

    const unitOfMeasurement = selectedProduct.unitOfMeasurement
    let unitId = ''
    let baseUnit = 'unit'

    if (typeof unitOfMeasurement === 'object' && unitOfMeasurement !== null) {
      unitId = unitOfMeasurement._id || unitOfMeasurement.id || ''
      baseUnit = unitOfMeasurement.baseUnit || unitOfMeasurement.name || 'unit'
    } else if (typeof unitOfMeasurement === 'string') {
      unitId = unitOfMeasurement
      baseUnit = unitOfMeasurement
    }

    const baseItem: TransactionItem = {
      id: `item_${Date.now()}`,
      productId: selectedProduct._id,
      product: selectedProduct,
      name: selectedProduct.name,
      description: selectedProduct.description,
      quantity: quantity,
      unitPrice: selectedProduct.sellingPrice,
      totalPrice: selectedProduct.sellingPrice * quantity, // Base price before discount
      discountAmount: 0,
      isService: false,
      itemType: 'product', // Set item type for regular products
      saleType: 'quantity',
      unitOfMeasurementId: unitId,
      baseUnit: baseUnit,
      convertedQuantity: quantity * (selectedProduct.containerCapacity || 1),
      sku: selectedProduct.sku
    }

    // Apply member discount using centralized function
    const newItem = applyMemberDiscount(baseItem)

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
    setSelectedProduct(null)
  }

  const handlePartialQuantityConfirm = (quantity: number) => {
    if (!selectedProduct) return

    const unitOfMeasurement = selectedProduct.unitOfMeasurement
    let unitId = ''
    let baseUnit = 'unit'

    if (typeof unitOfMeasurement === 'object' && unitOfMeasurement !== null) {
      unitId = unitOfMeasurement._id || unitOfMeasurement.id || ''
      baseUnit = unitOfMeasurement.baseUnit || unitOfMeasurement.name || 'unit'
    } else if (typeof unitOfMeasurement === 'string') {
      unitId = unitOfMeasurement
      baseUnit = unitOfMeasurement
    }

    const containerCapacity = selectedProduct.containerCapacity || 1
    const pricePerUnit = selectedProduct.sellingPrice / containerCapacity
    
    // No membership discounts for "Sell in Parts" items
    const discountAmount = 0
    const totalPrice = pricePerUnit * quantity

    const newItem: TransactionItem = {
      id: `item_${Date.now()}`,
      productId: selectedProduct._id,
      product: selectedProduct,
      name: selectedProduct.name,
      description: selectedProduct.description,
      quantity: quantity,
      unitPrice: pricePerUnit,
      totalPrice: totalPrice,
      discountAmount: discountAmount,
      isService: false,
      saleType: 'volume', // Always use volume for partial sales
      unitOfMeasurementId: unitId,
      baseUnit: baseUnit,
      convertedQuantity: quantity, // For volume sales, convertedQuantity equals quantity
      sku: selectedProduct.sku
    }

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
    setSelectedProduct(null)
    setIsPartialMode(false)
  }

  const handleBlendSelection = (blendItem: TransactionItem) => {
    console.log('🔍 handleBlendSelection - blendItem:', blendItem)
    console.log('🔍 handleBlendSelection - blendItem.customBlendData:', blendItem.customBlendData)
    // This function is only for adding new blends
    // handleUpdateCustomBlend handles editing
    // Member discounts apply to fixed blends but not custom blends
    
    // Apply member discount if this is a fixed blend
    const finalBlendItem = blendItem.itemType === 'fixed_blend' 
      ? applyMemberDiscount(blendItem) 
      : blendItem;
    
    console.log('🔍 handleBlendSelection - finalBlendItem.customBlendData:', finalBlendItem.customBlendData)
    
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
    console.log('[Discount] Checking item:', item.name, {
      itemType: item.itemType,
      saleType: item.saleType,
      isService: item.isService,
      patientDiscount: selectedPatient?.memberBenefits?.discountPercentage
    });

    // Apply discounts to regular products and fixed blends - exclude custom blends, bundles, etc.
    if (!selectedPatient?.memberBenefits?.discountPercentage ||
        item.isService ||
        item.saleType === 'volume' ||
        (item.itemType !== 'product' && item.itemType !== 'fixed_blend')) {  // Include fixed blends
      console.log('[Discount] Item not eligible:', {
        reason: !selectedPatient?.memberBenefits?.discountPercentage ? 'No patient discount' :
                item.isService ? 'Is a service' :
                item.saleType === 'volume' ? 'Sell in parts (volume)' :
                'Not product or fixed blend'
      });
      return item
    }

    // For regular products, use the existing product
    // For fixed blends, create a synthetic product object for discount calculation
    let productForDiscount = item.product;
    
    if (item.itemType === 'fixed_blend' && !item.product) {
      // Create synthetic product for fixed blend discount calculation
      productForDiscount = {
        _id: item.productId || '',
        discountFlags: {
          discountableForMembers: true, // Fixed blends are eligible for member discounts
          discountableForAll: false,
          discountableInBlends: false
        }
      } as Partial<Product> as Product;
    }

    // Skip if we still don't have a product reference (for regular products)
    // Reset any existing discount if product is unavailable
    if (!productForDiscount) {
      console.log('[Discount] Product not available for:', item.name, '- resetting discount');
      return {
        ...item,
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
        totalPrice: discountCalc.discountCalculation.finalPrice
      }
    }

    // Item is eligible but no discount calculated (e.g., product not discountable)
    // Reset any existing discount
    console.log('[Discount] Item eligible but no discount calculated for:', item.name, '- resetting discount');
    return {
      ...item,
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

        // Skip recalculation for non-eligible items for membership discounts
        // Also skip "Sell in Parts" items (saleType: 'volume') - membership discounts apply to products and fixed blends
        if (item.isService || item.saleType === 'volume' ||
            (item.itemType !== 'product' && item.itemType !== 'fixed_blend')) {
          return item;
        }

        // Get the product for discount calculation
        let product = item.product;
        if (item.itemType === 'product') {
          product = products.find(p => p._id === item.productId) || item.product;
        } else if (item.itemType === 'fixed_blend' && !product) {
          product = {
            _id: item.productId || '',
            discountFlags: { discountableForMembers: true, discountableForAll: false, discountableInBlends: false }
          } as Partial<Product> as Product;
        }

        // Create customer object compatible with DiscountService
        const customerForDiscount = patient.memberBenefits?.discountPercentage ? {
          _id: patient.id,
          discountRate: patient.memberBenefits.discountPercentage
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
              totalPrice: discountResult.discountCalculation.finalPrice
            };
          }
        }

        // If no discount applicable, reset any existing discounts
        console.log('[Discount] Resetting discount for:', item.name);
        return {
          ...item,
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
          description: `${patient.memberBenefits.discountPercentage}% ${patient.memberBenefits.membershipTier?.toUpperCase()} discount applied to ${discountedCount} eligible item(s)`,
        });
      }
    }

    setSelectedPatient(patient)
    
    // Check if customer has purchase history
    try {
      const response = await fetch(`/api/customers/${patient.id}/purchase-history?limit=1`)
      if (response.ok) {
        const data = await response.json()
        setHasPurchaseHistory(data.patterns && data.patterns.length > 0)
      } else {
        setHasPurchaseHistory(false)
      }
    } catch {
      setHasPurchaseHistory(false)
    }
  }

  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId)
      return
    }

    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          // Recalculate discount and price for products and fixed blends (not services/bundles/custom blends)
          if (!item.isService && selectedPatient?.memberBenefits?.discountPercentage && 
              (item.itemType === 'product' || item.itemType === 'fixed_blend')) {
            
            // Get or create product for discount calculation
            let productForDiscount = item.product;
            if (item.itemType === 'fixed_blend' && !productForDiscount) {
              productForDiscount = {
                _id: item.productId || '',
                discountFlags: { discountableForMembers: true, discountableForAll: false, discountableInBlends: false }
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
              convertedQuantity: item.saleType === 'quantity' 
                ? newQuantity * (item.product?.containerCapacity || 1)
                : newQuantity
            }
            }
          } else {
            // For services, bundles, custom blends, or when no patient selected - no discount recalculation
            return {
              ...item,
              quantity: newQuantity,
              totalPrice: item.unitPrice * newQuantity,
              convertedQuantity: item.saleType === 'quantity' 
                ? newQuantity * (item.product?.containerCapacity || 1)
                : newQuantity
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
    console.log('🔍 handleUpdateCustomBlend - updatedBlend:', updatedBlend)
    console.log('🔍 handleUpdateCustomBlend - updatedBlend.customBlendData:', updatedBlend.customBlendData)
    // NO member discounts for custom blends
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === updatedBlend.id ? updatedBlend : item
      )
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

  const handleAddReorderItems = (items: Array<{
    productId: string;
    name: string;
    quantity?: number;
    itemType: string;
  }>) => {
    const newItems: TransactionItem[] = items.map(item => ({
      id: `item_${Date.now()}_${Math.random()}`,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity || 1,
      unitPrice: 0, // Will be populated by product selector
      totalPrice: 0,
      discountAmount: 0,
      isService: false,
      itemType: (item.itemType || 'product') as 'product' | 'fixed_blend' | 'custom_blend' | 'bundle',
      saleType: 'quantity' as const,
      unitOfMeasurementId: '',
      baseUnit: '',
      convertedQuantity: 0
    }))
    
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, ...newItems]
    }))
  }

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

    // Prevent duplicate submissions
    if (loading) {
      return
    }

    if (!formData.customerName.trim()) {
      alert('Please enter customer name')
      return
    }

    if (formData.items.length === 0) {
      alert('Please add at least one item')
      return
    }

    // Check if this is a draft being completed (has initialData and status is draft)
    // If payment status is pending, automatically update to paid
    const submitData = { ...formData }
    if (initialData?.status === 'draft' && formData.paymentStatus === 'pending') {
      submitData.paymentStatus = 'paid'
      // Also update the paid amount to match total amount
      submitData.paidAmount = submitData.totalAmount
      submitData.changeAmount = 0
    }

    console.log('🔍 handleSubmit - submitData:', submitData)
    console.log('🔍 handleSubmit - items with customBlendData:', 
      submitData.items.filter(item => item.itemType === 'custom_blend').map(item => ({
        name: item.name,
        customBlendData: item.customBlendData
      }))
    )
    await onSubmit(submitData)
  }

  const toggleDiscountMode = () => {
    const newMode = discountMode === 'amount' ? 'percentage' : 'amount'
    setDiscountMode(newMode)
    
    // Convert current value to new mode
    if (discountValue) {
      const numValue = Number.parseFloat(discountValue) || 0
      // Calculate total membership discounts for conversion
      const memberDiscountTotal = formData.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0)
      const afterMembershipTotal = formData.subtotal - memberDiscountTotal
      
      // Convert between discount modes manually
      if (discountMode === 'percentage') {
        // Converting from percentage to amount
        const convertedAmount = afterMembershipTotal * numValue / 100
        setDiscountValue(convertedAmount.toString())
      } else {
        // Converting from amount to percentage
        const convertedPercentage = afterMembershipTotal > 0 ? (numValue / afterMembershipTotal * 100) : 0
        setDiscountValue(convertedPercentage.toString())
      }
    }
  }

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return

    if (formData.items.length === 0) {
      alert('Please add at least one item to save as draft')
      return
    }

    const draftData = {
      ...formData,
      isDraft: true,
      status: 'draft' as const
    }

    await onSaveDraft(draftData)
    
    // Show immediate feedback to the user
    toast({
      title: initialData ? "Draft Updated" : "Draft Saved",
      description: initialData 
        ? "Your changes have been saved to the draft. Refresh the page to see latest updates." 
        : "Transaction saved as draft successfully. Refresh the page to see latest updates.",
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Customer Information</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPatientSelector(true)}
            >
              <FaUserPlus className="w-4 h-4 mr-2" />
              Select Patient
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-800">
                    <span className="font-medium">Member Discount: {selectedPatient.memberBenefits.discountPercentage}%</span>
                    <span className="text-xs ml-2">(Applied automatically to eligible items)</span>
                  </p>
                </div>
                {selectedPatient.memberBenefits && selectedPatient.memberBenefits.membershipTier && (
                  <Badge className="bg-purple-100 text-purple-800 text-xs">
                    {selectedPatient.memberBenefits.membershipTier.toUpperCase()}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reorder Suggestions */}
      {selectedPatient && hasPurchaseHistory && (
        <ReorderSuggestions
          customerId={selectedPatient.id}
          onAddItems={handleAddReorderItems}
        />
      )}

      {/* Cart Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cart Items</CardTitle>
            <Button 
              type="button" 
              onClick={() => {
                setShowTypeSelector(true)
              }}
              size="sm"
            >
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {formData.items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FaShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Your cart is empty</p>
              <p className="text-sm mt-1">Click &quot;Add Item&quot; to start</p>
            </div>
          ) : (
            <div className="space-y-3">
              {formData.items.map((item) => (
                <div key={item.id} className={`flex items-center gap-4 p-4 border rounded-lg ${(item.discountAmount || 0) > 0 ? 'bg-green-50 border-green-200' : ''}`}>
                  <div className="flex-1">
                    <h4 className="font-medium">
                      {item.name}
                      {item.saleType === 'volume' && (
                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Sold in Parts
                        </span>
                      )}
                    </h4>
                    {item.sku && (
                      <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                    )}
                    {item.description && (
                      <p className="text-sm text-gray-600">{item.description}</p>
                    )}
                  </div>
                  {!isConsultationItem(item) && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateItemQuantity(item.id!, item.quantity - 1)}
                      >
                        -
                      </Button>
                      <span className="w-16 text-center text-sm">
                        {item.saleType === 'volume' && item.baseUnit
                          ? `${item.quantity} ${item.baseUnit}`
                          : item.saleType === 'quantity'
                          ? (item.quantity === 1 ? '1 unit' : `${item.quantity} units`)
                          : item.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateItemQuantity(item.id!, item.quantity + 1)}
                      >
                        +
                      </Button>
                    </div>
                  )}
                  {isConsultationItem(item) && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Qty: {item.quantity}</span>
                    </div>
                  )}
                  <div className="text-right">
                    {(item.discountAmount || 0) > 0 ? (
                      <div>
                        <p className="text-sm text-gray-500 line-through">
                          Original: {formatCurrency(item.unitPrice * item.quantity)}
                        </p>
                        <div className="flex flex-col items-end gap-1 my-1">
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-medium">
                            {selectedPatient?.memberBenefits?.discountPercentage}% MEMBER DISCOUNT
                          </span>
                          <span className="text-xs text-green-700">
                            Save {formatCurrency(item.discountAmount || 0)}
                          </span>
                        </div>
                        <p className="font-medium text-green-700 text-lg">{formatCurrency(item.totalPrice)}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">{formatCurrency(item.totalPrice)}</p>
                        {/* Only show eligibility messages if patient has discount AND item has NO discount applied */}
                        {selectedPatient?.memberBenefits?.discountPercentage && (item.discountAmount || 0) === 0 && (
                          <>
                            {/* Message for potentially eligible items (product or fixed_blend) */}
                            {(item.itemType === 'product' || item.itemType === 'fixed_blend') &&
                             !item.isService && item.saleType !== 'volume' && (
                              <p className="text-xs text-gray-500 mt-1">
                                {item.product?.discountFlags?.discountableForMembers === false
                                  ? 'Product not eligible for discount'
                                  : 'No discount applied'}
                              </p>
                            )}
                            {/* Message for definitely ineligible items */}
                            {(item.isService || item.saleType === 'volume' ||
                              (item.itemType !== 'product' && item.itemType !== 'fixed_blend')) && (
                              <p className="text-xs text-amber-600 mt-1">
                                {item.saleType === 'volume' ? 'Parts not eligible for discount' :
                                 item.itemType === 'bundle' ? 'Bundles have separate pricing' :
                                 item.itemType === 'custom_blend' ? 'Custom blends not eligible' :
                                 item.isService ? 'Services not eligible' :
                                 'Not eligible for member discount'}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {isConsultationItem(item) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => handleEditConsultation(item)}
                      >
                        <FaEdit className="h-4 w-4" />
                      </Button>
                    )}
                    {item.itemType === 'custom_blend' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => handleEditCustomBlend(item)}
                        title="Edit custom blend formula"
                      >
                        <FaEdit className="h-4 w-4" />
                      </Button>
                    )}
                    {item.itemType === 'fixed_blend' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => handleEditFixedBlend(item)}
                        title="Edit fixed blend"
                      >
                        <FaEdit className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-800"
                      onClick={() => removeItem(item.id!)}
                    >
                      <FaTrash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Details */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
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
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Note:</span> Payment status will automatically be updated to &quot;Paid&quot; when you complete this transaction.
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discountAmount" className="flex items-center justify-between">
                  <span>Discount</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={toggleDiscountMode}
                    className="h-7 px-3 text-xs font-normal"
                    title={`Click to enter discount as ${discountMode === 'amount' ? 'percentage' : 'amount'}`}
                  >
                    {discountMode === 'amount' ? 'Switch to %' : 'Switch to SGD'}
                  </Button>
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
                          const memberDiscountTotal = formData.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0)
                          const afterMembershipTotal = formData.subtotal - memberDiscountTotal
                          return afterMembershipTotal > 0 ? `= ${(formData.discountAmount / afterMembershipTotal * 100).toFixed(1)}%` : ''
                        })()
                    }
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-2 border-t pt-4">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(formData.subtotal)}</span>
            </div>
            {formData.items.some(item => (item.discountAmount || 0) > 0) && (
              <div className="flex justify-between text-green-600">
                <span>Item Discounts:</span>
                <span>-{formatCurrency(formData.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0))}</span>
              </div>
            )}
            {formData.discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Additional Discount:</span>
                <span>-{formatCurrency(formData.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>{formatCurrency(formData.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        {onSaveDraft && (
          <Button 
            type="button" 
            variant="secondary" 
            onClick={handleSaveDraft} 
            disabled={loading || formData.items.length === 0}
          >
            {loading ? (
              <>
                <ImSpinner8 className="w-4 h-4 mr-2 animate-spin" />
                {initialData ? "Updating Draft..." : "Saving Draft..."}
              </>
            ) : (
              initialData ? "Update Draft" : "Save as Draft"
            )}
          </Button>
        )}
        <Button type="submit" disabled={loading || formData.items.length === 0}>
          {loading ? (
            <>
              <ImSpinner8 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            "Complete Transaction"
          )}
        </Button>
      </div>

      {/* Modals */}
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
        onClose={() => setShowQuantityInput(false)}
        onConfirm={handleQuantityConfirm}
        product={selectedProduct}
      />

      <PartialQuantitySelector
        open={showPartialQuantitySelector}
        onClose={() => setShowPartialQuantitySelector(false)}
        onConfirm={handlePartialQuantityConfirm}
        product={selectedProduct}
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