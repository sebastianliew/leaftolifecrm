"use client"

import { useState, useEffect } from 'react'
import { BundleList } from "@/components/bundles/BundleList"
import { BundleForm } from "@/components/bundles/BundleForm"
import { useToast } from "@/components/ui/use-toast"
import type { Bundle, BundleFormData } from '@/types/bundle'
import type { Product } from '@/types/inventory/product.types'
import {
  useCreateBundleMutation,
  useUpdateBundleMutation,
  useBundleCategoriesQuery
} from "@/hooks/queries/use-bundles-query"
import { useInventory } from "@/hooks/queries/use-inventory-queries"
import { useBlendTemplates } from "@/hooks/useBlendTemplates"
import { usePermissions } from "@/hooks/usePermissions"
import { EditorialPage, EditorialModal } from "@/components/ui/editorial"

export default function BundlesPage() {
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const [showForm, setShowForm] = useState(false)
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null)
  const [viewingBundle, setViewingBundle] = useState<Bundle | null>(null)

  const { data: categories = [] } = useBundleCategoriesQuery()
  const { data: inventoryData } = useInventory({ limit: 1000 })
  const rawProducts = inventoryData?.products || []
  const { templates: blendTemplates, getTemplates } = useBlendTemplates()
  const products = rawProducts as Product[]

  const createBundleMutation = useCreateBundleMutation()
  const updateBundleMutation = useUpdateBundleMutation()

  const canCreateBundles = hasPermission('bundles', 'canCreateBundles')
  const canEditBundles = hasPermission('bundles', 'canEditBundles')
  const canDeleteBundles = hasPermission('bundles', 'canDeleteBundles')
  const canSetPricing = hasPermission('bundles', 'canSetPricing')

  useEffect(() => {
    getTemplates({ isActive: true })
  }, [getTemplates])

  const handleCreateNew = () => {
    setEditingBundle(null)
    setShowForm(true)
  }

  const handleEdit = (bundle: Bundle) => {
    setEditingBundle(bundle)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingBundle(null)
  }

  const handleSubmit = async (data: BundleFormData) => {
    try {
      if (editingBundle) {
        await updateBundleMutation.mutateAsync({ id: editingBundle._id, data })
        toast({ title: "Success", description: "Bundle updated successfully" })
      } else {
        await createBundleMutation.mutateAsync(data)
        toast({ title: "Success", description: "Bundle created successfully" })
      }
      handleCloseForm()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save bundle",
        variant: "destructive",
      })
    }
  }

  const loading = createBundleMutation.isPending || updateBundleMutation.isPending

  return (
    <EditorialPage>
      <BundleList
        onCreateNew={canCreateBundles ? handleCreateNew : undefined}
        onEdit={canEditBundles ? handleEdit : undefined}
        onView={setViewingBundle}
        canDelete={canDeleteBundles}
      />

      <EditorialModal
        open={showForm}
        onOpenChange={(open) => !open && handleCloseForm()}
        kicker="Bundles"
        title={editingBundle ? `Edit ${editingBundle.name}` : 'New bundle'}
        description="Group products and blends into a discounted bundle for sale."
        size="2xl"
      >
        <BundleForm
          bundle={editingBundle || undefined}
          products={products}
          blendTemplates={blendTemplates}
          categories={categories}
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
          loading={loading}
          canManagePricing={canSetPricing}
        />
      </EditorialModal>

      <EditorialModal
        open={!!viewingBundle}
        onOpenChange={(open) => !open && setViewingBundle(null)}
        kicker="Bundle"
        title={viewingBundle?.name || 'Bundle details'}
        description={viewingBundle?.description}
        size="xl"
      >
        {viewingBundle && (
          <div className="space-y-7">
            <div className="grid grid-cols-2 gap-10 border-b border-[#E5E7EB] pb-7">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Category</p>
                <p className="text-sm text-[#0A0A0A] mt-1">{viewingBundle.category || '—'}</p>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280] mt-4">Status</p>
                <p className="text-sm text-[#0A0A0A] mt-1">{viewingBundle.isActive ? 'Active' : 'Inactive'}</p>
                {viewingBundle.isPromoted && (
                  <>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-[#EA580C] mt-4">Promotion</p>
                    <p className="text-sm text-[#0A0A0A] mt-1">{viewingBundle.promotionText}</p>
                  </>
                )}
              </div>
              <div className="text-right">
                <p className="font-light text-[44px] leading-none tabular-nums text-[#16A34A]">
                  S${viewingBundle.bundlePrice?.toFixed(2)}
                </p>
                <p className="text-sm text-[#9CA3AF] line-through tabular-nums mt-2">
                  S${viewingBundle.individualTotalPrice?.toFixed(2)}
                </p>
                <p className="text-xs text-[#DC2626] italic mt-1 font-light">
                  Save {viewingBundle.savingsPercentage}% (S${viewingBundle.savings?.toFixed(2)})
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280] mb-4">Contents</p>
              <div className="space-y-2">
                {viewingBundle.bundleProducts?.map((product, index) => (
                  <div key={index} className="flex justify-between items-center py-3 border-b border-[#E5E7EB]">
                    <div>
                      <span className="text-sm text-[#0A0A0A] font-medium">{product.name}</span>
                      <span className="text-xs text-[#9CA3AF] ml-3 italic font-light">×{product.quantity}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm tabular-nums text-[#0A0A0A]">S${(product.quantity * product.individualPrice).toFixed(2)}</p>
                      <p className="text-[11px] text-[#9CA3AF] tabular-nums">S${product.individualPrice} each</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {viewingBundle.tags && viewingBundle.tags.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280] mb-3">Tags</p>
                <div className="flex flex-wrap gap-3">
                  {viewingBundle.tags.map(tag => (
                    <span key={tag} className="text-[11px] uppercase tracking-[0.22em] text-[#0A0A0A] border border-[#0A0A0A] px-3 py-1">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </EditorialModal>
    </EditorialPage>
  )
}
