import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"
import type { ProductCategory } from "@/types/inventory/category.types"

interface CategoryDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: ProductCategory | null
  onConfirm: () => void
  loading?: boolean
}

export function CategoryDeleteDialog({ 
  open, 
  onOpenChange, 
  category, 
  onConfirm, 
  loading = false 
}: CategoryDeleteDialogProps) {
  if (!category) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Delete Category
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 mb-3">
              Are you sure you want to delete this category? This action cannot be undone.
            </p>
            
            <div className="space-y-2">
              <div>
                <span className="font-medium text-red-900">Category:</span>
                <span className="ml-2 text-red-800">{category.name}</span>
              </div>
              
              {category.description && (
                <div>
                  <span className="font-medium text-red-900">Description:</span>
                  <span className="ml-2 text-red-800">{category.description}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <span className="font-medium text-red-900">Level:</span>
                <Badge variant="secondary">{category.level}</Badge>
                <span className="font-medium text-red-900">Status:</span>
                <Badge variant={category.isActive ? "default" : "secondary"}>
                  {category.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>Warning:</strong> If this category is used by products or other categories, 
              the deletion may fail. Please ensure no dependencies exist before proceeding.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}