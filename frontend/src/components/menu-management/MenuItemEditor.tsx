"use client"

import React, { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NavigationItem } from '@/components/navigation/types/navigation.types'
import { IconPicker } from './IconPicker'
import { Badge } from '@/components/ui/badge'
import { HiTrash, HiPlus } from 'react-icons/hi2'
import { X as HiX } from 'lucide-react'

interface MenuItemEditorProps {
  item: NavigationItem
  onUpdate: (item: NavigationItem) => void
  onDelete: () => void
}

const availableRoles = ['staff', 'admin', 'super_admin']

const permissionCategories = [
  'inventory', 'transactions', 'reports', 'userManagement', 
  'dataAccess', 'systemAdmin', 'suppliers', 'blends', 'bundles'
]

export function MenuItemEditor({ item, onUpdate, onDelete }: MenuItemEditorProps) {
  const [formData, setFormData] = useState(item)
  const [newPermission, setNewPermission] = useState({ category: '', permission: '' })

  useEffect(() => {
    setFormData(item)
  }, [item])

  const handleChange = (field: string, value: unknown) => {
    const updated = { ...formData, [field]: value }
    setFormData(updated)
    onUpdate(updated)
  }

  const handleVisibilityChange = (field: string, value: unknown) => {
    const updated = {
      ...formData,
      visibility: {
        ...formData.visibility,
        [field]: value
      }
    }
    setFormData(updated)
    onUpdate(updated)
  }

  const handleAddRole = (role: string) => {
    const currentRoles = formData.visibility?.roles || []
    if (!currentRoles.includes(role)) {
      handleVisibilityChange('roles', [...currentRoles, role])
    }
  }

  const handleRemoveRole = (role: string) => {
    const currentRoles = formData.visibility?.roles || []
    handleVisibilityChange('roles', currentRoles.filter(r => r !== role))
  }

  const handleAddPermission = () => {
    if (!newPermission.category || !newPermission.permission) return
    
    const currentPermissions = formData.visibility?.permissions || []
    const exists = currentPermissions.some(
      p => p.category === newPermission.category && p.permission === newPermission.permission
    )
    
    if (!exists) {
      handleVisibilityChange('permissions', [...currentPermissions, { ...newPermission }])
      setNewPermission({ category: '', permission: '' })
    }
  }

  const handleRemovePermission = (index: number) => {
    const currentPermissions = formData.visibility?.permissions || []
    handleVisibilityChange('permissions', currentPermissions.filter((_, i) => i !== index))
  }

  const handleBadgeChange = (field: string, value: unknown) => {
    const updated = {
      ...formData,
      badge: {
        ...formData.badge,
        [field]: value,
        text: field === 'text' ? String(value) : (formData.badge?.text || '')
      }
    }
    setFormData(updated)
    onUpdate(updated)
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="visibility">Visibility</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Menu item name"
            />
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="href">URL Path</Label>
            <Input
              id="href"
              value={formData.href}
              onChange={(e) => handleChange('href', e.target.value)}
              placeholder="/path/to/page"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Optional description for this menu item"
              rows={3}
            />
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <IconPicker
              value={formData.icon as string}
              onChange={(icon) => handleChange('icon', icon)}
            />
          </div>
        </TabsContent>

        <TabsContent value="visibility" className="space-y-4">
          {/* Roles */}
          <div className="space-y-2">
            <Label>Required Roles</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(formData.visibility?.roles || []).map((role) => (
                <Badge key={role} variant="secondary" className="flex items-center gap-1">
                  {role}
                  <button
                    onClick={() => handleRemoveRole(role)}
                    className="ml-1 hover:text-red-500"
                  >
                    <HiX className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Select onValueChange={handleAddRole}>
              <SelectTrigger>
                <SelectValue placeholder="Add role requirement" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <Label>Required Permissions</Label>
            <div className="space-y-2 mb-2">
              {(formData.visibility?.permissions || []).map((perm, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <span className="text-sm">
                    <strong>{String(perm.category)}</strong>: {String(perm.permission)}
                  </span>
                  <button
                    onClick={() => handleRemovePermission(index)}
                    className="ml-auto text-red-500 hover:text-red-700"
                  >
                    <HiTrash className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Select 
                value={newPermission.category}
                onValueChange={(value) => setNewPermission({ ...newPermission, category: value })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {permissionCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input
                className="flex-1"
                placeholder="Permission"
                value={newPermission.permission}
                onChange={(e) => setNewPermission({ ...newPermission, permission: e.target.value })}
              />
              
              <Button
                size="sm"
                onClick={handleAddPermission}
                disabled={!newPermission.category || !newPermission.permission}
              >
                <HiPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          {/* Badge */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="badge-enabled">Show Badge</Label>
                <Switch
                  id="badge-enabled"
                  checked={!!formData.badge}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleChange('badge', { text: '', variant: 'default' })
                    } else {
                      handleChange('badge', undefined)
                    }
                  }}
                />
              </div>
              
              {formData.badge && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="badge-text">Badge Text</Label>
                    <Input
                      id="badge-text"
                      value={formData.badge.text || ''}
                      onChange={(e) => handleBadgeChange('text', e.target.value)}
                      placeholder="New"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="badge-variant">Badge Style</Label>
                    <Select
                      value={formData.badge.variant || 'default'}
                      onValueChange={(value) => handleBadgeChange('variant', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="secondary">Secondary</SelectItem>
                        <SelectItem value="destructive">Destructive</SelectItem>
                        <SelectItem value="outline">Outline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {formData.badge.text && (
                    <div className="pt-2">
                      <Label>Preview</Label>
                      <div className="mt-2">
                        <Badge variant={formData.badge.variant as 'default' | 'secondary' | 'destructive' | 'outline'}>
                          {formData.badge.text}
                        </Badge>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Delete Button */}
          <div className="pt-4 border-t">
            <Button
              variant="destructive"
              onClick={onDelete}
              className="w-full"
            >
              <HiTrash className="h-4 w-4 mr-2" />
              Delete Menu Item
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}