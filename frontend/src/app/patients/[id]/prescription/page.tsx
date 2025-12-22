"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePatients } from "@/hooks/usePatients"
import type { Patient } from "@/types/patient"
import { HiArrowLeft, HiPlus, HiClipboardList, HiDocumentDuplicate, HiUser, HiClock } from "react-icons/hi"
import { formatDate } from "@/lib/utils"

export default function PatientPrescriptionPage() {
  const params = useParams()
  const router = useRouter()
  const patientId = params?.id as string
  
  const { getPatientById } = usePatients()
  
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
            onClick={() => router.push(`/patients/${patientId}`)}
          >
            <HiArrowLeft className="w-4 h-4 mr-2" />
            Back to Patient
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <HiClipboardList className="w-8 h-8" />
              Prescriptions
            </h1>
            <p className="text-gray-600">Prescription management for {patientName}</p>
          </div>
        </div>
        
        <Button>
          <HiPlus className="w-4 h-4 mr-2" />
          New Prescription
        </Button>
      </div>

      {/* Patient Summary Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HiUser className="w-5 h-5" />
            Patient Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Patient Name</label>
            <p className="text-lg font-semibold">{patientName}</p>
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
            <label className="text-sm font-medium text-gray-500">Consent Status</label>
            <div>
              <Badge variant={patient.hasConsent ? 'default' : 'destructive'}>
                {patient.hasConsent ? 'Consented' : 'No Consent'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList>
          <TabsTrigger value="active">
            <HiClipboardList className="w-4 h-4 mr-2" />
            Active Prescriptions
          </TabsTrigger>
          <TabsTrigger value="history">
            <HiClock className="w-4 h-4 mr-2" />
            Prescription History
          </TabsTrigger>
          <TabsTrigger value="templates">
            <HiDocumentDuplicate className="w-4 h-4 mr-2" />
            Prescription Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Prescriptions</CardTitle>
              <CardDescription>Current prescriptions for this patient</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <HiClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Active Prescriptions</h3>
                <p className="text-gray-500 mb-6">
                  This patient doesn&apos;t have any active prescriptions at the moment.
                </p>
                <Button>
                  <HiPlus className="w-4 h-4 mr-2" />
                  Create New Prescription
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Prescription History</CardTitle>
              <CardDescription>All past prescriptions for this patient</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <HiClock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Prescription History</h3>
                <p className="text-gray-500 mb-6">
                  No prescriptions have been recorded for this patient yet.
                </p>
                <Button>
                  <HiPlus className="w-4 h-4 mr-2" />
                  Create First Prescription
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Prescription Templates</CardTitle>
              <CardDescription>Saved prescription templates for quick access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <HiDocumentDuplicate className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Templates Available</h3>
                <p className="text-gray-500 mb-6">
                  No prescription templates have been created for this patient.
                </p>
                <Button>
                  <HiPlus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common prescription-related actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button variant="outline" className="justify-start h-auto py-4">
              <div className="text-left">
                <div className="font-semibold">New Prescription</div>
                <div className="text-sm text-gray-500">Create a new prescription</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-4">
              <div className="text-left">
                <div className="font-semibold">Refill Prescription</div>
                <div className="text-sm text-gray-500">Refill an existing prescription</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-4">
              <div className="text-left">
                <div className="font-semibold">Print Prescription</div>
                <div className="text-sm text-gray-500">Print prescription labels</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-4">
              <div className="text-left">
                <div className="font-semibold">View Interactions</div>
                <div className="text-sm text-gray-500">Check drug interactions</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Patient Allergies & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-orange-600">⚠️ Allergies & Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-gray-500">No known allergies recorded</p>
              <Button variant="outline" className="mt-4">
                Add Allergy Information
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prescription Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-gray-500">No prescription notes available</p>
              <Button variant="outline" className="mt-4">
                Add Notes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}