"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { usePatients } from "@/hooks/usePatients"
import { PatientForm } from "@/components/patients/patient-form"
import type { PatientFormData } from "@/types/patient"
import { HiArrowLeft, HiPlus } from "react-icons/hi"
import { useToast } from "@/components/ui/use-toast"

export default function NewPatientPage() {
  const router = useRouter()
  const { createPatient } = usePatients()
  const { toast } = useToast()
  
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreatePatient = async (data: PatientFormData) => {
    setIsSubmitting(true)
    
    const result = await createPatient(data)
    
    if ('error' in result) {
      // Show user-friendly toast for duplicate email/NRIC
      if (result.error.includes('email or NRIC already exists')) {
        toast({
          variant: "destructive",
          title: "Patient already exists",
          description: "A patient with this email or NRIC already exists. Please use a different email or NRIC.",
        })
      } else {
        // Generic error toast
        toast({
          variant: "destructive",
          title: "Failed to create patient",
          description: result.error,
        })
      }
    } else if (result.success && result.data) {
      // Success toast and redirect
      toast({
        title: "Patient created successfully",
        description: `${result.data.name || `${result.data.firstName} ${result.data.lastName}`} has been added to the system.`,
      })
      router.push(`/patients/${result.data.id}`)
    }
    
    setIsSubmitting(false)
  }

  const handleCancel = () => {
    router.push('/patients')
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/patients')}
        >
          <HiArrowLeft className="w-4 h-4 mr-2" />
          Back to Patients
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HiPlus className="w-8 h-8" />
            New Patient
          </h1>
          <p className="text-gray-600">Create a new patient record</p>
        </div>
      </div>

      {/* Create Form */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
          <CardDescription>
            Enter the patient&apos;s details to create a new record. All fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PatientForm
            onSubmit={handleCreatePatient}
            onCancel={handleCancel}
            loading={isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  )
}