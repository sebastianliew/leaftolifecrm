"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { FaCreditCard } from "react-icons/fa"
import { useState, useEffect } from "react"
import { DiscountService } from "@/services/DiscountService"
import type { TransactionFormData, PaymentMethod, PaymentStatus } from "@/types/transaction"

interface PaymentSectionProps {
  formData: TransactionFormData
  subtotal: number
  totalAmount: number
  onPaymentChange: (updates: Partial<TransactionFormData>) => void
  canApplyDiscount: boolean
  disabled?: boolean
}

export function PaymentSection({ 
  formData, 
  subtotal, 
  totalAmount, 
  onPaymentChange, 
  canApplyDiscount,
  disabled 
}: PaymentSectionProps) {
  const [discountMode, setDiscountMode] = useState<'amount' | 'percentage'>('amount')
  const [discountValue, setDiscountValue] = useState<string>('')

  // Initialize discount value based on current discount amount
  useEffect(() => {
    if (formData.discountAmount > 0) {
      if (discountMode === 'amount') {
        setDiscountValue(formData.discountAmount.toString())
      } else {
        const percentage = subtotal > 0 ? (formData.discountAmount / subtotal * 100) : 0
        setDiscountValue(percentage.toFixed(2))
      }
    } else {
      setDiscountValue('')
    }
  }, [formData.discountAmount, discountMode, subtotal])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
    }).format(amount)
  }

  const handleDiscountChange = (value: string) => {
    setDiscountValue(value)
    const numValue = Number.parseFloat(value) || 0
    
    const calculation = DiscountService.calculateAdditionalDiscount(
      discountMode === 'percentage' ? (subtotal * numValue / 100) : numValue
    )
    
    onPaymentChange({ discountAmount: calculation.discountAmount })
  }

  const toggleDiscountMode = () => {
    const newMode = discountMode === 'amount' ? 'percentage' : 'amount'
    setDiscountMode(newMode)
    
    // Convert current value to new mode
    if (discountValue) {
      const numValue = Number.parseFloat(discountValue) || 0
      // Convert between discount modes manually since the service method expects different params
      if (discountMode === 'percentage') {
        // Converting from percentage to amount
        const convertedAmount = subtotal * numValue / 100
        setDiscountValue(convertedAmount.toString())
      } else {
        // Converting from amount to percentage
        const convertedPercentage = subtotal > 0 ? (numValue / subtotal * 100) : 0
        setDiscountValue(convertedPercentage.toString())
      }
    }
  }

  const handlePaidAmountChange = (value: string) => {
    const paid = Number.parseFloat(value) || 0
    const change = paid > totalAmount ? paid - totalAmount : 0
    onPaymentChange({ 
      paidAmount: paid,
      changeAmount: change,
      paymentStatus: paid >= totalAmount ? "paid" : "partial"
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FaCreditCard className="w-5 h-5" />
          Payment Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Select
              value={formData.paymentMethod}
              onValueChange={(value) => onPaymentChange({ paymentMethod: value as PaymentMethod })}
              disabled={disabled}
            >
              <SelectTrigger id="paymentMethod">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="debit_card">Debit Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentStatus">Payment Status</Label>
            <Select
              value={formData.paymentStatus}
              onValueChange={(value) => onPaymentChange({ paymentStatus: value as PaymentStatus })}
              disabled={disabled}
            >
              <SelectTrigger id="paymentStatus">
                <SelectValue />
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

        <div className="space-y-4 border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>

          {canApplyDiscount && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="discount" className="flex items-center justify-between">
                  <span>Discount</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={toggleDiscountMode}
                    disabled={disabled}
                    className="h-7 px-3 text-xs font-normal"
                    title={`Click to enter discount as ${discountMode === 'amount' ? 'percentage' : 'amount'}`}
                  >
                    {discountMode === 'amount' ? 'Switch to %' : 'Switch to $'}
                  </Button>
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="discount"
                    type="number"
                    value={discountValue}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    className="w-32"
                    placeholder="0"
                    min="0"
                    max={discountMode === 'percentage' ? "100" : undefined}
                    step={discountMode === 'percentage' ? "0.1" : "0.01"}
                    disabled={disabled}
                  />
                  <span className="text-sm text-muted-foreground w-4">
                    {discountMode === 'percentage' ? '%' : ''}
                  </span>
                </div>
              </div>
              {formData.discountAmount > 0 && (
                <div className="text-sm text-muted-foreground text-right">
                  {discountMode === 'percentage' 
                    ? `= ${formatCurrency(formData.discountAmount)}`
                    : subtotal > 0 ? `= ${(formData.discountAmount / subtotal * 100).toFixed(1)}%` : ''
                  }
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center text-lg font-semibold">
            <span>Total</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paidAmount">Paid Amount</Label>
            <Input
              id="paidAmount"
              type="number"
              value={formData.paidAmount}
              onChange={(e) => handlePaidAmountChange(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              disabled={disabled}
            />
          </div>

          {formData.changeAmount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Change</span>
              <span className="font-medium text-green-600">
                {formatCurrency(formData.changeAmount)}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Input
            id="notes"
            value={formData.notes || ""}
            onChange={(e) => onPaymentChange({ notes: e.target.value })}
            placeholder="Additional notes..."
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  )
}