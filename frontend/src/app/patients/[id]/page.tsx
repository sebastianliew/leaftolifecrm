"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePatients } from "@/hooks/usePatients"
import { PatientForm } from "@/components/patients/patient-form"
import type { Patient, PatientFormData } from "@/types/patient"
import { HiPencilAlt, HiTrash, HiArrowLeft, HiUser, HiClipboardList, HiDocumentText } from "react-icons/hi"
import { formatDate } from "@/lib/utils"

export default function PatientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const patientId = params?.id as string
  
  const { getPatientById, updatePatient, deletePatient } = usePatients()
  
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
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
      const updatedPatient = await updatePatient(patient.id, data) as Patient
      setPatient(updatedPatient)
      setIsEditing(false)
      setError(null)
    } catch (error) {
      console.error('Failed to update patient:', error)
      setError('Failed to update patient')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePatient = async () => {
    if (!patient) return
    
    if (window.confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
      try {
        await deletePatient(patient.id)
        router.push('/patients')
      } catch (error) {
        console.error('Failed to delete patient:', error)
        setError('Failed to delete patient')
      }
    }
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/patients')}
          >
            <HiArrowLeft className="w-4 h-4 mr-2" />
            Back to Patients
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{patientName}</h1>
            <p className="text-gray-600">Patient Details</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
            disabled={isSubmitting}
          >
            <HiPencilAlt className="w-4 h-4 mr-2" />
            {isEditing ? 'Cancel Edit' : 'Edit Patient'}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeletePatient}
            disabled={isSubmitting}
          >
            <HiTrash className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Edit Form or Patient Details */}
      {isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Patient Information</CardTitle>
            <CardDescription>Update patient details and information</CardDescription>
          </CardHeader>
          <CardContent>
            <PatientForm
              patient={patient}
              onSubmit={handleUpdatePatient}
              onCancel={() => setIsEditing(false)}
              loading={isSubmitting}
            />
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="details" className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">
              <HiUser className="w-4 h-4 mr-2" />
              Patient Details
            </TabsTrigger>
            <TabsTrigger value="prescriptions">
              <HiClipboardList className="w-4 h-4 mr-2" />
              Prescriptions
            </TabsTrigger>
            <TabsTrigger value="consultations">
              <HiDocumentText className="w-4 h-4 mr-2" />
              Consultations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Full Name</label>
                  <p className="text-lg">{patientName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div>
                    <Badge variant={patient.status === 'active' ? 'default' : 'secondary'}>
                      {patient.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                  <p>{formatDate(patient.dateOfBirth)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Gender</label>
                  <p className="capitalize">{patient.gender}</p>
                </div>
                {patient.nric && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">NRIC</label>
                    <p>{patient.nric}</p>
                  </div>
                )}
                {patient.bloodType && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Blood Type</label>
                    <p>{patient.bloodType}</p>
                  </div>
                )}
                {patient.maritalStatus && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Marital Status</label>
                    <p className="capitalize">{patient.maritalStatus}</p>
                  </div>
                )}
                {patient.occupation && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Occupation</label>
                    <p>{patient.occupation}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p>{patient.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone</label>
                  <p>{patient.phone}</p>
                </div>
                {patient.altPhone && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Alternative Phone</label>
                    <p>{patient.altPhone}</p>
                  </div>
                )}
                {patient.address && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500">Address</label>
                    <p>
                      {patient.address}
                      {patient.city && `, ${patient.city}`}
                      {patient.state && `, ${patient.state}`}
                      {patient.postalCode && ` ${patient.postalCode}`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Member Benefits */}
            {patient.memberBenefits && (
              <Card>
                <CardHeader>
                  <CardTitle>Member Benefits</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Membership Tier</label>
                    <p className="capitalize">{patient.memberBenefits.membershipTier}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Discount Percentage</label>
                    <p>{patient.memberBenefits.discountPercentage}%</p>
                  </div>
                  {patient.memberBenefits.discountReason && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-500">Discount Reason</label>
                      <p>{patient.memberBenefits.discountReason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* System Information */}
            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Patient ID</label>
                  <p className="font-mono text-sm">{patient.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Consent Status</label>
                  <Badge variant={patient.hasConsent ? 'default' : 'destructive'}>
                    {patient.hasConsent ? 'Consented' : 'No Consent'}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p>{formatDate(patient.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Updated</label>
                  <p>{formatDate(patient.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prescriptions">
            <Card>
              <CardHeader>
                <CardTitle>Prescriptions</CardTitle>
                <CardDescription>View and manage patient prescriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">Prescription management coming soon</p>
                  <Link href={`/patients/${patient.id}/prescription`}>
                    <Button>
                      <HiClipboardList className="w-4 h-4 mr-2" />
                      Manage Prescriptions
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consultations">
            <Card>
              <CardHeader>
                <CardTitle>Consultations</CardTitle>
                <CardDescription>View consultation history and notes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">Consultation management coming soon</p>
                  <Link href={`/patients/${patient.id}/consultation`}>
                    <Button>
                      <HiDocumentText className="w-4 h-4 mr-2" />
                      Manage Consultations
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}