import React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FaSearch, FaTimes } from "react-icons/fa"
import type { CategoryFilters } from "@/types/inventory/category.types"

interface CategorySearchBarProps {
  filters: CategoryFilters
  onSearchChange: (search: string) => void
  onClearFilters: () => void
  totalCount: number
  filteredCount: number
}

export function CategorySearchBar({ 
  filters, 
  onSearchChange, 
  onClearFilters, 
  totalCount, 
  filteredCount 
}: CategorySearchBarProps) {
  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== ''
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
            <FaSearch className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <Input
            placeholder="Search categories by name or description..."
            value={filters.search || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
        
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="flex items-center gap-2"
          >
            <FaTimes className="w-3 h-3" />
            Clear
          </Button>
        )}
      </div>
      
      {/* Results summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center gap-2">
          {hasActiveFilters ? (
            <>
              Showing <Badge variant="secondary">{filteredCount}</Badge> of{' '}
              <Badge variant="outline">{totalCount}</Badge> categories
            </>
          ) : (
            <>
              Showing <Badge variant="outline">{totalCount}</Badge> categories
            </>
          )}
        </div>
        
        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <span>Active filters:</span>
            {filters.search && (
              <Badge variant="secondary">
                Search: &quot;{filters.search}&quot;
              </Badge>
            )}
            {filters.level !== undefined && (
              <Badge variant="secondary">
                Level: {filters.level}
              </Badge>
            )}
            {filters.isActive !== undefined && (
              <Badge variant="secondary">
                Status: {filters.isActive ? 'Active' : 'Inactive'}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}