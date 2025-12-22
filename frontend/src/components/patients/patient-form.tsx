"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { DateInput } from "@/components/ui/date-input"
import type { Patient, PatientFormData } from "@/types/patient"

interface PatientFormProps {
  patient?: Patient
  onSubmit: (data: PatientFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export function PatientForm({ patient, onSubmit, onCancel, loading }: PatientFormProps) {
  const [formData, setFormData] = useState<PatientFormData>({
    firstName: "",
    middleName: "",
    lastName: "",
    nric: "",
    dateOfBirth: "",
    gender: "male",
    bloodType: undefined,
    maritalStatus: undefined,
    occupation: "",
    email: "",
    phone: "",
    altPhone: "",
    fax: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    status: "active",
    hasConsent: false,
    ...patient,
  })

  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(() => {
    if (patient?.dateOfBirth) {
      try {
        return new Date(patient.dateOfBirth)
      } catch (error) {
        console.error("Invalid date format:", error)
        return undefined
      }
    }
    return undefined
  })

  useEffect(() => {
    if (dateOfBirth) {
      try {
        const formattedDate = dateOfBirth.toISOString().split("T")[0]
        setFormData((prev) => ({ ...prev, dateOfBirth: formattedDate }))
      } catch (error) {
        console.error("Error formatting date:", error)
      }
    }
  }, [dateOfBirth])

  const handleInputChange = (field: keyof PatientFormData, value: PatientFormData[keyof PatientFormData]) => {
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
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Patient identification and personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                value={formData.middleName || ""}
                onChange={(e) => handleInputChange("middleName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nric">NRIC *</Label>
              <Input
                id="nric"
                value={formData.nric || ""}
                onChange={(e) => handleInputChange("nric", e.target.value.toUpperCase())}
                placeholder="S1234567A"
                required
              />
              <p className="text-xs text-gray-500">
                Singapore NRIC format: S/T/F/G followed by 7 digits and 1 letter
              </p>
            </div>
            <div className="space-y-2">
              <Label>Date of Birth *</Label>
              <DateInput
                value={dateOfBirth}
                onChange={(date) => setDateOfBirth(date)}
                placeholder="DD/MM/YYYY"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select value={formData.gender} onValueChange={(value) => handleInputChange("gender", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bloodType">Blood Type</Label>
              <Select value={formData.bloodType || ""} onValueChange={(value) => handleInputChange("bloodType", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select blood type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="AB+">AB+</SelectItem>
                  <SelectItem value="AB-">AB-</SelectItem>
                  <SelectItem value="O+">O+</SelectItem>
                  <SelectItem value="O-">O-</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maritalStatus">Marital Status</Label>
              <Select
                value={formData.maritalStatus || ""}
                onValueChange={(value) => handleInputChange("maritalStatus", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select marital status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="married">Married</SelectItem>
                  <SelectItem value="divorced">Divorced</SelectItem>
                  <SelectItem value="widowed">Widowed</SelectItem>
                  <SelectItem value="separated">Separated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="occupation">Occupation</Label>
            <Input
              id="occupation"
              value={formData.occupation || ""}
              onChange={(e) => handleInputChange("occupation", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Patient contact details and address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Primary Phone *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="altPhone">Alternative Phone</Label>
              <Input
                id="altPhone"
                type="tel"
                value={formData.altPhone || ""}
                onChange={(e) => handleInputChange("altPhone", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fax">Fax Number</Label>
              <Input
                id="fax"
                type="tel"
                value={formData.fax || ""}
                onChange={(e) => handleInputChange("fax", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              value={formData.address || ""}
              onChange={(e) => handleInputChange("address", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city || ""}
                onChange={(e) => handleInputChange("city", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State/Province</Label>
              <Input
                id="state"
                value={formData.state || ""}
                onChange={(e) => handleInputChange("state", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                id="postalCode"
                value={formData.postalCode || ""}
                onChange={(e) => handleInputChange("postalCode", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status and Consent */}
      <Card>
        <CardHeader>
          <CardTitle>Status & Consent</CardTitle>
          <CardDescription>Patient status and consent information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="consent"
              checked={formData.hasConsent}
              onCheckedChange={(checked) => handleInputChange("hasConsent", checked)}
            />
            <Label htmlFor="consent" className="text-sm">
              Patient has provided consent for data collection and treatment
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Member Discount */}
      <Card>
        <CardHeader>
          <CardTitle>Member Benefits</CardTitle>
          <CardDescription>Set member discount rate for this patient</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="membershipTier">Membership Tier</Label>
            <Select 
              value={formData.memberBenefits?.membershipTier || "standard"} 
              onValueChange={(value) => {
                const tierDiscounts = {
                  standard: 0,
                  silver: 10,
                  vip: 20,
                  platinum: 40
                } as const
                const tier = value as 'standard' | 'silver' | 'vip' | 'platinum'
                handleInputChange("memberBenefits", {
                  ...formData.memberBenefits,
                  membershipTier: tier,
                  discountPercentage: tierDiscounts[tier]
                })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard (No Discount)</SelectItem>
                <SelectItem value="silver">Silver (10% Discount)</SelectItem>
                <SelectItem value="vip">VIP (20% Discount)</SelectItem>
                <SelectItem value="platinum">Platinum (40% Discount)</SelectItem>
              </SelectContent>
            </Select>
            
            {formData.memberBenefits?.discountPercentage && formData.memberBenefits.discountPercentage > 0 && (
              <div className="p-3 bg-purple-50 rounded-md">
                <p className="text-sm font-medium text-purple-800">
                  Current Discount: {formData.memberBenefits.discountPercentage}%
                </p>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground">
              This discount will be automatically applied to eligible products during checkout
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Submit Buttons */}
      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : patient ? "Update Patient" : "Create Patient"}
        </Button>
      </div>
    </form>
  )
}
