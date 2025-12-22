"use client"

import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FaTrash } from 'react-icons/fa';
import type { BlendIngredient } from '@/types/blend';
import { formatCurrency } from '@/utils/blend-calculations';

interface IngredientRowProps {
  ingredient: BlendIngredient;
  onUpdate: (field: keyof BlendIngredient, value: string | number | boolean | undefined) => void;
  onRemove: () => void;
  isStaff?: boolean;
}

export function IngredientRow({ ingredient, onUpdate, onRemove, isStaff = false }: IngredientRowProps) {
  const ingredientCost = (ingredient.quantity || 0) * (ingredient.costPerUnit || 0);
  const hasValidUnit = ingredient.unitOfMeasurementId && ingredient.unitName;

  return (
    <TableRow>
      <TableCell>{ingredient.name}</TableCell>
      <TableCell>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={ingredient.quantity === 0 ? '' : ingredient.quantity || ''}
          placeholder="0"
          onChange={(e) => onUpdate('quantity', parseFloat(e.target.value) || 0)}
          className="w-24"
        />
      </TableCell>
      <TableCell>
        {hasValidUnit ? (
          <span>{ingredient.unitName}</span>
        ) : (
          <Badge variant="destructive" className="text-xs">
            No Unit
          </Badge>
        )}
      </TableCell>
      {!isStaff && (
        <TableCell>
          <span className="text-sm">
            {formatCurrency(ingredientCost)}
          </span>
        </TableCell>
      )}
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
          onClick={onRemove}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          <FaTrash className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}