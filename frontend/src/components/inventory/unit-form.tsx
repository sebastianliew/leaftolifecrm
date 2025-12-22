"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { UnitOfMeasurement } from "@/types/inventory"

interface UnitFormProps {
  unit: Partial<UnitOfMeasurement>
  onSubmit: (data: Partial<UnitOfMeasurement>) => Promise<void>
  onCancel: () => void
  loading?: boolean
  units: UnitOfMeasurement[]
}

export function UnitForm({ unit, onSubmit, onCancel, loading, units }: UnitFormProps) {
  const [formData, setFormData] = useState<Partial<UnitOfMeasurement>>({
    name: unit?.name || "",
    abbreviation: unit?.abbreviation || "",
    description: unit?.description || "",
    type: unit?.type || ("weight" as const),
    isActive: unit?.isActive !== undefined ? unit.isActive : true,
    baseUnit: unit?.baseUnit || "",
    conversionRate: unit?.conversionRate || undefined,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Enter unit name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="abbreviation">Abbreviation</Label>
          <Input
            id="abbreviation"
            value={formData.abbreviation}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, abbreviation: e.target.value }))
            }
            placeholder="Enter unit abbreviation"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Enter unit description"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select
            value={formData.type}
            onValueChange={(value: "weight" | "volume" | "count" | "length") =>
              setFormData((prev) => ({ ...prev, type: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weight">Weight</SelectItem>
              <SelectItem value="volume">Volume</SelectItem>
              <SelectItem value="count">Count</SelectItem>
              <SelectItem value="length">Length</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="baseUnit">Base Unit</Label>
          <Select
            value={formData.baseUnit || ""}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, baseUnit: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select base unit" />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => {
                const unitId = unit.id || unit._id || `unit-${unit.name}-${unit.abbreviation}`
                return (
                  <SelectItem key={unitId} value={unitId}>
                    {unit.name} ({unit.abbreviation})
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="conversionRate">Conversion Rate</Label>
          <Input
            id="conversionRate"
            type="number"
            step="0.01"
            value={formData.conversionRate !== undefined ? formData.conversionRate.toString() : ""}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                conversionRate: e.target.value === "" ? undefined : parseFloat(e.target.value),
              }))
            }
            placeholder="Enter conversion rate to base unit"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, isActive: checked }))
            }
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : unit?.id ? "Update Unit" : "Create Unit"}
        </Button>
      </div>
    </form>
  )
} 