"use client"

import React from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FaTrash } from 'react-icons/fa'
import { convertBlendIngredient } from '@/utils/unit-conversions'
import type { BlendIngredient } from '@/types/blend'

interface BlendIngredientsTableProps {
  ingredients: (BlendIngredient & { sellingPricePerUnit?: number })[]
  onUpdateIngredient: (index: number, field: keyof BlendIngredient, value: string | number) => void
  onRemoveIngredient: (index: number) => void
  errors?: Record<string, string>
  showSellingPrice?: boolean
}

export const BlendIngredientsTable = React.memo(function BlendIngredientsTable({
  ingredients,
  onUpdateIngredient,
  onRemoveIngredient,
  errors = {},
  showSellingPrice = false
}: BlendIngredientsTableProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="font-semibold">Ingredient</TableHead>
            <TableHead className="font-semibold">Volume</TableHead>
            <TableHead className="font-semibold">Unit</TableHead>
            <TableHead className="font-semibold">Converted</TableHead>
            <TableHead className="font-semibold">Selling Price</TableHead>
            <TableHead className="font-semibold">Stock</TableHead>
            <TableHead className="font-semibold w-20">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingredients.map((ingredient, index) => (
            <TableRow key={index}>
              <TableCell>{ingredient.name}</TableCell>
              <TableCell>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ingredient.quantity}
                  onChange={(e) => onUpdateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                  className={`w-24 ${errors[`ingredient_${index}_quantity`] ? 'border-red-500' : ''}`}
                />
                {errors[`ingredient_${index}_quantity`] && (
                  <p className="text-xs text-red-500 mt-1">{errors[`ingredient_${index}_quantity`]}</p>
                )}
              </TableCell>
              <TableCell>{ingredient.unitName}</TableCell>
              <TableCell>
                {convertBlendIngredient(ingredient.quantity || 0, ingredient.unitName || '')}
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  ${((ingredient.quantity || 0) * (showSellingPrice ? (ingredient.sellingPricePerUnit || 0) : (ingredient.costPerUnit || 0))).toFixed(2)}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={ingredient.availableStock && ingredient.availableStock > 0 ? 'default' : 'destructive'}>
                  {ingredient.availableStock || 0}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRemoveIngredient(index)}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <FaTrash className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
})