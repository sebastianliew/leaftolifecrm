"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { IoClose, IoCheckmark } from "react-icons/io5"
import { FaShoppingCart, FaUsers, FaCreditCard, FaSearch, FaBox, FaFlask, FaClock, FaTrash } from "react-icons/fa"
import { MdRefresh, MdExpandMore, MdExpandLess } from "react-icons/md"
import { ImSpinner8 } from "react-icons/im"
import { HiOutlineClipboardList } from "react-icons/hi"
import type { TransactionFormData, TransactionItem, Customer, Address, Transaction } from "@/types/transaction"
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

interface TransactionFormProps {
  products: Product[]
  onSubmit: (data: TransactionFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
  initialData?: Transaction
}

export function TransactionFormRedesigned({ products, onSubmit, onCancel, loading, initialData }: TransactionFormProps) {
  const { patients, searchPatients, searchLoading, recentPatients, getRecentPatients } = usePatients()
  const { units, getUnits } = useUnits()
  const { ensureSuperAdminUser } = useUsers()
  const [patientSearch, setPatientSearch] = useState("")
  const [_showPatientDropdown, _setShowPatientDropdown] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [showOrderSummary, setShowOrderSummary] = useState(false)

  // Transaction numbers are now generated server-side to avoid conflicts

  const [formData, setFormData] = useState<TransactionFormData>(() => {
    if (initialData) {
      return {
        ...initialData,
        // Ensure all customer fields have string defaults to prevent controlled/uncontrolled input warnings
        customerName: initialData.customerName || "",
        customerEmail: initialData.customerEmail || "",
        customerPhone: initialData.customerPhone || "",
        items: initialData.items.map((item: TransactionItem) => {
          const productId = typeof item.productId === 'object' && item.productId !== null 
            ? (item.productId as { _id: string })._id 
            : item.productId;
          const product = products.find(p => p._id === productId);
          
          return {
            ...item,
            id: item.id || `item_${Date.now()}_${Math.random()}`,
            productId: productId,
            product: product || undefined
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
      paymentMethod: "cash",
      paymentStatus: "pending",
      paidAmount: 0,
      changeAmount: 0,
      transactionDate: new Date().toISOString(),
      invoiceGenerated: false,
      createdBy: "current_user",
      transactionNumber: '', // Will be generated server-side
      status: "pending",
    }
  })

  const [showProductDialog, setShowProductDialog] = useState(false)
  const [showCustomerDialog, setShowCustomerDialog] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
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

  // Prescription and history reuse state
  const [showPrescriptionSelector, setShowPrescriptionSelector] = useState(false)
  const [, _setShowPreviousTransactions] = useState(false)

  // User selection state
  const [, setCurrentUser] = useState<Patient | null>(null)
  const [, _setDiscountError] = useState<string | null>(null)

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
    const totalAmount = subtotal - formData.discountAmount

    setFormData((prev) => ({
      ...prev,
      subtotal,
      totalAmount,
    }))
  }, [formData.items, formData.discountAmount])

  const handleInputChange = (field: keyof TransactionFormData, value: TransactionFormData[keyof TransactionFormData]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    
    if (field === 'discountAmount') {
      _setDiscountError(null)
    }
  }

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    setShowProductDialog(false)
    setShowQuantitySelector(true)
  }

  const handleQuantityConfirmation = (totalQuantity: number, totalPrice: number, selectedUnit: string, saleType?: string, containerTypeInfo?: { containerType: ContainerType; containerCapacity: number; containersNeeded?: number } | null) => {
    if (!selectedProduct) return

    const productUnitOfMeasurement = selectedProduct.unitOfMeasurement
    
    if (!productUnitOfMeasurement) {
      alert(`Product "${selectedProduct.name}" is missing unit of measurement. Please update the product first.`)
      return
    }

    const existingCartQuantity = formData.items
      .filter(item => item.productId === selectedProduct._id)
      .reduce((sum, item) => {
        return sum + item.convertedQuantity
      }, 0)

    const totalRequiredQuantity = existingCartQuantity + totalQuantity
    const containerCapacity = selectedProduct.containerCapacity || selectedProduct.quantity || 1
    const availableStock = selectedProduct.totalQuantity || (selectedProduct.currentStock * containerCapacity)

    if (totalRequiredQuantity > availableStock) {
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

    let unitId: string
    let unitBaseUnit: string

    if (typeof productUnitOfMeasurement === 'object' && productUnitOfMeasurement !== null) {
      unitId = productUnitOfMeasurement._id || productUnitOfMeasurement.id || ''
      unitBaseUnit = productUnitOfMeasurement.baseUnit || productUnitOfMeasurement.name || 'unit'
    } else if (typeof productUnitOfMeasurement === 'string') {
      unitId = productUnitOfMeasurement
      unitBaseUnit = 'unit'
    } else {
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

    let discountAmount = 0;
    let finalTotalPrice = totalPrice;
    const itemType = 'product'; // Regular products have itemType 'product'
    
    // Apply member discount if patient is selected and this is a regular product with quantity sale type
    if (selectedPatient?.memberBenefits?.discountPercentage && saleType !== 'volume') {
      const customerForDiscount = {
        _id: selectedPatient.id,
        discountRate: selectedPatient.memberBenefits.discountPercentage
      };

      const discountResult = DiscountService.calculateItemDiscount(
        selectedProduct,
        totalQuantity,
        totalPrice / totalQuantity,
        customerForDiscount,
        { itemType }
      );

      if (discountResult.eligible && discountResult.discountCalculation) {
        discountAmount = discountResult.discountCalculation.discountAmount;
        finalTotalPrice = discountResult.discountCalculation.finalPrice;
      }
    }

    const newItem: TransactionItem = {
      id: `item_${Date.now()}`,
      productId: selectedProduct._id,
      product: selectedProduct,
      name: selectedProduct.name,
      description: selectedProduct.description,
      quantity: totalQuantity,
      unitPrice: totalPrice / totalQuantity,
      totalPrice: finalTotalPrice,
      discountAmount: discountAmount,
      isService: false,
      saleType: (saleType || 'quantity') as 'quantity' | 'volume',
      unitOfMeasurementId: finalUnitId,
      baseUnit: finalBaseUnit,
      itemType: itemType,
      convertedQuantity: saleType === 'quantity'
        ? totalQuantity * (selectedProduct.containerCapacity || selectedProduct.quantity || 1)
        : totalQuantity,
      sku: selectedProduct.sku,
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
        }).filter(container => container.quantityToConsume > 0)
      })
    }

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }))

    setShowQuantitySelector(false)
    setSelectedProduct(null)
  }

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
      setShowCustomBlendCreator(true)
    }
  }

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
      const blendItem: TransactionItem = {
        id: `blend_${Date.now()}_${Math.random()}`,
        itemType: 'custom_blend',
        productId: '',
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

  const handleFixedBlendSelection = (blendItem: TransactionItem) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, blendItem]
    }))
    setShowFixedBlendSelector(false)
  }

  const handleCustomBlendCreation = (blendItem: TransactionItem) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, blendItem]
    }))
    setShowCustomBlendCreator(false)
  }

  const handleBundleSelection = (bundleItem: TransactionItem) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, bundleItem]
    }))
    setShowBundleSelector(false)
  }

  const handlePrescriptionSelection = async (
    _prescriptionId: string, 
    _selectedRemedies?: string[], 
    _modifications?: Record<string, {
      quantity: number;
      notes: string;
      reason: string;
    }>
  ) => {
    // TODO: Re-implement prescription selection without TransactionService
    // The TransactionService has been removed from the codebase
    alert('Prescription selection is temporarily disabled - TransactionService not available')
    setShowPrescriptionSelector(false)
    
    // Original implementation commented out until TransactionService is restored:
    /*
    try {
      const { TransactionService } = await import('@/services/TransactionService')
      
      if (!selectedCustomer?.id) {
        throw new Error('No customer selected')
      }

      const transaction = await TransactionService.createFromPrescription(
        selectedCustomer.id,
        prescriptionId,
        selectedRemedies,
        modifications
      )

      const prescriptionItems: TransactionItem[] = transaction.items.map(item => ({
        ...item,
        id: `prescription_${Date.now()}_${Math.random()}`,
      } as TransactionItem))

      setFormData(prev => ({
        ...prev,
        items: [...prev.items, ...prescriptionItems]
      }))

      setShowPrescriptionSelector(false)
    } catch (error) {
      alert(`Failed to add prescription items: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    */
  }

  const removeItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }))
  }

  const updateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId)
      return
    }

    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === itemId) {
          const totalPrice = item.unitPrice * quantity
          const convertedQuantity = item.saleType === 'quantity'
            ? quantity * (item.product?.containerCapacity || item.product?.quantity || 1)
            : quantity
          
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
    setSelectedPatient(patient)
    
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
    setPatientSearch("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.customerName || !formData.customerName.trim()) {
      alert('Customer name is required')
      return
    }
    
    if (formData.items.length === 0) {
      alert('At least one item is required')
      return
    }
    
    const newTransactionNumber = '' // Will be generated server-side

    const transactionData: TransactionFormData = {
      ...formData,
      transactionNumber: newTransactionNumber,
      transactionDate: new Date().toISOString(),
      createdBy: "current_user",
      items: formData.items.map(item => {
        if (item.itemType === 'custom_blend' || item.itemType === 'fixed_blend' || item.itemType === 'bundle') {
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

        if (!item.product) {
          const productId = typeof item.productId === 'object' && item.productId !== null 
            ? (item.productId as { _id: string })._id 
            : item.productId;
          const product = products.find(p => p._id === productId);
          if (!product) {
            throw new Error(`Product with ID ${productId} not found. Please ensure all products are available.`);
          }
          item.product = product;
          item.productId = productId;
        }

        const { ...cleanItem } = item;
        
        if (!cleanItem.unitOfMeasurementId) {
          throw new Error(`Item "${cleanItem.name}" is missing unit of measurement`);
        }
        
        return {
          ...cleanItem,
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
      product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      product.sku.toLowerCase().includes(productSearch.toLowerCase()),
  )

  const canProceedToNextStep = () => {
    switch (activeStep) {
      case 0:
        return formData.customerName.trim() !== ""
      case 1:
        return formData.items.length > 0
      case 2:
        return true
      default:
        return false
    }
  }

  const steps = [
    { label: 'Customer', icon: FaUsers },
    { label: 'Items', icon: FaShoppingCart },
    { label: 'Payment', icon: FaCreditCard }
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-6">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => setActiveStep(index)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeStep === index 
                  ? 'bg-blue-500 text-white' 
                  : index < activeStep 
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              <step.icon className="w-4 h-4" />
              <span className="font-medium">{step.label}</span>
              {index < activeStep && <IoCheckmark className="w-4 h-4 ml-1" />}
            </button>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-1 mx-2 ${
                index < activeStep ? 'bg-green-500' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Order Summary Panel */}
      <div className={`bg-gray-50 rounded-lg p-4 mb-4 transition-all ${showOrderSummary ? 'max-h-96' : 'max-h-20'}`}>
        <button
          type="button"
          onClick={() => setShowOrderSummary(!showOrderSummary)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-4">
            <HiOutlineClipboardList className="w-5 h-5 text-gray-600" />
            <div className="text-left">
              <h3 className="font-medium">Order Summary</h3>
              <p className="text-sm text-gray-600">
                {formData.items.length} items • ${formData.totalAmount.toFixed(2)}
              </p>
            </div>
          </div>
          {showOrderSummary ? <MdExpandLess className="w-5 h-5" /> : <MdExpandMore className="w-5 h-5" />}
        </button>
        
        {showOrderSummary && (
          <div className="mt-4 space-y-3">
            {formData.customerName && (
              <div className="text-sm">
                <span className="text-gray-600">Customer:</span> {formData.customerName}
              </div>
            )}
            {formData.items.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Items:</div>
                {formData.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm pl-4">
                    <span>{item.name} (x{item.quantity})</span>
                    <span>${item.totalPrice.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <Separator />
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${formData.subtotal.toFixed(2)}</span>
            </div>
            {formData.discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span>-${formData.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>${formData.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {activeStep === 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Customer Information</h3>
                <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      <FaSearch className="w-4 h-4 mr-2" />
                      Search Customers
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Select Customer</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder="Search by name, ID, email, or phone..."
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <div className="max-h-[60vh] overflow-y-auto">
                        {!patientSearch && (
                          <div className="text-center py-8 text-gray-500">
                            <p className="mb-4">Type at least 2 characters to search</p>
                            {recentPatients.length > 0 && (
                              <>
                                <p className="text-sm font-medium mb-2">Recent Customers:</p>
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
                        
                        {patientSearch && searchLoading && (
                          <div className="flex items-center justify-center py-8">
                            <ImSpinner8 className="animate-spin w-6 h-6 text-blue-500" />
                            <span className="ml-2 text-gray-600">Searching...</span>
                          </div>
                        )}
                        
                        {patientSearch && patientSearch.length < 2 && !searchLoading && (
                          <div className="text-center py-8 text-gray-500">
                            <p>Please type at least 2 characters to search</p>
                          </div>
                        )}
                        
                        {patientSearch && patientSearch.length >= 2 && !searchLoading && (
                          <>
                            {patients.length === 0 ? (
                              <div className="text-center py-8 text-gray-500">
                                <p>No customers found matching &ldquo;{patientSearch}&rdquo;</p>
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
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {selectedCustomer && (
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedCustomer.name}</p>
                      <p className="text-sm text-gray-600">{selectedCustomer.email || 'No email'}</p>
                      <p className="text-sm text-gray-600">{selectedCustomer.phone || 'No phone'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null)
                        setSelectedPatient(null)
                        setFormData((prev) => ({
                          ...prev,
                          customerId: undefined,
                          customerName: "",
                          customerEmail: "",
                          customerPhone: "",
                          customerAddress: undefined,
                        }))
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <IoClose className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Name *</Label>
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) => handleInputChange("customerName", e.target.value)}
                    placeholder="Enter customer name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => handleInputChange("customerEmail", e.target.value)}
                    placeholder="Enter email (optional)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Phone</Label>
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => handleInputChange("customerPhone", e.target.value)}
                    placeholder="Enter phone (optional)"
                  />
                </div>
              </div>
            </div>
          )}

          {activeStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Transaction Items</h3>
                <div className="text-sm text-gray-600">
                  {formData.items.length} item{formData.items.length !== 1 ? 's' : ''} added
                </div>
              </div>

              {/* Add Items Section */}
              <div className="space-y-4">
                <Tabs defaultValue="products" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="products">Products</TabsTrigger>
                    <TabsTrigger value="blends">Blends</TabsTrigger>
                    <TabsTrigger value="bundles">Bundles</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="products" className="space-y-4">
                    <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" className="w-full">
                          <FaBox className="w-4 h-4 mr-2" />
                          Add Product
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto">
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
                                <div className="font-medium text-green-600 mt-2">${product.sellingPrice.toFixed(2)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {selectedCustomer && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setShowPrescriptionSelector(true)}
                          size="sm"
                        >
                          <FaClock className="w-3 h-3 mr-1" />
                          From Prescription
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => _setShowPreviousTransactions(true)}
                          size="sm"
                        >
                          <MdRefresh className="w-3 h-3 mr-1" />
                          Previous Orders
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="blends" className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setShowBlendTypeSelector(true)}
                        className="flex-1"
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
                  </TabsContent>
                  
                  <TabsContent value="bundles" className="space-y-4">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setShowBundleSelector(true)}
                      className="w-full"
                    >
                      <FaBox className="w-4 h-4 mr-2" />
                      Add Bundle
                    </Button>
                  </TabsContent>
                </Tabs>

                {/* Items List */}
                {formData.items.length > 0 && (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{item.name}</div>
                                <div className="text-sm text-gray-500">{item.sku}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => item.id && updateItemQuantity(item.id, item.quantity - 1)}
                                >
                                  -
                                </Button>
                                <span className="w-12 text-center">{item.quantity}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => item.id && updateItemQuantity(item.id, item.quantity + 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              ${item.unitPrice.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${item.totalPrice.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-600 hover:text-red-800"
                                onClick={() => item.id && removeItem(item.id)}
                              >
                                <FaTrash className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {formData.items.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FaShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No items added yet</p>
                    <p className="text-sm">Add products, blends, or bundles to continue</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Payment Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    placeholder="0.00"
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
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <Separator />

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span>${formData.subtotal.toFixed(2)}</span>
                </div>
                {formData.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount:</span>
                    <span>-${formData.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount:</span>
                  <span>${formData.totalAmount.toFixed(2)}</span>
                </div>
                {formData.paidAmount > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span>Amount Paid:</span>
                      <span>${formData.paidAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>{formData.paidAmount >= formData.totalAmount ? 'Change:' : 'Balance Due:'}</span>
                      <span className={formData.paidAmount >= formData.totalAmount ? 'text-green-600' : 'text-red-600'}>
                        ${Math.abs(formData.totalAmount - formData.paidAmount).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {activeStep > 0 && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setActiveStep(activeStep - 1)}
              disabled={loading}
            >
              Previous
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </div>

        <div className="flex gap-2">
          {activeStep < steps.length - 1 && (
            <Button 
              type="button" 
              onClick={() => setActiveStep(activeStep + 1)}
              disabled={!canProceedToNextStep() || loading}
            >
              Next
            </Button>
          )}
          {activeStep === steps.length - 1 && (
            <Button type="submit" disabled={loading || !canProceedToNextStep()}>
              {loading ? (
                <>
                  <ImSpinner8 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Complete Transaction"
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Modals */}
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

      <BlendTypeSelector
        open={showBlendTypeSelector}
        onClose={() => setShowBlendTypeSelector(false)}
        onSelectFixedBlend={handleFixedBlendTypeSelection}
        onSelectCustomBlend={handleCustomBlendTypeSelection}
      />

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

      <BundleSelector
        open={showBundleSelector}
        onClose={() => setShowBundleSelector(false)}
        onSelectBundle={handleBundleSelection}
        loading={loading}
      />

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
    </form>
  )
}