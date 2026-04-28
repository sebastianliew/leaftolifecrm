"use client"

import React from 'react'
import { BrandForm } from "./brand-form"
import type { BrandFormData, BrandStatus } from "@/types/brands"
import { HiPencil, HiTrash } from "react-icons/hi2"
import {
  EditorialTable,
  EditorialTHead,
  EditorialTh,
  EditorialTr,
  EditorialTd,
  EditorialEmptyRow,
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
  EditorialMeta,
} from "@/components/ui/editorial"

type ApiBrand = {
  _id: string;
  name: string;
  description?: string;
  active: boolean;
  status?: BrandStatus;
}

interface BrandListProps {
  brands: ApiBrand[]
  loading: boolean
  onUpdateBrand: (id: string, data: BrandFormData) => Promise<void>
  onDeleteBrand: (brand: ApiBrand) => Promise<void>
  isSubmitting: boolean
}

const statusToneMap: Record<string, string> = {
  active: 'text-[#16A34A]',
  inactive: 'text-[#6B7280]',
  discontinued: 'text-[#DC2626]',
  pending_approval: 'text-[#EA580C]',
}

export function BrandList({
  brands,
  loading,
  onUpdateBrand,
  onDeleteBrand,
  isSubmitting,
}: BrandListProps) {
  const [editing, setEditing] = React.useState<ApiBrand | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<ApiBrand | null>(null)

  const handleUpdateBrand = async (data: BrandFormData) => {
    if (!editing) return
    try {
      await onUpdateBrand(editing._id, data)
      setEditing(null)
    } catch (error) {
      console.error('Failed to update brand:', error)
    }
  }

  if (loading) {
    return (
      <div className="mt-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">Loading</p>
        <p className="text-sm italic font-light text-[#6B7280] mt-3">Fetching the catalog…</p>
      </div>
    )
  }

  return (
    <>
      <EditorialTable>
        <EditorialTHead>
          <EditorialTh>Name</EditorialTh>
          <EditorialTh>Code</EditorialTh>
          <EditorialTh>Status</EditorialTh>
          <EditorialTh>Active</EditorialTh>
          <EditorialTh align="right" className="w-28">Actions</EditorialTh>
        </EditorialTHead>
        <tbody>
          {brands.length === 0 ? (
            <EditorialEmptyRow colSpan={5} description="No brands match the current filters." />
          ) : (
            brands.map((brand) => {
              const status = brand.status || 'active'
              const tone = statusToneMap[status] || 'text-[#6B7280]'
              return (
                <EditorialTr key={brand._id}>
                  <EditorialTd size="lg" className="pr-4">
                    <p className="text-[14px] text-[#0A0A0A] font-medium">{brand.name}</p>
                    {brand.description && (
                      <EditorialMeta className="italic font-light max-w-md truncate">{brand.description}</EditorialMeta>
                    )}
                  </EditorialTd>
                  <EditorialTd className="font-mono tracking-wide">{brand._id.slice(-6)}</EditorialTd>
                  <EditorialTd>
                    <span className={`text-[10px] uppercase tracking-[0.28em] ${tone}`}>
                      {status.replace('_', ' ')}
                    </span>
                  </EditorialTd>
                  <EditorialTd>
                    {brand.active ? (
                      <span className="text-[10px] uppercase tracking-[0.28em] text-[#16A34A]">Yes</span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-[0.28em] text-[#9CA3AF]">No</span>
                    )}
                  </EditorialTd>
                  <EditorialTd align="right">
                    <div className="flex items-center justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditing(brand)}
                        title={`Edit ${brand.name}`}
                        className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                      >
                        <HiPencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(brand)}
                        title={`Delete ${brand.name}`}
                        className="text-[#6B7280] hover:text-[#DC2626] transition-colors"
                      >
                        <HiTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </EditorialTd>
                </EditorialTr>
              )
            })
          )}
        </tbody>
      </EditorialTable>

      <EditorialModal
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        kicker="Brands"
        title={editing ? `Edit ${editing.name}` : 'Edit brand'}
        size="xl"
      >
        {editing && (
          <BrandForm
            brand={editing}
            onSubmit={handleUpdateBrand}
            onCancel={() => setEditing(null)}
            loading={isSubmitting}
          />
        )}
      </EditorialModal>

      <EditorialModal
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        kicker="Delete brand"
        kickerTone="danger"
        title={confirmDelete ? `Remove ${confirmDelete.name}?` : 'Remove brand?'}
        description="This action cannot be undone."
      >
        <EditorialModalFooter>
          <EditorialButton variant="ghost" onClick={() => setConfirmDelete(null)}>
            Cancel
          </EditorialButton>
          <EditorialButton
            variant="primary"
            arrow
            onClick={async () => {
              if (confirmDelete) {
                await onDeleteBrand(confirmDelete)
                setConfirmDelete(null)
              }
            }}
          >
            Delete
          </EditorialButton>
        </EditorialModalFooter>
      </EditorialModal>
    </>
  )
}
