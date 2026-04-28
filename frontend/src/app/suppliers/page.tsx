"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { useSuppliers } from "@/hooks/suppliers/useSuppliers"
import { SupplierForm } from "@/components/suppliers/supplier-form"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/usePermissions"
import type { Supplier, SupplierFormData } from "@/types/suppliers/supplier.types"
import { HiPlus, HiPencil, HiTrash, HiEye, HiStar, HiFunnel } from "react-icons/hi2"
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
  EditorialTable,
  EditorialTHead,
  EditorialTh,
  EditorialTr,
  EditorialTd,
  EditorialEmptyRow,
  EditorialModal,
  EditorialModalFooter,
  EditorialMeta,
} from "@/components/ui/editorial"

const statusToneMap: Record<string, string> = {
  active: 'text-[#16A34A]',
  inactive: 'text-[#6B7280]',
  suspended: 'text-[#DC2626]',
  pending_approval: 'text-[#EA580C]',
  blacklisted: 'text-[#DC2626]',
}

export default function SuppliersPage() {
  const { suppliers, loading, getSuppliers, createSupplier, updateSupplier, deleteSupplier } = useSuppliers()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()

  const canAddSuppliers = hasPermission('suppliers', 'canAddSuppliers')
  const canEditSuppliers = hasPermission('suppliers', 'canEditSuppliers')
  const canDeleteSuppliers = hasPermission('suppliers', 'canDeleteSuppliers')

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null)

  const [sortBy, setSortBy] = useState<string>("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  useEffect(() => {
    getSuppliers()
  }, [getSuppliers])

  const handleSearch = useCallback((term: string) => setSearchTerm(term), [])

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  const handleCreateSupplier = async (data: SupplierFormData) => {
    setActionLoading(true)
    try {
      await createSupplier(data)
      setShowCreateDialog(false)
      toast({ title: "Success", description: "Supplier created successfully" })
    } catch {
      toast({ title: "Error", description: "Failed to create supplier", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateSupplier = async (data: SupplierFormData) => {
    if (!selectedSupplier) return
    setActionLoading(true)
    try {
      await updateSupplier(selectedSupplier.id, data)
      setShowEditDialog(false)
      setSelectedSupplier(null)
      toast({ title: "Success", description: "Supplier updated successfully" })
    } catch {
      toast({ title: "Error", description: "Failed to update supplier", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  const openEditDialog = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setShowEditDialog(true)
  }

  const handleDeleteSupplier = (supplier: Supplier) => {
    setSupplierToDelete(supplier)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!supplierToDelete) return
    setActionLoading(true)
    try {
      await deleteSupplier(supplierToDelete.id)
      setShowDeleteDialog(false)
      setSupplierToDelete(null)
      toast({ title: "Success", description: "Supplier deleted successfully" })
    } catch {
      toast({ title: "Error", description: "Failed to delete supplier", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  const filteredSuppliers = useMemo(() => {
    const filtered = suppliers.filter((s) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const match = [s.name, s.code, s.contactPerson, s.email, s.phone]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(term))
        if (!match) return false
      }
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      return true
    })

    return [...filtered].sort((a, b) => {
      const get = (s: Supplier) => {
        switch (sortBy) {
          case "name": return a.name.toLowerCase()
          case "code": return s.code?.toLowerCase() || ''
          case "contactPerson": return (s.contactPerson || '').toLowerCase()
          case "email": return (s.email || '').toLowerCase()
          case "businessType": return s.businessType || ''
          case "status": return s.status
          default: return ''
        }
      }
      const aVal = get(a)
      const bVal = get(b)
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [suppliers, searchTerm, statusFilter, sortBy, sortOrder])

  const totalSuppliers = suppliers.length
  const activeSuppliers = suppliers.filter((s) => s.status === "active").length
  const preferredSuppliers = suppliers.filter((s) => s.isPreferred).length
  const totalCredit = suppliers.reduce((sum, s) => sum + (s.creditLimit || 0), 0)

  return (
    <EditorialPage>
      <EditorialMasthead
        kicker="Suppliers"
        title="Network"
        subtitle={
          <>
            <span className="tabular-nums">{totalSuppliers}</span> supplier{totalSuppliers === 1 ? '' : 's'} on file
          </>
        }
      >
        <EditorialSearch onSearch={handleSearch} placeholder="Search suppliers..." />
        <EditorialButton
          variant={showFilters ? 'ghost-active' : 'ghost'}
          icon={<HiFunnel className="h-3 w-3" />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filter
        </EditorialButton>
        {canAddSuppliers && (
          <EditorialButton
            variant="primary"
            icon={<HiPlus className="h-3 w-3" />}
            arrow
            onClick={() => setShowCreateDialog(true)}
          >
            New supplier
          </EditorialButton>
        )}
      </EditorialMasthead>

      <EditorialStats>
        <EditorialStat
          index="i."
          label="Total suppliers"
          value={totalSuppliers}
          caption={<><span className="tabular-nums">{activeSuppliers}</span> active</>}
        />
        <EditorialStat
          index="ii."
          label="Preferred"
          value={preferredSuppliers}
          caption="top tier partners"
          tone="warning"
        />
        <EditorialStat
          index="iii."
          label="Credit limit"
          value={`$${totalCredit.toLocaleString('en-GB')}`}
          caption="aggregate"
        />
        <EditorialStat
          index="iv."
          label="Showing"
          value={filteredSuppliers.length}
          caption="after filters"
        />
      </EditorialStats>

      {showFilters && (
        <EditorialFilterRow columns={3}>
          <EditorialField label="Status">
            <EditorialSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="pending_approval">Pending approval</option>
              <option value="blacklisted">Blacklisted</option>
            </EditorialSelect>
          </EditorialField>
        </EditorialFilterRow>
      )}

      <EditorialTable>
        <EditorialTHead>
          <EditorialTh sortKey="name" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort}>Name</EditorialTh>
          <EditorialTh sortKey="code" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort}>Code</EditorialTh>
          <EditorialTh sortKey="contactPerson" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort}>Contact</EditorialTh>
          <EditorialTh sortKey="email" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort}>Email</EditorialTh>
          <EditorialTh>Phone</EditorialTh>
          <EditorialTh sortKey="businessType" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort}>Business type</EditorialTh>
          <EditorialTh sortKey="status" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort}>Status</EditorialTh>
          <EditorialTh align="right" className="w-32">Actions</EditorialTh>
        </EditorialTHead>
        <tbody>
          {loading ? (
            <EditorialEmptyRow colSpan={8} title="Loading" description="Fetching the supplier network…" />
          ) : filteredSuppliers.length === 0 ? (
            <EditorialEmptyRow colSpan={8} description="No suppliers match the current filters." />
          ) : (
            filteredSuppliers.map((supplier) => {
              const tone = statusToneMap[supplier.status] || 'text-[#6B7280]'
              return (
                <EditorialTr key={supplier.id}>
                  <EditorialTd size="lg" className="pr-4">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] text-[#0A0A0A] font-medium">{supplier.name}</p>
                      {supplier.isPreferred && <HiStar className="w-3.5 h-3.5 text-[#EA580C]" />}
                    </div>
                  </EditorialTd>
                  <EditorialTd className="font-mono tracking-wide">{supplier.code || '—'}</EditorialTd>
                  <EditorialTd>{supplier.contactPerson || '—'}</EditorialTd>
                  <EditorialTd>{supplier.email || '—'}</EditorialTd>
                  <EditorialTd className="tabular-nums">{supplier.phone || '—'}</EditorialTd>
                  <EditorialTd className="italic font-light">
                    {supplier.businessType?.replace('_', ' ') || '—'}
                  </EditorialTd>
                  <EditorialTd>
                    <span className={`text-[10px] uppercase tracking-[0.28em] ${tone}`}>
                      {supplier.status.replace('_', ' ')}
                    </span>
                  </EditorialTd>
                  <EditorialTd align="right">
                    <div className="flex items-center justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/suppliers/${supplier.id}`}
                        title={`View ${supplier.name}`}
                        className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                      >
                        <HiEye className="h-3.5 w-3.5" />
                      </Link>
                      {canEditSuppliers && (
                        <button
                          onClick={() => openEditDialog(supplier)}
                          title={`Edit ${supplier.name}`}
                          className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                        >
                          <HiPencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDeleteSuppliers && (
                        <button
                          onClick={() => handleDeleteSupplier(supplier)}
                          title={`Delete ${supplier.name}`}
                          className="text-[#6B7280] hover:text-[#DC2626] transition-colors"
                        >
                          <HiTrash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </EditorialTd>
                </EditorialTr>
              )
            })
          )}
        </tbody>
      </EditorialTable>

      <EditorialModal
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        kicker="Suppliers"
        title="New supplier"
        description="Capture a new supplier or vendor record for the network."
        size="2xl"
      >
        <SupplierForm
          onSubmit={handleCreateSupplier}
          onCancel={() => setShowCreateDialog(false)}
          loading={actionLoading}
        />
      </EditorialModal>

      <EditorialModal
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open)
          if (!open) setSelectedSupplier(null)
        }}
        kicker="Suppliers"
        title={selectedSupplier ? `Edit ${selectedSupplier.name}` : 'Edit supplier'}
        size="2xl"
      >
        {selectedSupplier && (
          <SupplierForm
            supplier={selectedSupplier}
            onSubmit={handleUpdateSupplier}
            onCancel={() => {
              setShowEditDialog(false)
              setSelectedSupplier(null)
            }}
            loading={actionLoading}
          />
        )}
      </EditorialModal>

      <EditorialModal
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        kicker="Delete supplier"
        kickerTone="danger"
        title={supplierToDelete ? `Remove ${supplierToDelete.name}?` : 'Remove supplier?'}
        description="This action cannot be undone."
      >
        <EditorialMeta className="italic">
          Removing this supplier may affect linked products and historical records.
        </EditorialMeta>
        <EditorialModalFooter>
          <EditorialButton variant="ghost" onClick={() => setShowDeleteDialog(false)}>
            Cancel
          </EditorialButton>
          <EditorialButton variant="primary" arrow onClick={confirmDelete} disabled={actionLoading}>
            {actionLoading ? 'Deleting…' : 'Delete'}
          </EditorialButton>
        </EditorialModalFooter>
      </EditorialModal>
    </EditorialPage>
  )
}
