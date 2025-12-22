"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BundleList } from "@/components/bundles/BundleList"
import { BundleForm } from "@/components/bundles/BundleForm"
import { useToast } from "@/components/ui/use-toast"
import type { Bundle, BundleFormData } from '@/types/bundle'
import type { ProductCategory } from '@/types/inventory/product.types'
import {
  useCreateBundleMutation,
  useUpdateBundleMutation,
  useBundleCategoriesQuery
} from "@/hooks/queries/use-bundles-query"
import { useInventory } from "@/hooks/queries/use-inventory-queries"
import { useBlendTemplates } from "@/hooks/useBlendTemplates"
import { usePermissions } from "@/hooks/usePermissions"

export default function BundlesPage() {
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const [showForm, setShowForm] = useState(false)
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null)
  const [viewingBundle, setViewingBundle] = useState<Bundle | null>(null)

  // Data queries
  const { data: categories = [] } = useBundleCategoriesQuery()
  const { data: rawProducts = [] } = useInventory()
  const { templates: blendTemplates, getTemplates } = useBlendTemplates()

  // Transform products to ensure category is always a ProductCategory object
  const products = rawProducts.map(product => ({
    ...product,
    category: typeof product.category === 'string' 
      ? { _id: '', name: product.category, level: 1, isActive: true } as ProductCategory
      : product.category as ProductCategory
  }))

  // Mutations
  const createBundleMutation = useCreateBundleMutation()
  const updateBundleMutation = useUpdateBundleMutation()

  // Permissions
  const canCreateBundles = hasPermission('bundles', 'canCreateBundles')
  const canEditBundles = hasPermission('bundles', 'canEditBundles')
  const canDeleteBundles = hasPermission('bundles', 'canDeleteBundles')
  const canSetPricing = hasPermission('bundles', 'canSetPricing')

  // Fetch blend templates on component mount
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

  const handleView = (bundle: Bundle) => {
    setViewingBundle(bundle)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingBundle(null)
  }

  const handleSubmit = async (data: BundleFormData) => {
    try {
      if (editingBundle) {
        await updateBundleMutation.mutateAsync({
          id: editingBundle._id,
          data
        })
        toast({
          title: "Success",
          description: "Bundle updated successfully",
        })
      } else {
        await createBundleMutation.mutateAsync(data)
        toast({
          title: "Success", 
          description: "Bundle created successfully",
        })
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
    <div className="container mx-auto py-8 space-y-6">
      {/* Bundle List */}
      <BundleList
        onCreateNew={canCreateBundles ? handleCreateNew : undefined}
        onEdit={canEditBundles ? handleEdit : undefined}
        onView={handleView}
        canDelete={canDeleteBundles}
      />

      {/* Bundle Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBundle ? 'Edit Bundle' : 'Create New Bundle'}
            </DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>

      {/* Bundle View Dialog */}
      <Dialog open={!!viewingBundle} onOpenChange={() => setViewingBundle(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bundle Details</DialogTitle>
          </DialogHeader>
          {viewingBundle && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-lg">{viewingBundle.name}</h3>
                  <p className="text-gray-600">{viewingBundle.description}</p>
                  <div className="mt-2 space-y-1">
                    <p><strong>Category:</strong> {viewingBundle.category || 'None'}</p>
                    <p><strong>Status:</strong> {viewingBundle.isActive ? 'Active' : 'Inactive'}</p>
                    {viewingBundle.isPromoted && (
                      <p><strong>Promotion:</strong> {viewingBundle.promotionText}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    S${viewingBundle.bundlePrice?.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500 line-through">
                    S${viewingBundle.individualTotalPrice?.toFixed(2)}
                  </div>
                  <div className="text-sm text-red-500">
                    Save {viewingBundle.savingsPercentage}% (S${viewingBundle.savings?.toFixed(2)})
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Bundle Contents</h4>
                <div className="space-y-2">
                  {viewingBundle.bundleProducts?.map((product, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{product.name}</span>
                        <span className="text-gray-500 ml-2">×{product.quantity}</span>
                      </div>
                      <div className="text-right">
                        <div>S${(product.quantity * product.individualPrice).toFixed(2)}</div>
                        <div className="text-sm text-gray-500">
                          S${product.individualPrice} each
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {viewingBundle.tags && viewingBundle.tags.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingBundle.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}