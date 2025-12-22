"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { FaUsers, FaSearch } from "react-icons/fa"
import type { Patient } from "@/types/patient"
import type { TransactionFormData } from "@/types/transaction"

interface CustomerSectionProps {
  formData: TransactionFormData
  patients: Patient[]
  onCustomerChange: (updates: Partial<TransactionFormData>) => void
  disabled?: boolean
  selectedPatient?: Patient | null
}

export function CustomerSection({ formData, patients, onCustomerChange, disabled, selectedPatient }: CustomerSectionProps) {
  const [patientSearch, setPatientSearch] = useState("")
  const [patientModalOpen, setPatientModalOpen] = useState(false)

  const filteredPatients = patients.filter((patient) => {
    const searchLower = patientSearch.toLowerCase()
    const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase()
    const phone = patient.phone?.toLowerCase() || ""
    const email = patient.email?.toLowerCase() || ""
    const nric = patient.nric?.toLowerCase() || ""
    return fullName.includes(searchLower) || phone.includes(searchLower) || email.includes(searchLower) || nric.includes(searchLower)
  })

  const selectPatient = (patient: Patient) => {
    onCustomerChange({
      customerId: patient.id,
      customerName: `${patient.firstName} ${patient.lastName}`,
      customerEmail: patient.email || "",
      customerPhone: patient.phone || "",
      customerAddress: patient.address ? {
        street: patient.address,
        city: patient.city || "",
        state: patient.state || "",
        postalCode: patient.postalCode || ""
      } : undefined,
    })
    setPatientModalOpen(false)
    setPatientSearch("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FaUsers className="w-5 h-5" />
          Customer Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Dialog open={patientModalOpen} onOpenChange={setPatientModalOpen}>
            <DialogTrigger asChild>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full" 
                disabled={disabled}
              >
                <FaSearch className="w-4 h-4 mr-2" />
                Search Patients
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[600px] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Search Patients</DialogTitle>
              </DialogHeader>
              <div className="p-4">
                <Input
                  placeholder="Search by name, phone, or registration number..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="mb-4"
                />
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="space-y-2">
                  {filteredPatients.map((patient) => (
                    <div
                      key={patient.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-accent"
                      onClick={() => selectPatient(patient)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{patient.firstName} {patient.lastName}</p>
                          <p className="text-sm text-muted-foreground">{patient.phone}</p>
                          {patient.email && (
                            <p className="text-sm text-muted-foreground">{patient.email}</p>
                          )}
                          {patient.memberBenefits && (
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className="bg-purple-100 text-purple-800 text-xs">
                                {patient.memberBenefits.membershipTier}
                              </Badge>
                              {patient.memberBenefits.discountPercentage > 0 && (
                                <span className="text-xs text-green-600">
                                  {patient.memberBenefits.discountPercentage}% discount
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {patient.nric && (
                          <Badge variant="secondary">{patient.nric}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredPatients.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No patients found</p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="customerName">Name</Label>
            <Input
              id="customerName"
              value={formData.customerName}
              onChange={(e) => onCustomerChange({ customerName: e.target.value })}
              placeholder="Enter customer name"
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerPhone">Phone</Label>
            <Input
              id="customerPhone"
              type="tel"
              value={formData.customerPhone}
              onChange={(e) => onCustomerChange({ customerPhone: e.target.value })}
              placeholder="Enter phone number"
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerEmail">Email (Optional)</Label>
            <Input
              id="customerEmail"
              type="email"
              value={formData.customerEmail}
              onChange={(e) => onCustomerChange({ customerEmail: e.target.value })}
              placeholder="Enter email address"
              disabled={disabled}
            />
          </div>

        </div>

        {selectedPatient?.memberBenefits && (
          <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-md">
            <Badge className="bg-purple-100 text-purple-800 text-xs">
              {selectedPatient.memberBenefits.membershipTier}
            </Badge>
            {selectedPatient.memberBenefits.discountPercentage > 0 && (
              <span className="text-sm text-green-600 font-medium">
                {selectedPatient.memberBenefits.discountPercentage}% member discount applied
              </span>
            )}
          </div>
        )}

        {formData.customerAddress && (
          <div className="space-y-2">
            <Label>Address</Label>
            <div className="p-3 bg-muted rounded-md text-sm">
              {formData.customerAddress.street}
              {formData.customerAddress.city && `, ${formData.customerAddress.city}`}
              {formData.customerAddress.state && `, ${formData.customerAddress.state}`}
              {formData.customerAddress.postalCode && ` ${formData.customerAddress.postalCode}`}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}