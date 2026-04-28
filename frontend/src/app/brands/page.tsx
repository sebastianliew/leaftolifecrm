"use client"

import { useState, useCallback, useMemo } from 'react'
import { useBrands, useCreateBrand, useUpdateBrand, useDeleteBrand } from "@/hooks/queries/use-common-queries"
import { BrandForm } from "@/components/brands/brand-form"
import { BrandList } from "@/components/brands/brand-list"
import type { BrandFormData, BrandStatus } from "@/types/brands"
import { HiPlus, HiFunnel } from "react-icons/hi2"
import {
  EditorialPage,
  EditorialMasthead,
  EditorialStats,
  EditorialStat,
  EditorialSearch,
  EditorialButton,
  EditorialFilterRow,
  EditorialField,
  EditorialSelect,
  EditorialModal,
} from "@/components/ui/editorial"

type ApiBrand = {
  _id: string;
  name: string;
  description?: string;
  active: boolean;
  status?: BrandStatus;
}

export default function BrandsPage() {
  const { data: brands = [], isLoading: loading } = useBrands()
  const createBrandMutation = useCreateBrand()
  const updateBrandMutation = useUpdateBrand()
  const deleteBrandMutation = useDeleteBrand()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<BrandStatus | 'all'>('all')
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredBrands = useMemo(() =>
    brands.filter((brand: ApiBrand) => {
      if (searchTerm && !brand.name?.toLowerCase().includes(searchTerm.toLowerCase())) return false
      if (statusFilter !== 'all' && brand.status !== statusFilter) return false
      if (isActiveFilter !== 'all' && brand.active !== isActiveFilter) return false
      return true
    }), [brands, searchTerm, statusFilter, isActiveFilter])

  const totalBrands = brands.length
  const activeBrands = brands.filter((b: ApiBrand) => b.active).length
  const inactiveBrands = totalBrands - activeBrands
  const pendingApproval = brands.filter((b: ApiBrand) => b.status === 'pending_approval').length

  const handleSearch = useCallback((term: string) => setSearchTerm(term), [])

  const handleCreateBrand = async (data: BrandFormData) => {
    setIsSubmitting(true)
    try {
      await createBrandMutation.mutateAsync(data)
      setIsCreateDialogOpen(false)
    } catch (error) {
      console.error('Failed to create brand:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateBrand = async (id: string, data: Partial<BrandFormData>) => {
    try {
      await updateBrandMutation.mutateAsync({ id, data })
    } catch (error) {
      console.error('Failed to update brand:', error)
    }
  }

  const handleDeleteBrand = async (brand: ApiBrand) => {
    try {
      await deleteBrandMutation.mutateAsync(brand._id)
    } catch (error) {
      console.error('Failed to delete brand:', error)
    }
  }

  return (
    <EditorialPage>
      <EditorialMasthead
        kicker="Brands"
        title="Catalog"
        subtitle={
          <>
            <span className="tabular-nums">{totalBrands}</span> brand{totalBrands === 1 ? '' : 's'} on file
          </>
        }
      >
        <EditorialSearch onSearch={handleSearch} placeholder="Search brands..." />
        <EditorialButton
          variant={showFilters ? 'ghost-active' : 'ghost'}
          icon={<HiFunnel className="h-3 w-3" />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filter
        </EditorialButton>
        <EditorialButton
          variant="primary"
          icon={<HiPlus className="h-3 w-3" />}
          arrow
          onClick={() => setIsCreateDialogOpen(true)}
        >
          New brand
        </EditorialButton>
      </EditorialMasthead>

      <EditorialStats>
        <EditorialStat index="i." label="Total brands" value={totalBrands} caption={<><span className="tabular-nums">{activeBrands}</span> active</>} />
        <EditorialStat index="ii." label="Inactive" value={inactiveBrands} caption="not in use" />
        <EditorialStat
          index="iii."
          label="Pending approval"
          value={pendingApproval}
          caption={pendingApproval > 0 ? 'awaiting review' : 'all clear'}
          tone={pendingApproval > 0 ? 'warning' : 'ink'}
        />
        <EditorialStat
          index="iv."
          label="Showing"
          value={filteredBrands.length}
          caption="after filters"
        />
      </EditorialStats>

      {showFilters && (
        <EditorialFilterRow columns={3}>
          <EditorialField label="Status">
            <EditorialSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as BrandStatus | 'all')}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="discontinued">Discontinued</option>
              <option value="pending_approval">Pending approval</option>
            </EditorialSelect>
          </EditorialField>
          <EditorialField label="Active state">
            <EditorialSelect
              value={isActiveFilter.toString()}
              onChange={(e) => setIsActiveFilter(e.target.value === 'all' ? 'all' : e.target.value === 'true')}
            >
              <option value="all">All</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </EditorialSelect>
          </EditorialField>
        </EditorialFilterRow>
      )}

      <BrandList
        brands={filteredBrands}
        loading={loading}
        onUpdateBrand={handleUpdateBrand}
        onDeleteBrand={handleDeleteBrand}
        isSubmitting={isSubmitting}
      />

      <EditorialModal
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        kicker="Brands"
        title="New brand"
        description="Capture the supplier or label that distinguishes this product line."
        size="xl"
      >
        <BrandForm
          onSubmit={handleCreateBrand}
          onCancel={() => setIsCreateDialogOpen(false)}
          loading={isSubmitting}
        />
      </EditorialModal>
    </EditorialPage>
  )
}
