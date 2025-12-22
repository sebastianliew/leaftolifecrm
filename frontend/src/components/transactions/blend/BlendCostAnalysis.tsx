"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { FaCalculator } from 'react-icons/fa'
import type { CostCalculation, PricingSuggestion } from '@/types/blend'

interface BlendCostAnalysisProps {
  costCalculation: CostCalculation | null
  pricingSuggestion: PricingSuggestion | null
  sellingPrice: number
  marginPercent: number
  onMarginPercentChange: (value: number) => void
}

export const BlendCostAnalysis = React.memo(function BlendCostAnalysis({
  costCalculation: _costCalculation,
  pricingSuggestion,
  sellingPrice,
  marginPercent,
  onMarginPercentChange
}: BlendCostAnalysisProps) {
  if (!pricingSuggestion) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FaCalculator className="h-5 w-5" />
          Blend Pricing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <h4 className="font-medium mb-2">Selling Price</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Final Price:</span>
              <span className="text-lg font-semibold text-green-600">${sellingPrice.toFixed(2)}</span>
            </div>
            <div className="mt-3">
              <Label htmlFor="marginPercent">Profit Margin %</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="marginPercent"
                  type="number"
                  min="0"
                  value={marginPercent}
                  onChange={(e) => onMarginPercentChange(parseInt(e.target.value) || 0)}
                  className="w-20"
                />
                <span className="text-sm text-gray-500">Adjust to change selling price</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})