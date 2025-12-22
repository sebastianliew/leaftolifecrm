"use client"

import React from 'react'
import type { BlendIngredient } from '@/types/blend'

interface BlendCostSummaryProps {
  ingredients: BlendIngredient[]
  sellingPrice: number
}

export const BlendCostSummary = React.memo(function BlendCostSummary({
  ingredients,
  sellingPrice
}: BlendCostSummaryProps) {
  if (ingredients.length === 0) return null

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-medium text-sm text-gray-700">Blend Price</h4>
          <p className="text-xs text-gray-500">Selling price for this custom blend</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-green-600">${sellingPrice.toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
})