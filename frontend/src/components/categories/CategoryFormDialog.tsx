import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ProductCategory, CreateCategoryRequest, UpdateCategoryRequest } from "@/types/inventory/category.types"

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  category?: ProductCategory | null
  onSubmit: (data: CreateCategoryRequest | UpdateCategoryRequest) => void
  loading?: boolean
}

export function CategoryFormDialog({ 
  open, 
  onOpenChange, 
  mode, 
  category, 
  onSubmit, 
  loading = false 
}: CategoryFormDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: 1,
    isActive: true,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Update form when category changes
  useEffect(() => {
    if (mode === 'edit' && category) {
      setFormData({
        name: category.name,
        description: category.description || '',
        level: category.level ?? 1,
        isActive: category.isActive ?? true,
      })
    } else {
      setFormData({
        name: '',
        description: '',
        level: 1,
        isActive: true,
      })
    }
    setErrors({})
  }, [mode, category, open])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters'
    } else if (formData.name.length > 200) {
      newErrors.name = 'Name must be 200 characters or less'
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less'
    }

    if (formData.level < 1) {
      newErrors.level = 'Level must be at least 1'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return

    const submitData = mode === 'edit' && category 
      ? { id: category.id, ...formData }
      : formData

    onSubmit(submitData)
  }

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const title = mode === 'create' ? 'Create New Category' : 'Edit Category'
  const submitText = mode === 'create' ? 'Create' : 'Save Changes'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter category name"
              maxLength={200}
              className={errors.name ? 'border-red-500' : ''}
              disabled={loading}
            />
            <div className="flex justify-between">
              {errors.name ? (
                <p className="text-sm text-red-500">{errors.name}</p>
              ) : <span />}
              <p className="text-xs text-gray-400">{formData.name.length}/200</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter category description (optional)"
              maxLength={500}
              className={errors.description ? 'border-red-500' : ''}
              disabled={loading}
            />
            <div className="flex justify-between">
              {errors.description ? (
                <p className="text-sm text-red-500">{errors.description}</p>
              ) : <span />}
              <p className="text-xs text-gray-400">{formData.description.length}/500</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="level">Level</Label>
            <Input
              id="level"
              type="number"
              min={1}
              value={formData.level}
              onChange={(e) => handleInputChange('level', Math.max(1, parseInt(e.target.value) || 1))}
              className={errors.level ? 'border-red-500' : ''}
              disabled={loading}
            />
            {errors.level && (
              <p className="text-sm text-red-500">{errors.level}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => handleInputChange('isActive', checked)}
              disabled={loading}
            />
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
            onClick={handleSubmit}
            disabled={loading || !formData.name.trim()}
          >
            {loading ? 'Saving...' : submitText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
