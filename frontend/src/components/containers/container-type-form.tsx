"use client"

import React, { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { useUnitsQuery } from "@/hooks/queries/use-units-query"
import { useToast } from "@/components/ui/use-toast"
import type { ContainerType } from "@/types/container"

interface ContainerTypeFormProps {
  containerType?: ContainerType
  onSubmit: (data: ContainerType) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export function ContainerTypeForm({ containerType, onSubmit, onCancel, loading }: ContainerTypeFormProps) {
  const { toast } = useToast()
  const { data: availableUoms = [], isLoading: isLoadingUoms, error: uomsError } = useUnitsQuery()

  // Convert unit names/abbreviations to ObjectIds if needed
  const convertToObjectIds = useCallback((allowedUoms: string[] = []) => {
    return allowedUoms.map(uom => {
      // If it's already an ObjectId (24 chars hex), return as is
      if (uom.match(/^[0-9a-fA-F]{24}$/)) {
        return uom
      }
      // Otherwise, find the unit by name or abbreviation and return its ObjectId
      const unit = availableUoms.find(u => u.name === uom || u.abbreviation === uom)
      return unit ? (unit._id || unit.id) : uom
    })
  }, [availableUoms])

  const [formData, setFormData] = useState<ContainerType>({
    id: containerType?.id || "",
    name: containerType?.name || "",
    description: containerType?.description || "",
    allowedUoms: containerType?.allowedUoms || [],
    isActive: containerType?.isActive ?? true,
    createdAt: containerType?.createdAt || new Date(),
    updatedAt: containerType?.updatedAt || new Date(),
  })

  // Update allowedUoms to use ObjectIds when availableUoms data is loaded
  React.useEffect(() => {
    if (availableUoms.length > 0 && containerType?.allowedUoms) {
      const objectIds = convertToObjectIds(containerType.allowedUoms)
      setFormData(prev => ({ ...prev, allowedUoms: objectIds }))
    }
  }, [availableUoms, containerType?.allowedUoms, convertToObjectIds])

  if (uomsError) {
    toast({
      title: "Error",
      description: "Failed to load units of measurement",
      variant: "destructive"
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  const handleInputChange = (
    field: keyof ContainerType,
    value: ContainerType[keyof ContainerType]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleUomToggle = (uomId: string) => {
    setFormData((prev) => {
      // Find the unit to get both possible identifiers
      const unit = availableUoms.find(u => (u._id || u.id) === uomId)
      const unitName = unit?.name
      const unitAbbr = unit?.abbreviation
      
      // Remove all possible variations of this unit (ObjectId, name, abbreviation)
      const cleanedUoms = prev.allowedUoms.filter(id => 
        id !== uomId && id !== unitName && id !== unitAbbr
      )
      
      // If the unit was not found in the cleaned array, add the ObjectId
      const isCurrentlySelected = prev.allowedUoms.includes(uomId) || 
                                prev.allowedUoms.includes(unitName || '') || 
                                prev.allowedUoms.includes(unitAbbr || '')
      
      return {
        ...prev,
        allowedUoms: isCurrentlySelected ? cleanedUoms : [...cleanedUoms, uomId],
      }
    })
  }

  // Helper function to get the correct unit ID for comparison and storage
  const getUnitId = (unit: { _id?: string; id?: string }): string => {
    return unit._id || unit.id || ''
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="e.g., Standard Bottle"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter container type description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Allowed Units of Measurement</Label>
            {isLoadingUoms ? (
              <div className="text-sm text-muted-foreground">Loading units...</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {availableUoms.map((uom) => {
                  const uomId = getUnitId(uom)
                  // Check if this unit is selected by comparing both ObjectId and unit name/abbreviation
                  // This handles cases where allowedUoms contains names instead of ObjectIds
                  const isChecked = formData.allowedUoms.includes(uomId) || 
                                  formData.allowedUoms.includes(uom.name) || 
                                  formData.allowedUoms.includes(uom.abbreviation)
                  
                  return (
                    <div key={uomId} className="flex items-center space-x-2">
                      <Checkbox
                        id={`uom-${uomId}`}
                        checked={isChecked}
                        onCheckedChange={() => handleUomToggle(uomId)}
                      />
                      <Label htmlFor={`uom-${uomId}`}>
                        {uom.name} ({uom.abbreviation || 'N/A'})
                      </Label>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => handleInputChange("isActive", checked)}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : containerType ? "Update Container Type" : "Create Container Type"}
        </Button>
      </div>
    </form>
  )
} 