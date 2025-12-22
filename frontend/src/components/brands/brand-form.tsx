"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { HiTag } from "react-icons/hi2"
import type {
  BrandFormData,
  BrandStatus,
} from "@/types/brands"

// Type for partial brand data from API
type PartialBrand = {
  _id?: string;
  name?: string;
  description?: string;
  active?: boolean;
  status?: BrandStatus;
}

interface BrandFormProps {
  brand?: PartialBrand
  onSubmit: (data: BrandFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export function BrandForm({ brand, onSubmit, onCancel, loading }: BrandFormProps) {
  const [formData, setBrandFormData] = useState<BrandFormData>({
    name: brand?.name || "",
    code: brand?._id?.slice(-6) || "",
    description: brand?.description || "",
    website: "",
    contactEmail: "",
    contactPhone: "",
    status: brand?.status || "active",
    isActive: brand?.active ?? true,
    isExclusive: false,
    categories: [],
    qualityStandards: [],
  })

  const handleInputChange = (field: keyof BrandFormData, value: BrandFormData[keyof BrandFormData]) => {
    setBrandFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Only validate brand name is provided
    if (!formData.name?.trim()) {
      alert('Please enter a brand name')
      return
    }
    
    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HiTag className="w-5 h-5" />
            Basic Information
          </CardTitle>
          <CardDescription>Brand identification and basic details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Brand Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter brand name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Brand Code</Label>
              <Input
                id="code"
                value={formData.code || "Will be auto-generated"}
                readOnly
                className="bg-gray-50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HiTag className="w-5 h-5" />
            Contact Information
          </CardTitle>
          <CardDescription>Brand contact details and online presence</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website || ""}
                onChange={(e) => handleInputChange("website", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail || ""}
                onChange={(e) => handleInputChange("contactEmail", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={formData.contactPhone || ""}
                onChange={(e) => handleInputChange("contactPhone", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Flags */}
      <Card>
        <CardHeader>
          <CardTitle>Status & Preferences</CardTitle>
          <CardDescription>Brand status flags and business preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => handleInputChange("isActive", checked)}
            />
            <Label htmlFor="isActive">Brand is Active</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isExclusive"
              checked={formData.isExclusive}
              onCheckedChange={(checked) => handleInputChange("isExclusive", checked)}
            />
            <Label htmlFor="isExclusive">Exclusive Brand Partnership</Label>
          </div>
        </CardContent>
      </Card>

      {/* Submit Buttons */}
      <div className="flex justify-end gap-4 p-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Brand"}
        </Button>
      </div>
    </form>
  )
}
