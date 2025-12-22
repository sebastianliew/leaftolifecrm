import React from "react"
import { TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FaChevronUp, FaChevronDown } from "react-icons/fa"
import type { CategorySort } from "@/types/inventory/category.types"

interface CategoryTableHeaderProps {
  sort: CategorySort
  onSort: (field: CategorySort['field']) => void
}

export function CategoryTableHeader({ sort, onSort }: CategoryTableHeaderProps) {
  const SortIcon = ({ field }: { field: CategorySort['field'] }) => {
    if (sort.field !== field) return null
    return sort.order === 'asc' ? 
      <FaChevronUp className="w-3 h-3" /> : 
      <FaChevronDown className="w-3 h-3" />
  }

  return (
    <TableHeader className="sticky top-0 bg-white">
      <TableRow className="border-b-0">
        <TableHead 
          className="cursor-pointer hover:bg-gray-50 border-b-0 select-none"
          onClick={() => onSort('name')}
        >
          <div className="flex items-center gap-1">
            Name
            <SortIcon field="name" />
          </div>
        </TableHead>
        
        <TableHead 
          className="cursor-pointer hover:bg-gray-50 border-b-0 select-none"
          onClick={() => onSort('description')}
        >
          <div className="flex items-center gap-1">
            Description
            <SortIcon field="description" />
          </div>
        </TableHead>
        
        <TableHead 
          className="cursor-pointer hover:bg-gray-50 border-b-0 select-none"
          onClick={() => onSort('createdAt')}
        >
          <div className="flex items-center gap-1">
            Created
            <SortIcon field="createdAt" />
          </div>
        </TableHead>
        
        <TableHead className="text-right border-b-0">
          Actions
        </TableHead>
      </TableRow>
    </TableHeader>
  )
}