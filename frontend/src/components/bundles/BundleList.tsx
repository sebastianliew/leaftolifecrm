"use client"

import { useState, useCallback } from 'react'
import { HiPlus, HiPencil, HiTrash, HiEye, HiFunnel, HiTag } from "react-icons/hi2"
import { useBundlesQuery, useDeleteBundleMutation, useBundleCategoriesQuery } from "@/hooks/queries/use-bundles-query"
import { useToast } from "@/components/ui/use-toast"
import type { Bundle, BundleFilters } from '@/types/bundle'
import {
  EditorialMasthead,
  EditorialStats,
  EditorialStat,
  EditorialSearch,
  EditorialButton,
  EditorialFilterRow,
  EditorialField,
  EditorialSelect,
  EditorialTable,
  EditorialTHead,
  EditorialTh,
  EditorialTr,
  EditorialTd,
  EditorialEmptyRow,
  EditorialPagination,
  EditorialModal,
  EditorialModalFooter,
  EditorialMeta,
} from "@/components/ui/editorial"

interface BundleListProps {
  onCreateNew?: () => void
  onEdit?: (bundle: Bundle) => void
  onView: (bundle: Bundle) => void
  canDelete?: boolean
}

export function BundleList({ onCreateNew, onEdit, onView, canDelete = false }: BundleListProps) {
  const { toast } = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const [filters, setFilters] = useState<BundleFilters>({
    search: '',
    category: undefined,
    isActive: undefined,
    isPromoted: undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })

  const { data: bundlesData, isLoading: loading, error } = useBundlesQuery(filters, currentPage, limit)
  const { data: categories = [] } = useBundleCategoriesQuery()
  const deleteBundleMutation = useDeleteBundleMutation()

  const bundles = Array.isArray(bundlesData)
    ? (bundlesData as Bundle[])
    : (bundlesData as { bundles?: Bundle[]; data?: Bundle[] })?.bundles
      || (bundlesData as { bundles?: Bundle[]; data?: Bundle[] })?.data
      || []
  const total = bundlesData?.pagination?.total || bundles.length
  const totalPages = (bundlesData?.pagination as { totalPages?: number; pages?: number })?.totalPages
    || (bundlesData?.pagination as { totalPages?: number; pages?: number })?.pages
    || 1
  const page = bundlesData?.pagination?.page || currentPage

  const [showFilters, setShowFilters] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; bundle: Bundle | null }>({ open: false, bundle: null })

  const handleSearch = useCallback((term: string) => {
    setFilters(prev => ({ ...prev, search: term }))
    setCurrentPage(1)
  }, [])

  const handleFilterChange = (field: keyof BundleFilters, value: BundleFilters[keyof BundleFilters]) => {
    setFilters(prev => ({ ...prev, [field]: value }))
    setCurrentPage(1)
  }

  const handleSort = (key: string) => {
    if (filters.sortBy === key) {
      setFilters(prev => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }))
    } else {
      setFilters(prev => ({ ...prev, sortBy: key as BundleFilters['sortBy'], sortOrder: 'asc' }))
    }
  }

  const handleDeleteBundle = async () => {
    if (!deleteDialog.bundle) return
    try {
      await deleteBundleMutation.mutateAsync(deleteDialog.bundle._id)
      setDeleteDialog({ open: false, bundle: null })
      toast({ title: "Success", description: "Bundle deleted successfully" })
    } catch {
      toast({ title: "Error", description: "Failed to delete bundle", variant: "destructive" })
    }
  }

  const formatPrice = (price: number | null | undefined) =>
    price === null || price === undefined || isNaN(price) ? 'S$0.00' : `S$${price.toFixed(2)}`

  const activeBundles = bundles.filter((b) => b.isActive).length
  const promotedBundles = bundles.filter((b) => b.isPromoted).length

  if (error) {
    const isAuthError = error.message?.includes('401') || error.message?.includes('Unauthorized') || error.message?.includes('Access token required')
    return (
      <div className="text-center py-20 mt-8">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#DC2626]">
          {isAuthError ? 'Authentication Required' : 'Error'}
        </p>
        <p className="text-sm italic font-light text-[#6B7280] mt-3 mb-6 max-w-md mx-auto">
          {isAuthError
            ? 'Please log in with the right permissions to access bundles.'
            : 'There was an error loading the bundles. Try again or contact support.'}
        </p>
        {!isAuthError && (
          <EditorialButton variant="primary" arrow onClick={() => window.location.reload()}>
            Try again
          </EditorialButton>
        )}
      </div>
    )
  }

  return (
    <>
      <EditorialMasthead
        kicker="Bundles"
        title="Catalog"
        subtitle={
          <>
            <span className="tabular-nums">{total}</span> bundle{total === 1 ? '' : 's'} on file
          </>
        }
      >
        <EditorialSearch onSearch={handleSearch} placeholder="Search bundles..." />
        <EditorialButton
          variant={showFilters ? 'ghost-active' : 'ghost'}
          icon={<HiFunnel className="h-3 w-3" />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filter
        </EditorialButton>
        {onCreateNew && (
          <EditorialButton variant="primary" icon={<HiPlus className="h-3 w-3" />} arrow onClick={onCreateNew}>
            New bundle
          </EditorialButton>
        )}
      </EditorialMasthead>

      <EditorialStats>
        <EditorialStat index="i." label="Total bundles" value={total} caption={<><span className="tabular-nums">{activeBundles}</span> active</>} />
        <EditorialStat index="ii." label="Promoted" value={promotedBundles} tone="warning" caption="featured" />
        <EditorialStat
          index="iii."
          label="Categories"
          value={categories.length}
          caption="distinct"
        />
        <EditorialStat
          index="iv."
          label="Showing"
          value={bundles.length}
          caption="this page"
        />
      </EditorialStats>

      {showFilters && (
        <EditorialFilterRow columns={4}>
          <EditorialField label="Category">
            <EditorialSelect
              value={filters.category || 'all'}
              onChange={(e) => handleFilterChange('category', e.target.value === 'all' ? undefined : e.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </EditorialSelect>
          </EditorialField>
          <EditorialField label="Status">
            <EditorialSelect
              value={filters.isActive === undefined ? 'all' : filters.isActive.toString()}
              onChange={(e) => handleFilterChange('isActive', e.target.value === 'all' ? undefined : e.target.value === 'true')}
            >
              <option value="all">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </EditorialSelect>
          </EditorialField>
          <EditorialField label="Promotion">
            <EditorialSelect
              value={filters.isPromoted === undefined ? 'all' : filters.isPromoted.toString()}
              onChange={(e) => handleFilterChange('isPromoted', e.target.value === 'all' ? undefined : e.target.value === 'true')}
            >
              <option value="all">All</option>
              <option value="true">Promoted</option>
              <option value="false">Not promoted</option>
            </EditorialSelect>
          </EditorialField>
          <EditorialField label="Sort">
            <EditorialSelect
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-')
                handleFilterChange('sortBy', sortBy as BundleFilters['sortBy'])
                handleFilterChange('sortOrder', sortOrder as 'asc' | 'desc')
              }}
            >
              <option value="createdAt-desc">Newest first</option>
              <option value="createdAt-asc">Oldest first</option>
              <option value="name-asc">Name (A–Z)</option>
              <option value="name-desc">Name (Z–A)</option>
              <option value="totalPrice-asc">Price (low to high)</option>
              <option value="totalPrice-desc">Price (high to low)</option>
            </EditorialSelect>
          </EditorialField>
        </EditorialFilterRow>
      )}

      <EditorialTable>
        <EditorialTHead>
          <EditorialTh sortKey="name" currentSort={filters.sortBy} currentOrder={filters.sortOrder} onSort={handleSort}>Bundle</EditorialTh>
          <EditorialTh>Items</EditorialTh>
          <EditorialTh align="right">Price</EditorialTh>
          <EditorialTh align="right">Savings</EditorialTh>
          <EditorialTh>Status</EditorialTh>
          <EditorialTh align="right">Sold</EditorialTh>
          <EditorialTh align="right" className="w-32">Actions</EditorialTh>
        </EditorialTHead>
        <tbody>
          {loading ? (
            <EditorialEmptyRow colSpan={7} title="Loading" description="Fetching bundles…" />
          ) : bundles.length === 0 ? (
            <EditorialEmptyRow colSpan={7} description="No bundles match the current filters." />
          ) : (
            bundles.map((bundle: Bundle) => (
              <EditorialTr key={bundle._id}>
                <EditorialTd size="lg" className="pr-4">
                  <p className="text-[14px] text-[#0A0A0A] font-medium">{bundle.name}</p>
                  {bundle.category && (
                    <EditorialMeta className="italic font-light">{bundle.category}</EditorialMeta>
                  )}
                </EditorialTd>
                <EditorialTd>
                  <span className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">
                    {bundle.bundleProducts.length} items
                  </span>
                </EditorialTd>
                <EditorialTd align="right" size="md">
                  <p className="tabular-nums text-[#0A0A0A]">{formatPrice(bundle.bundlePrice)}</p>
                  <p className="text-[11px] text-[#9CA3AF] line-through tabular-nums mt-0.5">
                    {formatPrice(bundle.individualTotalPrice)}
                  </p>
                </EditorialTd>
                <EditorialTd align="right">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#16A34A]">
                    {bundle.savingsPercentage}% off
                  </p>
                  <p className="text-[11px] italic font-light text-[#9CA3AF] mt-1 tabular-nums">
                    save {formatPrice(bundle.savings)}
                  </p>
                </EditorialTd>
                <EditorialTd>
                  <div className="flex flex-col items-start gap-1">
                    <span className={`text-[10px] uppercase tracking-[0.28em] ${bundle.isActive ? 'text-[#16A34A]' : 'text-[#9CA3AF]'}`}>
                      {bundle.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {bundle.isPromoted && (
                      <span className="text-[10px] uppercase tracking-[0.22em] text-[#EA580C] inline-flex items-center gap-1">
                        <HiTag className="h-3 w-3" /> Promoted
                      </span>
                    )}
                  </div>
                </EditorialTd>
                <EditorialTd align="right" className="tabular-nums">{bundle.totalSold || 0}</EditorialTd>
                <EditorialTd align="right">
                  <div className="flex items-center justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onView(bundle)} title="View" className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors">
                      <HiEye className="h-3.5 w-3.5" />
                    </button>
                    {onEdit && (
                      <button onClick={() => onEdit(bundle)} title="Edit" className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors">
                        <HiPencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => setDeleteDialog({ open: true, bundle })}
                        title="Delete"
                        className="text-[#6B7280] hover:text-[#DC2626] transition-colors"
                      >
                        <HiTrash className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </EditorialTd>
              </EditorialTr>
            ))
          )}
        </tbody>
      </EditorialTable>

      {total > 0 && (
        <EditorialPagination
          total={total}
          page={page}
          limit={limit}
          pages={totalPages}
          onPageChange={setCurrentPage}
          onLimitChange={(l) => { setLimit(l); setCurrentPage(1) }}
        />
      )}

      <EditorialModal
        open={deleteDialog.open}
        onOpenChange={(open) => !deleteBundleMutation.isPending && setDeleteDialog({ open, bundle: null })}
        kicker="Delete bundle"
        kickerTone="danger"
        title={deleteDialog.bundle ? `Remove ${deleteDialog.bundle.name}?` : 'Remove bundle?'}
        description="This action cannot be undone."
      >
        <EditorialModalFooter>
          <EditorialButton variant="ghost" onClick={() => setDeleteDialog({ open: false, bundle: null })} disabled={deleteBundleMutation.isPending}>
            Cancel
          </EditorialButton>
          <EditorialButton variant="primary" arrow onClick={handleDeleteBundle} disabled={deleteBundleMutation.isPending}>
            {deleteBundleMutation.isPending ? 'Deleting…' : 'Delete'}
          </EditorialButton>
        </EditorialModalFooter>
      </EditorialModal>
    </>
  )
}
