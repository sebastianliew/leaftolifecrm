"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { usePatients } from "@/hooks/usePatients"
import { PatientForm } from "@/components/patients/patient-form"
import type { Patient, PatientFormData } from "@/types/patient"
import { HiArrowLeft } from "react-icons/hi"
import { useToast } from "@/components/ui/use-toast"

export default function PatientEditPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const patientId = params?.id as string
  
  const { getPatientById, updatePatient } = usePatients()
  
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadPatient = useCallback(async () => {
    if (!patientId) return
    
    setLoading(true)
    try {
      const patientData = await getPatientById(patientId)
      setPatient(patientData)
      setError(null)
    } catch {
      setError('Failed to load patient details')
    } finally {
      setLoading(false)
    }
  }, [patientId, getPatientById])

  useEffect(() => {
    loadPatient()
  }, [loadPatient])
  
  if (!patientId) {
    return <div>Invalid patient ID</div>
  }

  const handleUpdatePatient = async (data: PatientFormData) => {
    if (!patient) return
    
    setIsSubmitting(true)
    try {
      await updatePatient(patient.id, data)
      toast({
        title: "Success",
        description: `Patient ${patient.firstName} ${patient.lastName} updated successfully!`,
        variant: "default"
      })
      router.push(`/patients/${patient.id}`)
    } catch (error) {
      console.error('Failed to update patient:', error)
      setError('Failed to update patient')
      toast({
        title: "Error Updating Patient",
        description: error instanceof Error ? error.message : "Failed to update patient. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push(`/patients/${patientId}`)
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medsy-green mx-auto mb-4"></div>
            <p>Loading patient details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !patient) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              {error || 'Patient not found'}
              <div className="mt-4 space-x-2">
                <Button onClick={loadPatient} variant="outline">
                  Retry
                </Button>
                <Button onClick={() => router.push('/patients')} variant="outline">
                  Back to Patients
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const patientName = patient.name || `${patient.firstName} ${patient.lastName}`.trim()

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/patients/${patientId}`)}
        >
          <HiArrowLeft className="w-4 h-4 mr-2" />
          Back to Patient
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Patient</h1>
          <p className="text-gray-600">Update information for {patientName}</p>
        </div>
      </div>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
          <CardDescription>
            Update patient details and information. All fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          
          <PatientForm
            patient={patient}
            onSubmit={handleUpdatePatient}
            onCancel={handleCancel}
            loading={isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  )
}