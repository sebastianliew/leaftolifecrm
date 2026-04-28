"use client"

import { useCallback } from 'react'
import {
  EditorialFilterRow,
  EditorialField,
  EditorialSearch,
  EditorialSelect,
  EditorialButton,
} from '@/components/ui/editorial'
import type { TemplateFilters } from '@/types/blend'

interface FilterPanelProps {
  filters: TemplateFilters
  onFilterChange: (key: keyof TemplateFilters, value: string | boolean | undefined) => void
  onApply: () => void
  onReset: () => void
  onSearch?: (searchTerm: string) => void
}

export function FilterPanel({ filters, onFilterChange, onApply, onReset, onSearch }: FilterPanelProps) {
  const handleSearch = useCallback(
    (term: string) => {
      onFilterChange('search', term)
      if (onSearch) onSearch(term)
    },
    [onFilterChange, onSearch]
  )

  return (
    <EditorialFilterRow columns={3}>
      <EditorialField label="Search">
        <EditorialSearch
          onSearch={handleSearch}
          placeholder="Search templates..."
          width="w-full"
          initialValue={filters.search || ''}
        />
      </EditorialField>
      <EditorialField label="Status">
        <EditorialSelect
          value={filters.isActive === undefined ? 'all' : filters.isActive.toString()}
          onChange={(e) =>
            onFilterChange('isActive', e.target.value === 'all' ? undefined : e.target.value === 'true')
          }
        >
          <option value="all">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </EditorialSelect>
      </EditorialField>
      <div className="flex items-end gap-3">
        <EditorialButton variant="primary" arrow onClick={onApply}>
          Apply
        </EditorialButton>
        <EditorialButton variant="ghost" onClick={onReset}>
          Clear
        </EditorialButton>
      </div>
    </EditorialFilterRow>
  )
}
