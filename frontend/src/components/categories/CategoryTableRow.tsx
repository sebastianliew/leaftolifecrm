import React from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FaEdit, FaTrash } from "react-icons/fa"
import type { ProductCategory } from "@/types/inventory/category.types"

interface CategoryTableRowProps {
  category: ProductCategory
  onEdit: (category: ProductCategory) => void
  onDelete: (category: ProductCategory) => void
}

export function CategoryTableRow({ category, onEdit, onDelete }: CategoryTableRowProps) {
  const formatDate = (date: string | Date) => {
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return 'Invalid date'
    }
  }

  return (
    <TableRow className="border-b-0 hover:bg-gray-50">
      <TableCell className="border-b-0">
        <div>
          <div className="font-medium">{category.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={category.isActive ? "default" : "secondary"}>
              {category.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </TableCell>
      
      <TableCell className="border-b-0">
        <span className="text-gray-600">
          {category.description || '-'}
        </span>
      </TableCell>
      
      <TableCell className="border-b-0 text-sm text-gray-500">
        {formatDate(category.createdAt)}
      </TableCell>
      
      <TableCell className="text-right border-b-0">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(category)}
            className="h-8 w-8 p-0"
            title="Edit category"
          >
            <FaEdit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(category)}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
            title="Delete category"
          >
            <FaTrash className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}