"use client"

import type React from "react"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { IoClose } from "react-icons/io5"
import { FaShoppingCart, FaUsers, FaCreditCard, FaSearch, FaBox, FaFlask, FaClock } from "react-icons/fa"
import { MdRefresh, MdTrendingUp } from "react-icons/md"
import { ImSpinner8 } from "react-icons/im"
import { HiOutlinePencilSquare } from "react-icons/hi2"
import type { TransactionFormData, TransactionItem, Customer, Address, Transaction } from "@/types/transaction"
import { formatCurrency } from "@/utils/currency"
import type { Product } from "@/types/inventory"
import type { Patient } from "@/types/patient"
import type { ContainerType } from "@/types/container"
import { usePatients } from "@/hooks/usePatients"
import { useUnits } from "@/hooks/useUnits"
import { useUsers } from "@/hooks/useUsers"
import { debounce } from "@/utils/debounce"
import { DiscountService } from "@/services/DiscountService"


import { QuantitySelectorModal } from "./quantity-selector-modal"
import { BlendTypeSelector } from "./BlendTypeSelector"
import { FixedBlendSelector } from "./FixedBlendSelector"
import { CustomBlendCreator } from "./CustomBlendCreator"
import { BundleSelector } from "./BundleSelector"
import QuickBlendCreator from "@/components/blends/QuickBlendCreator"
import BlendWizard from "@/components/blends/BlendWizard"
import PrescriptionSelector from "./PrescriptionSelector"
import { MiscellaneousSelector } from "./MiscellaneousSelector"


interface TransactionFormProps {
  products: Product[]
  onSubmit: (data: TransactionFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
  initialData?: Transaction
  onRefreshProducts?: () => Promise<void>
}

export function TransactionForm({ products, onSubmit, onCancel, loading, initialData, onRefreshProducts: _onRefreshProducts }: TransactionFormProps) {
  const { patients, searchPatients, searchLoading, recentPatients, getRecentPatients } = usePatients()
  const { units, getUnits } = useUnits()
  const { ensureSuperAdminUser, checkDiscountPermission: _checkDiscountPermission } = useUsers()
  const [patientSearch, setPatientSearch] = useState("")
  const [_showPatientDropdown, _setShowPatientDropdown] = useState(false)

  // Transaction numbers are now generated server-side to avoid conflicts

  const [formData, setFormData] = useState<TransactionFormData>(() => {
    if (initialData) {
      return {
        ...initialData,
        // Ensure all customer fields have string defaults to prevent controlled/uncontrolled input warnings
        customerName: initialData.customerName || "",
        customerEmail: initialData.customerEmail || "",
        customerPhone: initialData.customerPhone || "",
        items: initialData.items.map(item => {
          // Handle both string IDs and object IDs
          const productId = typeof item.productId === 'object' && item.productId !== null 
            ? (item.productId as { _id: string })._id 
            : item.productId;
          const product = products.find(p => p._id === productId);
          
          if (!product) {
            // Product not found - may cause issues when updating the transaction
          }
          
          return {
            ...item,
            id: item.id || `item_${Date.now()}_${Math.random()}`,
            productId: productId, // Ensure we store the string ID
            product: product || undefined
          };
        })
      }
    }
    return {
      type: "DRAFT",
      status: "pending",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      items: [],
      subtotal: 0,
      discountAmount: 0,
      totalAmount: 0,
      currency: "SGD",
      paymentMethod: "cash",
      paymentStatus: "pending",
      paidAmount: 0,
      changeAmount: 0,
      transactionDate: new Date().toISOString(),
      invoiceGenerated: false,
      createdBy: "current_user",
      transactionNumber: '', // Will be generated server-side
    }
  })

  const [showProductDialog, setShowProductDialog] = useState(false)
  const [showCustomerDialog, setShowCustomerDialog] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [productSearch, setProductSearch] = useState("")
  const [showQuantitySelector, setShowQuantitySelector] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // Blend-related state
  const [showBlendTypeSelector, setShowBlendTypeSelector] = useState(false)
  const [showFixedBlendSelector, setShowFixedBlendSelector] = useState(false)
  const [showCustomBlendCreator, setShowCustomBlendCreator] = useState(false)
  const [showQuickBlendCreator, setShowQuickBlendCreator] = useState(false)
  const [showBlendWizard, setShowBlendWizard] = useState(false)
  const [blendCreationMode, setBlendCreationMode] = useState<'quick' | 'wizard' | 'legacy'>('quick')
  
  // Bundle-related state
  const [showBundleSelector, setShowBundleSelector] = useState(false)

  // NEW: Prescription and history reuse state
  const [showPrescriptionSelector, setShowPrescriptionSelector] = useState(false)
  const [_showPreviousTransactions, _setShowPreviousTransactions] = useState(false)
  const [_showUsageAnalytics, _setShowUsageAnalytics] = useState(false)

  // Miscellaneous item state
  const [showMiscellaneousSelector, setShowMiscellaneousSelector] = useState(false)

  // User selection state
  const [_showUserSelector, _setShowUserSelector] = useState(false)
  const [currentUser, setCurrentUser] = useState<Patient | null>(null)
  const [_discountError, _setDiscountError] = useState<string | null>(null)

  const initializeUser = useCallback(async () => {
    try {
      const superAdminUser = await ensureSuperAdminUser()
      setCurrentUser(superAdminUser as unknown as Patient)
    } catch {
      // Failed to initialize user - handled silently
    }
  }, [ensureSuperAdminUser])

  // Fetch recent patients and units when the form opens
  useEffect(() => {
    getRecentPatients()
    getUnits()
    
    // Initialize with a default user (create Super Admin if needed)
    initializeUser()
  }, [getRecentPatients, getUnits, initializeUser])

  // Debounced patient search
  const debouncedPatientSearch = useMemo(
    () => debounce(((searchTerm: unknown) => {
      if (typeof searchTerm === 'string' && searchTerm.length >= 2) {
        searchPatients(searchTerm)
      }
    }) as (...args: unknown[]) => unknown, 300),
    [searchPatients]
  )

  // Handle patient search input
  useEffect(() => {
    if (patientSearch) {
      debouncedPatientSearch(patientSearch)
      _setShowPatientDropdown(true)
    } else {
      _setShowPatientDropdown(false)
    }
  }, [patientSearch, debouncedPatientSearch])

  // Calculate totals whenever items change
  useEffect(() => {
    const subtotal = formData.items.reduce((sum, item) => {
      // Credits already have negative totalPrice, so just add normally
      return sum + item.totalPrice
    }, 0)
    const totalAmount = Math.max(0, subtotal - formData.discountAmount)

    setFormData((prev) => ({
      ...prev,
      subtotal,
      totalAmount,
    }))
  }, [formData.items, formData.discountAmount])

  const handleInputChange = (field: keyof TransactionFormData, value: TransactionFormData[keyof TransactionFormData]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    
    // Clear discount error when discount is changed
    if (field === 'discountAmount') {
      _setDiscountError(null)
    }
  }

  // Validate discount permissions
  const _validateDiscount = (discountAmount: number) => {
    if (!currentUser) {
      _setDiscountError('Please select a user account first')
      return false
    }

    const _discountPercent = formData.subtotal > 0 ? (discountAmount / formData.subtotal) * 100 : 0
    const permission = { allowed: true, reason: '' } // TODO: Fix discount permission check type mismatch
    // const permission = checkDiscountPermission(currentUser as Patient & { permissions?: { discounts?: { maxDiscountPercentage?: number; maxDiscountAmount?: number } } }, discountPercent, discountAmount)
    
    if (!permission.allowed) {
      _setDiscountError(permission.reason || 'Discount not allowed')
      return false
    }
    
    _setDiscountError(null)
    return true
  }

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    setShowProductDialog(false)
    setShowQuantitySelector(true)
  }


  // Handle quantity/pricing confirmation
  const handleQuantityConfirmation = (totalQuantity: number, totalPrice: number, selectedUnit: string, saleType?: string, containerTypeInfo?: { containerType: ContainerType; containerCapacity: number; containersNeeded?: number } | null) => {
    if (!selectedProduct) return

    const productUnitOfMeasurement = selectedProduct.unitOfMeasurement
    
    if (!productUnitOfMeasurement) {
      alert(`Product "${selectedProduct.name}" is missing unit of measurement. Please update the product first.`)
      return
    }

    // PHASE 1: Real-time cart validation to prevent overselling
    const existingCartQuantity = formData.items
      .filter(item => item.productId === selectedProduct._id)
      .reduce((sum, item) => {
        // For consistent validation, always compare substance amounts (convertedQuantity)
        return sum + item.convertedQuantity
      }, 0)

    const totalRequiredQuantity = existingCartQuantity + totalQuantity
    
    // For all sale types, compare against total available substance
    const containerCapacity = selectedProduct.containerCapacity || selectedProduct.quantity || 1
    const availableStock = selectedProduct.totalQuantity || (selectedProduct.currentStock * containerCapacity)

    if (totalRequiredQuantity > availableStock) {
      // Always show substance amounts in error messages for consistency
      const unitLabel = selectedProduct.unitOfMeasurement?.abbreviation || 'units'
      
      alert(
        `❌ Insufficient Stock!\n\n` +
        `Product: ${selectedProduct.name}\n` +
        `Available: ${availableStock.toFixed(2)} ${unitLabel}\n` +
        `Already in cart: ${existingCartQuantity.toFixed(2)} ${unitLabel}\n` +
        `Requesting: ${totalQuantity.toFixed(2)} ${unitLabel}\n` +
        `Total needed: ${totalRequiredQuantity.toFixed(2)} ${unitLabel}\n\n` +
        `Please reduce quantity or remove existing items from cart.`
      )
      return
    }

    // Handle different types of unitOfMeasurement
    let unitId: string
    let unitBaseUnit: string

    if (typeof productUnitOfMeasurement === 'object' && productUnitOfMeasurement !== null) {
      // If it's an object, use its _id or id and baseUnit/name
      unitId = productUnitOfMeasurement._id || productUnitOfMeasurement.id || ''
      unitBaseUnit = productUnitOfMeasurement.baseUnit || productUnitOfMeasurement.name || 'unit'
    } else if (typeof productUnitOfMeasurement === 'string') {
      // If it's a string, use it as the ID and default to 'unit' for baseUnit
      unitId = productUnitOfMeasurement
      unitBaseUnit = 'unit'
    } else {
      // Fallback case
      unitId = ''
      unitBaseUnit = 'unit'
    }

    if (!unitId) {
      alert(`Product "${selectedProduct.name}" has an invalid unit of measurement. Please update the product first.`)
      return
    }

    const selectedUnitObj = units.find(u => u._id === selectedUnit || u.name === selectedUnit);
    const finalUnitId = selectedUnitObj?._id || unitId;
    const finalBaseUnit = selectedUnitObj?.baseUnit || selectedUnitObj?.name || unitBaseUnit;

    const newItem: TransactionItem = {
      id: `item_${Date.now()}`,
      productId: selectedProduct._id,
      product: selectedProduct,
      name: selectedProduct.name,
      description: selectedProduct.description,
      quantity: totalQuantity,
      unitPrice: totalPrice / totalQuantity,
      totalPrice: totalPrice,
      discountAmount: 0,
      isService: false,
      saleType: (saleType || 'quantity') as 'quantity' | 'volume',
      unitOfMeasurementId: finalUnitId,
      baseUnit: finalBaseUnit,
      // Calculate convertedQuantity based on sale type for proper inventory tracking
      convertedQuantity: saleType === 'quantity'
        ? totalQuantity * (selectedProduct.containerCapacity || selectedProduct.quantity || 1) // Convert containers to substance amount
        : totalQuantity, // For volume sales, totalQuantity is already the substance amount
      sku: selectedProduct.sku,
      // Add container information for volume sales
      ...(saleType === 'volume' && containerTypeInfo && {
        selectedContainers: Array(containerTypeInfo.containersNeeded || Math.ceil(totalQuantity / containerTypeInfo.containerCapacity)).fill(null).map((_, index) => {
          const quantityToConsume = Math.min(
            containerTypeInfo.containerCapacity,
            totalQuantity - (index * containerTypeInfo.containerCapacity)
          );
          return {
            containerId: `volume_${Date.now()}_${index}`,
            containerCode: `${selectedProduct.sku}_VOLUME_${index + 1}`,
            quantityToConsume,
            batchNumber: undefined,
            expiryDate: undefined
          };
        }).filter(container => container.quantityToConsume > 0) // Filter out containers with 0 quantity
      })
    }

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }))

    setShowQuantitySelector(false)
    setSelectedProduct(null)
  }

  // Handle blend type selection
  const handleFixedBlendTypeSelection = () => {
    setShowBlendTypeSelector(false)
    setShowFixedBlendSelector(true)
  }

  const handleCustomBlendTypeSelection = () => {
    setShowBlendTypeSelector(false)
    if (blendCreationMode === 'quick') {
      setShowQuickBlendCreator(true)
    } else if (blendCreationMode === 'wizard') {
      setShowBlendWizard(true)
    } else {
      setShowCustomBlendCreator(true) // Legacy mode
    }
  }

  // Handle enhanced blend creation
  const handleQuickBlendSave = async (blendData: {
    name: string;
    description?: string;
    ingredients: Array<{
      productId: string;
      product: Product;
      quantity: number;
      unit: string;
      notes?: string;
    }>;
    totalPrice: number;
    containerType?: ContainerType;
    targetQuantity?: number;
  }) => {
    try {
      // Convert blend data to transaction item format
      const blendItem: TransactionItem = {
        id: `blend_${Date.now()}_${Math.random()}`,
        itemType: 'custom_blend',
        productId: '', // Not applicable for custom blends
        name: blendData.name,
        description: `Custom blend: ${blendData.ingredients.map((ing) => 
          `${ing.quantity} ${ing.unit} ${ing.product.name}`
        ).join(', ')}`,
        quantity: 1,
        unitPrice: blendData.totalPrice,
        totalPrice: blendData.totalPrice,
        unitOfMeasurementId: '',
        baseUnit: 'unit',
        convertedQuantity: 1,
        saleType: 'quantity' as const
        // TODO: Add blend-specific properties when TransactionItem interface supports them
      }

      setFormData(prev => ({
        ...prev,
        items: [...prev.items, blendItem]
      }))
      setShowQuickBlendCreator(false)
    } catch (error) {
      console.error('Error saving blend:', error)
      console.error('Failed to save blend')
    }
  }

  const handleWizardComplete = async (blendData: {
    name: string;
    description?: string;
    ingredients: Array<{
      productId: string;
      product: Product;
      quantity: number;
      unit: string;
    }>;
    totalPrice: number;
  }) => {
    try {
      await handleQuickBlendSave(blendData)
      setShowBlendWizard(false)
    } catch (error) {
      console.error('Error completing blend wizard:', error)
      console.error('Failed to complete blend wizard')
    }
  }

  // Handle fixed blend selection
  const handleFixedBlendSelection = (blendItem: TransactionItem) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, blendItem]
    }))
    setShowFixedBlendSelector(false)
  }

  // Handle custom blend creation
  const handleCustomBlendCreation = (blendItem: TransactionItem) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, blendItem]
    }))
    setShowCustomBlendCreator(false)
  }

  // Handle bundle selection
  const handleBundleSelection = (bundleItem: TransactionItem) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, bundleItem]
    }))
    setShowBundleSelector(false)
  }

  // Handle prescription selection
  const handlePrescriptionSelection = async (
    prescriptionId: string, 
    selectedRemedies?: string[], 
    modifications?: Record<string, {
      quantity: number;
      notes: string;
      reason: string;
    }>
  ) => {
    try {
      if (!selectedCustomer?.id) {
        throw new Error('No customer selected')
      }

      // Create transaction from prescription via API
      const response = await fetch('/api/transactions/create-from-prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          prescriptionId,
          selectedRemedies,
          modifications
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create transaction from prescription')
      }

      const transaction = await response.json()

      // Add the items to current form
      const prescriptionItems: TransactionItem[] = transaction.items.map((item: Partial<TransactionItem>) => ({
        ...item,
        id: `prescription_${Date.now()}_${Math.random()}`, // Ensure unique IDs
      } as TransactionItem))

      setFormData(prev => ({
        ...prev,
        items: [...prev.items, ...prescriptionItems]
      }))

      setShowPrescriptionSelector(false)
    } catch (error) {
      alert(`Failed to add prescription items: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Handle miscellaneous item selection
  const handleMiscellaneousSelection = (miscItem: TransactionItem) => {
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

  const _updateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId)
      return
    }

    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === itemId) {
          const totalPrice = item.unitPrice * quantity
          // Recalculate convertedQuantity based on sale type
          const convertedQuantity = item.saleType === 'quantity'
            ? quantity * (item.product?.containerCapacity || item.product?.quantity || 1) // Convert containers to substance amount
            : quantity // For volume sales, quantity is already the substance amount
          
          return {
            ...item,
            quantity,
            totalPrice,
            convertedQuantity,
          }
        }
        return item
      }),
    }))
  }

  const selectCustomer = (patient: Patient) => {
    const address: Address | undefined = patient.address ? {
      street: patient.address,
      city: patient.city || "",
      state: patient.state || "",
      postalCode: patient.postalCode || "",
    } : undefined

    const customer: Customer = {
      id: patient.id,
      name: `${patient.firstName} ${patient.lastName}`,
      email: patient.email,
      phone: patient.phone,
      address,
      customerType: 'individual',
      totalPurchases: 0,
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt
    }
    
    setSelectedCustomer(customer)
    
    // Recalculate prices and discounts for all existing items when patient changes
    setFormData((prev) => {
      const updatedItems = prev.items.map((item) => {
        // Skip recalculation for non-product items (blends, bundles, misc)
        // Skip recalculation for non-product items and "Sell in Parts" items
        // Membership discounts only apply to "Sell Product" items (saleType: 'quantity')
        if (!item.product || (item.itemType && item.itemType !== 'product') || item.saleType === 'volume') {
          return item;
        }

        // Get the product for discount calculation
        const product = products.find(p => p._id === item.productId) || item.product;
        
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
            return {
              ...item,
              discountAmount: discountResult.discountCalculation.discountAmount,
              totalPrice: discountResult.discountCalculation.finalPrice
            };
          }
        }

        // If no discount applicable, reset any existing discounts
        return {
          ...item,
          discountAmount: 0,
          totalPrice: item.quantity * item.unitPrice
        };
      });

      return {
        ...prev,
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email || "",
        customerPhone: customer.phone || "",
        customerAddress: customer.address,
        items: updatedItems
      };
    });

    setShowCustomerDialog(false)
    setPatientSearch("") // Clear search when patient is selected
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.customerName || !formData.customerName.trim()) {
      alert('Customer name is required')
      return
    }
    
    if (formData.items.length === 0) {
      alert('At least one item is required')
      return
    }
    
    // Transaction number will be generated server-side
    const newTransactionNumber = '' // Will be generated server-side

    // Clean the transaction data to match the schema
    const transactionData: TransactionFormData = {
      ...formData,
      transactionNumber: newTransactionNumber,
      transactionDate: new Date().toISOString(),
      createdBy: "current_user", // This should be replaced with actual user ID
      items: formData.items.map(item => {
        // For custom blends, skip product lookup as they don't exist in the products array
        if (item.itemType === 'custom_blend') {
          // Custom blends are handled differently - they don't need product references
          const { ...cleanItem } = item;
          return {
            ...cleanItem,
            discountAmount: cleanItem.discountAmount || 0,
            isService: false,
            unitOfMeasurementId: cleanItem.unitOfMeasurementId,
            baseUnit: cleanItem.baseUnit || 'unit',
            convertedQuantity: cleanItem.convertedQuantity || cleanItem.quantity,
          };
        }

        // For fixed blends, skip product lookup as they reference blend templates, not products
        if (item.itemType === 'fixed_blend') {
          // Fixed blends are handled differently - they don't need product references
          const { ...cleanItem } = item;
          return {
            ...cleanItem,
            discountAmount: cleanItem.discountAmount || 0,
            isService: false,
            unitOfMeasurementId: cleanItem.unitOfMeasurementId,
            baseUnit: cleanItem.baseUnit || 'unit',
            convertedQuantity: cleanItem.convertedQuantity || cleanItem.quantity,
          };
        }

        // For bundles, skip product lookup as they reference bundle collections, not individual products
        if (item.itemType === 'bundle') {
                     // Processing bundle item for transaction
          // Bundles are handled differently - they don't need individual product references
          const { ...cleanItem } = item;
          return {
            ...cleanItem,
            discountAmount: cleanItem.discountAmount || 0,
            isService: false,
            unitOfMeasurementId: cleanItem.unitOfMeasurementId,
            baseUnit: cleanItem.baseUnit || 'unit',
            convertedQuantity: cleanItem.convertedQuantity || cleanItem.quantity,
          };
        }

        // For miscellaneous items, skip product lookup as they don't exist in the products array
        if (item.itemType === 'miscellaneous') {
          // Miscellaneous items are handled differently - they don't need product references
          const { ...cleanItem } = item;
          return {
            ...cleanItem,
            discountAmount: cleanItem.discountAmount || 0,
            isService: cleanItem.isService || false,
            unitOfMeasurementId: cleanItem.unitOfMeasurementId,
            baseUnit: cleanItem.baseUnit || 'unit',
            convertedQuantity: cleanItem.convertedQuantity || cleanItem.quantity,
          };
        }

        // For regular products, we need to have the product reference
        if (!item.product) {
          // Handle both string IDs and object IDs
          const productId = typeof item.productId === 'object' && item.productId !== null 
            ? (item.productId as { _id: string })._id 
            : item.productId;
          // Instead of throwing an error, we'll try to find the product again
          const product = products.find(p => p._id === productId);
          if (!product) {
            throw new Error(`Product with ID ${productId} not found. Please ensure all products are available.`);
          }
          // Add the product reference
          item.product = product;
          item.productId = productId; // Ensure we store the string ID
        }

        // Remove UI-only fields and create clean item
        const { ...cleanItem } = item;
        
        // Validate that required fields are present
        if (!cleanItem.unitOfMeasurementId) {
          throw new Error(`Item "${cleanItem.name}" is missing unit of measurement`);
        }
        
        return {
          ...cleanItem,
          // Ensure required fields have proper values
          discountAmount: cleanItem.discountAmount || 0,
          isService: false,
          unitOfMeasurementId: cleanItem.unitOfMeasurementId,
          baseUnit: cleanItem.baseUnit || 'unit',
          convertedQuantity: cleanItem.convertedQuantity || cleanItem.quantity,
        };
      })
    }

    await onSubmit(transactionData)
  }

  const filteredProducts = products.filter(
    (product) =>
      // Type guard to ensure we only show actual inventory products
      product._id && 
      product._id !== 'consultation-fee' &&
      product.sku &&
      product.currentStock !== undefined &&
      !('isService' in product && product.isService) &&
      (product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
       product.sku.toLowerCase().includes(productSearch.toLowerCase())),
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FaUsers className="w-5 h-5" />
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Name</Label>
              <div className="flex gap-2">
                <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" className="shrink-0">
                      <FaSearch className="w-4 h-4 mr-2" />
                      Select
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Select Patient</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder="Search patients by name, ID, email, or phone..."
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <div className="max-h-[60vh] overflow-y-auto">
                        {/* Show helper text when no search */}
                        {!patientSearch && (
                          <div className="text-center py-8 text-gray-500">
                            <p className="mb-4">Type at least 2 characters to search patients</p>
                            {recentPatients.length > 0 && (
                              <>
                                <p className="text-sm font-medium mb-2">Recent Patients:</p>
                                <div className="space-y-2">
                                  {recentPatients.map((patient) => (
                                    <div
                                      key={patient.id}
                                      className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors text-left"
                                      onClick={() => selectCustomer(patient)}
                                    >
                                      <div className="font-medium">
                                        {patient.firstName} {patient.lastName}
                                      </div>
                                      <div className="text-sm text-gray-600">ID: {patient.id}</div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        
                        {/* Show loading state */}
                        {patientSearch && searchLoading && (
                          <div className="flex items-center justify-center py-8">
                            <ImSpinner8 className="animate-spin w-6 h-6 text-blue-500" />
                            <span className="ml-2 text-gray-600">Searching patients...</span>
                          </div>
                        )}
                        
                        {/* Show message for short search term */}
                        {patientSearch && patientSearch.length < 2 && !searchLoading && (
                          <div className="text-center py-8 text-gray-500">
                            <p>Please type at least 2 characters to search</p>
                          </div>
                        )}
                        
                        {/* Show search results */}
                        {patientSearch && patientSearch.length >= 2 && !searchLoading && (
                          <>
                            {patients.length === 0 ? (
                              <div className="text-center py-8 text-gray-500">
                                <p>No patients found matching &ldquo;{patientSearch}&rdquo;</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {patients.map((patient) => (
                                  <div
                                    key={patient.id}
                                    className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => selectCustomer(patient)}
                                  >
                                    <div className="font-medium">
                                      {patient.firstName} {patient.lastName}
                                    </div>
                                    <div className="text-sm text-gray-600">ID: {patient.id}</div>
                                    {patient.email && (
                                      <div className="text-sm text-gray-600">Email: {patient.email}</div>
                                    )}
                                    {patient.phone && (
                                      <div className="text-sm text-gray-600">Phone: {patient.phone}</div>
                                    )}
                                  </div>
                                ))}
                                {patients.length === 50 && (
                                  <p className="text-sm text-gray-500 text-center py-2">
                                    Showing first 50 results. Type more to narrow your search.
                                  </p>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange("customerName", e.target.value)}
                  placeholder="Enter customer name"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerEmail">Email</Label>
              <Input
                id="customerEmail"
                type="email"
                value={formData.customerEmail}
                onChange={(e) => handleInputChange("customerEmail", e.target.value)}
                placeholder="Enter email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerPhone">Phone</Label>
              <Input
                id="customerPhone"
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => handleInputChange("customerPhone", e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
          </div>

          {selectedCustomer && (
            <div className="mt-4">
              <Badge variant="outline" className="flex items-center gap-1">
                {selectedCustomer.name}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null)
                    setFormData((prev) => ({
                      ...prev,
                      customerId: undefined,
                      customerName: "",
                      customerEmail: "",
                      customerPhone: "",
                      customerAddress: undefined,
                    }))
                  }}
                  className="ml-1 hover:text-red-600"
                >
                  <IoClose className="w-3 h-3" />
                </button>
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FaShoppingCart className="w-5 h-5" />
            Transaction Items
          </CardTitle>
          <CardDescription>Add products to this transaction</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline">
                  <FaBox className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle>Select Product</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search products..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
                    {filteredProducts.map((product) => (
                      <div
                        key={product._id}
                        className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => handleProductSelect(product)}
                      >
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-gray-600">{product.description}</div>
                        <div className="text-sm text-gray-600">SKU: {product.sku}</div>
                        <div className="text-sm text-gray-600">
                          Stock: {product.currentStock} {
                            product.containerType && typeof product.containerType === 'object' 
                              ? product.containerType.name
                              : product.containerType || 'units'
                          }
                        </div>
                        <div className="font-medium text-green-600">{formatCurrency(product.sellingPrice)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <div className="flex items-center gap-2">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setShowBlendTypeSelector(true)}
              >
                <FaFlask className="w-4 h-4 mr-2" />
                Add Blend
              </Button>
              
              <Select value={blendCreationMode} onValueChange={(value: 'quick' | 'wizard' | 'legacy') => setBlendCreationMode(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick">Quick</SelectItem>
                  <SelectItem value="wizard">Wizard</SelectItem>
                  <SelectItem value="legacy">Legacy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setShowBundleSelector(true)}
            >
              <FaBox className="w-4 h-4 mr-2" />
              Add Bundle
            </Button>
            
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setShowMiscellaneousSelector(true)}
            >
              <HiOutlinePencilSquare className="w-4 h-4 mr-2" />
              Add Miscellaneous
            </Button>
          </div>

          {/* NEW: Prescription and History Reuse Section */}
          {selectedCustomer && (
            <div className="flex items-center gap-2 border-l pl-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setShowPrescriptionSelector(true)}
                className="text-purple-600 border-purple-300 hover:bg-purple-50"
              >
                <FaClock className="w-4 h-4 mr-2" />
                Copy from Prescription
              </Button>
              
              <Button 
                type="button" 
                variant="outline"
                onClick={() => _setShowPreviousTransactions(true)}
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
              >
                <MdRefresh className="w-4 h-4 mr-2" />
                Previous Orders
              </Button>
              
              <Button 
                type="button" 
                variant="outline"
                onClick={() => _setShowUsageAnalytics(true)}
                className="text-green-600 border-green-300 hover:bg-green-50"
              >
                <MdTrendingUp className="w-4 h-4 mr-2" />
                Usage History
              </Button>
            </div>
          )}

          {formData.items.length > 0 && (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Sale Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Volume/Weight</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.items.map((item) => {
                    const product = products.find((p) => p._id === item.productId)
                    const unitAbbr = product?.unitOfMeasurement?.abbreviation || 'units'
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.name}
                          {item.brand && <Badge variant="outline" className="ml-2">{item.brand}</Badge>}
                          {item.itemType === 'miscellaneous' && item.miscellaneousCategory && (
                            <Badge
                              variant={item.miscellaneousCategory === 'credit' ? 'destructive' : 'outline'}
                              className="ml-2"
                            >
                              {item.miscellaneousCategory === 'credit' ? 'CREDIT' : item.miscellaneousCategory}
                            </Badge>
                          )}
                          {item.sku && <div className="text-sm text-gray-500">{item.sku}</div>}
                        </TableCell>
                        <TableCell>
                          {item.saleType === 'volume' ? 'Volume/Weight' : 'Individual Units'}
                        </TableCell>
                        <TableCell>
                          {item.saleType === 'volume' ? '-' : `${item.quantity} units`}
                        </TableCell>
                        <TableCell>
                          {item.saleType === 'volume' ? 
                           `${item.quantity} ${unitAbbr}` : 
                           '-'} {/* Only show volume for volume sales */}
                        </TableCell>
                        <TableCell className={item.itemType === 'miscellaneous' && item.miscellaneousCategory === 'credit' ? 'text-red-600' : ''}>
                          {formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell className={item.itemType === 'miscellaneous' && item.miscellaneousCategory === 'credit' ? 'text-red-600' : ''}>
                          {formatCurrency(item.totalPrice)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => item.id && removeItem(item.id)}
                          >
                            <IoClose className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FaCreditCard className="w-5 h-5" />
            Payment Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(value) => handleInputChange("paymentMethod", value)}
              >
                <SelectTrigger id="paymentMethod">
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
                value={formData.paymentStatus}
                onValueChange={(value) => handleInputChange("paymentStatus", value)}
              >
                <SelectTrigger id="paymentStatus">
                  <SelectValue placeholder="Select payment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paidAmount">Amount Paid</Label>
              <Input
                id="paidAmount"
                type="number"
                value={formData.paidAmount}
                onChange={(e) => handleInputChange("paidAmount", Number(e.target.value))}
                placeholder="Enter amount paid"
                min="0"
                step="0.01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountAmount">Discount Amount</Label>
              <Input
                id="discountAmount"
                type="number"
                value={formData.discountAmount}
                onChange={(e) => handleInputChange("discountAmount", Number(e.target.value))}
                placeholder="Enter discount amount"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Subtotal</Label>
              <div className="text-2xl font-bold">{formatCurrency(formData.subtotal)}</div>
            </div>

            <div className="space-y-2">
              <Label>Total Amount</Label>
              <div className="text-2xl font-bold">{formatCurrency(formData.totalAmount)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quantity Selector Modal */}
      {selectedProduct && (
        <QuantitySelectorModal
          product={selectedProduct}
          isOpen={showQuantitySelector}
          onClose={() => {
            setShowQuantitySelector(false)
            setSelectedProduct(null)
          }}
          onConfirm={handleQuantityConfirmation}
          unitPrice={selectedProduct.sellingPrice}
          unitOfMeasurements={units}
        />
      )}

      {/* Blend Type Selector */}
      <BlendTypeSelector
        open={showBlendTypeSelector}
        onClose={() => setShowBlendTypeSelector(false)}
        onSelectFixedBlend={handleFixedBlendTypeSelection}
        onSelectCustomBlend={handleCustomBlendTypeSelection}
      />

      {/* Fixed Blend Selector */}
      <FixedBlendSelector
        open={showFixedBlendSelector}
        onClose={() => setShowFixedBlendSelector(false)}
        onSelectBlend={handleFixedBlendSelection}
        loading={loading}
      />

      {/* Custom Blend Creator */}
      <CustomBlendCreator
        open={showCustomBlendCreator}
        onClose={() => setShowCustomBlendCreator(false)}
        onCreateBlend={handleCustomBlendCreation}
        products={products}
        unitOfMeasurements={units}
        loading={loading}
      />

      {/* Quick Blend Creator */}
      <Dialog open={showQuickBlendCreator} onOpenChange={setShowQuickBlendCreator}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Blend Creator</DialogTitle>
          </DialogHeader>
          <QuickBlendCreator
            products={products.map(p => ({
              _id: p._id,
              name: p.name,
              unitName: p.unitOfMeasurement?.name || p.unitOfMeasurement?.abbreviation || '',
              currentStock: p.currentStock,
              totalQuantity: p.totalQuantity || p.currentStock || 0,
              sellingPrice: p.sellingPrice,
              costPrice: p.costPrice,
              containerCapacity: undefined,
              containerType: p.containerType?.name,
              discountFlags: { discountableInBlends: true }
            }))}
            onSave={(blend) => handleQuickBlendSave({
              name: blend.blendName,
              totalPrice: blend.totalCost,
              ingredients: blend.ingredients.map((ing) => ({
                productId: ing.productId,
                product: { name: ing.name } as Product,
                quantity: ing.quantity,
                unit: ing.unitName
              }))
            })}
            onCancel={() => setShowQuickBlendCreator(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Blend Wizard */}
      <Dialog open={showBlendWizard} onOpenChange={setShowBlendWizard}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Blend Creation Wizard</DialogTitle>
          </DialogHeader>
          <BlendWizard
            products={products.map(p => ({
              _id: p._id,
              name: p.name,
              unitName: p.unitOfMeasurement?.name || p.unitOfMeasurement?.abbreviation || '',
              currentStock: p.currentStock,
              totalQuantity: p.totalQuantity || p.currentStock || 0,
              sellingPrice: p.sellingPrice,
              costPrice: p.costPrice,
              containerCapacity: undefined,
              containerType: p.containerType?.name,
              discountFlags: { discountableInBlends: true }
            }))}
            onComplete={async (blend: { blendName: string; targetSize: number; targetUnit: string; ingredients: unknown[]; [key: string]: unknown }) => {
              const ingredients = Array.isArray(blend.ingredients) ? blend.ingredients.map((ing: unknown) => {
                const ingredient = ing as { productId: string; name: string; quantity: number; unit?: string; unitName?: string; product?: Product };
                return {
                productId: ingredient.productId,
                product: ingredient.product || { name: ingredient.name } as Product,
                quantity: ingredient.quantity,
                unit: ingredient.unit || ingredient.unitName || ''
                };
              }) : [];
              
              await handleWizardComplete({
                name: blend.blendName,
                totalPrice: typeof blend.totalCost === 'number' ? blend.totalCost : 0,
                ingredients
              });
            }}
            onCancel={() => setShowBlendWizard(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Bundle Selector */}
      <BundleSelector
        open={showBundleSelector}
        onClose={() => setShowBundleSelector(false)}
        onSelectBundle={handleBundleSelection}
        loading={loading}
      />

      {/* Prescription Selector */}
      {selectedCustomer && (
        <PrescriptionSelector
          open={showPrescriptionSelector}
          onClose={() => setShowPrescriptionSelector(false)}
          patientId={selectedCustomer.id}
          patientName={selectedCustomer.name}
          onSelectPrescription={handlePrescriptionSelection}
          loading={loading}
        />
      )}

      {/* Miscellaneous Selector */}
      <MiscellaneousSelector
        open={showMiscellaneousSelector}
        onClose={() => setShowMiscellaneousSelector(false)}
        onSelectMiscellaneous={handleMiscellaneousSelection}
        loading={loading}
      />

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
