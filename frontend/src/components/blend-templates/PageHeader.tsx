"use client"

import { HiPlus, HiFunnel } from 'react-icons/hi2'
import {
  EditorialMasthead,
  EditorialButton,
} from '@/components/ui/editorial'

interface PageHeaderProps {
  onCreateTemplate?: () => void
  onToggleFilters: () => void
  showFilters: boolean
  canCreate: boolean
  total?: number
}

export function PageHeader({
  onCreateTemplate,
  onToggleFilters,
  showFilters,
  canCreate,
  total,
}: PageHeaderProps) {
  return (
    <EditorialMasthead
      kicker="Blend templates"
      title="Formulary"
      subtitle={
        total !== undefined ? (
          <>
            <span className="tabular-nums">{total}</span> template{total === 1 ? '' : 's'} on file
          </>
        ) : (
          'Reusable blend formulations for consistent mixing'
        )
      }
    >
      <EditorialButton
        variant={showFilters ? 'ghost-active' : 'ghost'}
        icon={<HiFunnel className="h-3 w-3" />}
        onClick={onToggleFilters}
      >
        Filter
      </EditorialButton>
      {canCreate && onCreateTemplate && (
        <EditorialButton
          variant="primary"
          icon={<HiPlus className="h-3 w-3" />}
          arrow
          onClick={onCreateTemplate}
        >
          New template
        </EditorialButton>
      )}
    </EditorialMasthead>
  )
}
