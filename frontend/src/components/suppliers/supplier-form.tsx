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
import { HiBuildingOffice } from "react-icons/hi2"
import { FiPhone } from "react-icons/fi"
import type {
  Supplier,
  SupplierFormData,
  BusinessType,
} from "@/types/suppliers/supplier.types"

interface SupplierFormProps {
  supplier?: Supplier
  onSubmit: (data: SupplierFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export function SupplierForm({ supplier, onSubmit, onCancel, loading }: SupplierFormProps) {
  const [formData, setFormData] = useState<SupplierFormData>({
    name: "",
    code: "",
    description: "",
    contactPerson: "",
    email: "",
    phone: "",
    fax: "",
    website: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    businessType: "manufacturer",
    status: "active",
    isActive: true,
    isPreferred: false,
    requiresApproval: false,
    ...supplier,
  })

  const handleInputChange = (field: keyof SupplierFormData, value: SupplierFormData[keyof SupplierFormData]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HiBuildingOffice className="w-5 h-5" />
            Basic Information
          </CardTitle>
          <CardDescription>Supplier identification and basic details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Supplier Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value as string)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Supplier Code</Label>
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
              onChange={(e) => handleInputChange("description", e.target.value as string)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type</Label>
              <Select
                value={formData.businessType}
                onValueChange={(value) => handleInputChange("businessType", value as BusinessType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manufacturer">Manufacturer</SelectItem>
                  <SelectItem value="distributor">Distributor</SelectItem>
                  <SelectItem value="wholesaler">Wholesaler</SelectItem>
                  <SelectItem value="retailer">Retailer</SelectItem>
                  <SelectItem value="service_provider">Service Provider</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value as string)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="blacklisted">Blacklisted</SelectItem>
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
            <FiPhone className="w-5 h-5" />
            Contact Information
          </CardTitle>
          <CardDescription>Contact details and communication preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson || ""}
                onChange={(e) => handleInputChange("contactPerson", e.target.value as string)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => handleInputChange("email", e.target.value as string)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone || ""}
                onChange={(e) => handleInputChange("phone", e.target.value as string)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fax">Fax</Label>
              <Input
                id="fax"
                type="tel"
                value={formData.fax || ""}
                onChange={(e) => handleInputChange("fax", e.target.value as string)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website || ""}
                onChange={(e) => handleInputChange("website", e.target.value as string)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              value={formData.address || ""}
              onChange={(e) => handleInputChange("address", e.target.value as string)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city || ""}
                onChange={(e) => handleInputChange("city", e.target.value as string)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State/Province</Label>
              <Input
                id="state"
                value={formData.state || ""}
                onChange={(e) => handleInputChange("state", e.target.value as string)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                id="postalCode"
                value={formData.postalCode || ""}
                onChange={(e) => handleInputChange("postalCode", e.target.value as string)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country || ""}
                onChange={(e) => handleInputChange("country", e.target.value as string)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Flags */}
      <Card>
        <CardHeader>
          <CardTitle>Status & Preferences</CardTitle>
          <CardDescription>Supplier status flags and preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => handleInputChange("isActive", checked as boolean)}
            />
            <Label htmlFor="isActive">Supplier is Active</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isPreferred"
              checked={formData.isPreferred}
              onCheckedChange={(checked) => handleInputChange("isPreferred", checked as boolean)}
            />
            <Label htmlFor="isPreferred">Preferred Supplier</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="requiresApproval"
              checked={formData.requiresApproval}
              onCheckedChange={(checked) => handleInputChange("requiresApproval", checked as boolean)}
            />
            <Label htmlFor="requiresApproval">Requires Approval for Orders</Label>
          </div>
        </CardContent>
      </Card>

      {/* Submit Buttons */}
      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : supplier ? "Update Supplier" : "Create Supplier"}
        </Button>
      </div>
    </form>
  )
}
