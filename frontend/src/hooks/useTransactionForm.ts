import { useState, useCallback, useEffect, useRef } from "react"
import type { TransactionFormData, TransactionItem, Transaction } from "@/types/transaction"
import type { Product } from "@/types/inventory"
import type { Patient } from "@/types/patient"
import { DraftStorage } from "@/lib/client/draftStorage"
import { DiscountService } from "@/services/DiscountService"

interface DraftData {
  draftId: string
  formData: Record<string, unknown>
  timestamp: Date
  userId: string
}

interface UseTransactionFormProps {
  initialData?: Transaction
  products: Product[]
  patients?: Patient[]
  enableAutoSave?: boolean
  userId?: string
  onDraftSaved?: (draftId: string) => void
  onDraftLoadPrompt?: (availableDrafts: DraftData[]) => Promise<string | null>
}

export function useTransactionForm({ 
  initialData, 
  products,
  patients = [], 
  enableAutoSave = false,
  userId,
  onDraftSaved,
  onDraftLoadPrompt
}: UseTransactionFormProps) {
  // Transaction numbers are now generated server-side to avoid conflicts

  // Draft management state
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastFormDataRef = useRef<string>('')

  const [formData, setFormData] = useState<TransactionFormData>(() => {
    if (initialData) {
      return {
        ...initialData,
        // Ensure all customer fields have string defaults to prevent controlled/uncontrolled input warnings
        customerName: initialData.customerName || "",
        customerEmail: initialData.customerEmail || "",
        customerPhone: initialData.customerPhone || "",
        items: initialData.items.map(item => {
          const productId = typeof item.productId === 'object' && item.productId !== null 
            ? (item.productId as { _id: string })._id 
            : item.productId
          const product = products.find(p => p._id === productId)
          
          return {
            ...item,
            id: item.id || `item_${Date.now()}_${Math.random()}`,
            productId: productId,
            product: product || undefined
          }
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

  // Calculate totals whenever items or discount changes
  useEffect(() => {
    const subtotal = formData.items.reduce((sum, item) => {
      // Credits already have negative totalPrice, so just add normally
      return sum + item.totalPrice
    }, 0)
    const totalAmount = Math.max(0, subtotal - formData.discountAmount)
    const changeAmount = formData.paidAmount > totalAmount ? formData.paidAmount - totalAmount : 0
    
    setFormData(prev => ({
      ...prev,
      subtotal,
      totalAmount,
      changeAmount,
      paymentStatus: formData.paidAmount >= totalAmount && totalAmount > 0 ? "paid" : prev.paymentStatus
    }))
  }, [formData.items, formData.discountAmount, formData.paidAmount])

  const updateFormData = useCallback((updates: Partial<TransactionFormData>) => {
    setFormData(prev => {
      // Check if customer ID is being updated - this indicates a patient change
      if (updates.customerId && updates.customerId !== prev.customerId) {
        // Find the patient to get discount information
        const selectedPatient = patients.find(p => p.id === updates.customerId);
        
        if (selectedPatient?.memberBenefits?.discountPercentage && selectedPatient.memberBenefits.discountPercentage > 0) {
          // Recalculate all item prices with the new customer's discount
          const updatedItems = prev.items.map((item) => {
            // Skip recalculation for items without product reference or "Sell in Parts" items
            // Note: itemType eligibility is now handled by DiscountService
            if (!item.product || item.saleType === 'volume') {
              return item;
            }

            // Get the product for discount calculation
            const product = products.find(p => p._id === item.productId) || item.product;
            
            // Create customer object compatible with DiscountService
            const customerForDiscount = {
              _id: selectedPatient.id,
              discountRate: selectedPatient.memberBenefits!.discountPercentage
            };

            if (product) {
              // Calculate member discount for this item (service handles itemType eligibility)
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

          return { ...prev, ...updates, items: updatedItems };
        }
      }

      // For all other updates, just apply them normally
      return { ...prev, ...updates };
    });
  }, [patients, products])

  const addItem = useCallback((item: TransactionItem) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, item]
    }))
  }, [])

  const updateItem = useCallback((itemId: string, updates: Partial<TransactionItem>) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              ...updates,
              subtotal: calculateItemSubtotal({ ...item, ...updates })
            } 
          : item
      )
    }))
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }))
  }, [])

  const calculateItemSubtotal = (item: Partial<TransactionItem>): number => {
    if (item.saleType === "volume" && item.convertedQuantity) {
      return (item.unitPrice || 0) * item.convertedQuantity
    }
    return (item.unitPrice || 0) * (item.quantity || 1)
  }

  const validateInventory = useCallback((item: TransactionItem, product?: Product): { valid: boolean; message?: string } => {
    if (!product) return { valid: false, message: "Product not found" }

    const availableStock = product.availableStock || 0
    const totalQuantityInCart = formData.items
      .filter(i => i.productId === product._id && i.id !== item.id)
      .reduce((sum, i) => sum + i.quantity, 0)
    
    if (item.quantity + totalQuantityInCart > availableStock) {
      return { 
        valid: false, 
        message: `Only ${availableStock - totalQuantityInCart} ${product.unitOfMeasurement?.name || 'units'} available` 
      }
    }

    return { valid: true }
  }, [formData.items])

  // Auto-save functionality
  const saveDraftToLocal = useCallback((data: TransactionFormData, draftId?: string, selectedPatientId?: string) => {
    if (!userId) return

    const id = draftId || currentDraftId || DraftStorage.generateDraftId()
    DraftStorage.saveDraft(id, data as unknown as Record<string, unknown>, userId, undefined, selectedPatientId)
    
    if (!currentDraftId) {
      setCurrentDraftId(id)
    }
    
    setLastSaved(new Date())
    onDraftSaved?.(id)
  }, [userId, currentDraftId, onDraftSaved])

  const saveDraftToServer = useCallback(async (data: TransactionFormData, draftId?: string, selectedPatientId?: string) => {
    if (!userId) return

    setIsAutoSaving(true)
    try {
      const response = await fetch('/api/transactions/drafts/autosave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: draftId || currentDraftId,
          formData: data,
          selectedPatientId
        })
      })

      const result = await response.json()
      if (result.success && result.draft) {
        if (!currentDraftId) {
          setCurrentDraftId(result.draft.draftId)
        }
        setLastSaved(new Date())
      }
    } catch (error) {
      console.warn('Server auto-save failed, using local storage:', error)
      saveDraftToLocal(data, draftId, selectedPatientId)
    } finally {
      setIsAutoSaving(false)
    }
  }, [userId, currentDraftId, saveDraftToLocal])

  const triggerAutoSave = useCallback((data: TransactionFormData) => {
    if (!enableAutoSave || !userId) return

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Check if data has actually changed
    const dataString = JSON.stringify(data)
    if (dataString === lastFormDataRef.current) return
    lastFormDataRef.current = dataString

    // Set new timer for auto-save
    autoSaveTimerRef.current = setTimeout(() => {
      saveDraftToServer(data)
    }, 3000) // Auto-save after 3 seconds of inactivity
  }, [enableAutoSave, userId, saveDraftToServer])

  // Load draft on mount
  useEffect(() => {
    if (!userId || initialData || !onDraftLoadPrompt) return

    const checkForDrafts = async () => {
      const localDrafts = DraftStorage.getUserDrafts(userId)
      
      if (localDrafts.length > 0) {
        const selectedDraftId = await onDraftLoadPrompt(localDrafts)
        if (selectedDraftId) {
          const draft = DraftStorage.getDraft(selectedDraftId, userId)
          if (draft) {
            setFormData(draft.formData as unknown as TransactionFormData)
            setCurrentDraftId(selectedDraftId)
            setLastSaved(draft.timestamp)
          }
        }
      }
    }

    checkForDrafts()
  }, [userId, initialData, onDraftLoadPrompt])

  // Auto-save when form data changes
  useEffect(() => {
    if (enableAutoSave && formData && !initialData) {
      triggerAutoSave(formData)
    }
  }, [formData, enableAutoSave, triggerAutoSave, initialData])

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  const clearCurrentDraft = useCallback(() => {
    if (currentDraftId && userId) {
      DraftStorage.deleteDraft(currentDraftId, userId)
      setCurrentDraftId(null)
      setLastSaved(null)
    }
  }, [currentDraftId, userId])

  const manualSaveDraft = useCallback((draftName?: string, selectedPatientId?: string) => {
    if (!userId) return

    const dataToSave = draftName ? { ...formData, draftName } : formData
    saveDraftToServer(dataToSave, undefined, selectedPatientId)
  }, [formData, userId, saveDraftToServer])

  return {
    formData,
    updateFormData,
    addItem,
    updateItem,
    removeItem,
    validateInventory,
    calculateItemSubtotal,
    // Draft functionality
    currentDraftId,
    isAutoSaving,
    lastSaved,
    clearCurrentDraft,
    manualSaveDraft,
    saveDraftToLocal
  }
}