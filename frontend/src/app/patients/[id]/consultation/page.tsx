"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePatients } from "@/hooks/usePatients"
import type { Patient } from "@/types/patient"
import { HiArrowLeft, HiPlus, HiDocumentText, HiCalendar, HiUser } from "react-icons/hi"
import { formatDate } from "@/lib/utils"

export default function PatientConsultationPage() {
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
              <HiDocumentText className="w-8 h-8" />
              Consultations
            </h1>
            <p className="text-gray-600">Consultation history for {patientName}</p>
          </div>
        </div>
        
        <Button>
          <HiPlus className="w-4 h-4 mr-2" />
          New Consultation
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
            <label className="text-sm font-medium text-gray-500">Contact</label>
            <p>{patient.phone}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="consultations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="consultations">
            <HiDocumentText className="w-4 h-4 mr-2" />
            Consultation History
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            <HiCalendar className="w-4 h-4 mr-2" />
            Upcoming Appointments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consultations">
          <Card>
            <CardHeader>
              <CardTitle>Consultation History</CardTitle>
              <CardDescription>Past consultations and notes for this patient</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <HiDocumentText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Consultations Yet</h3>
                <p className="text-gray-500 mb-6">
                  This patient hasn&apos;t had any consultations recorded yet.
                </p>
                <Button>
                  <HiPlus className="w-4 h-4 mr-2" />
                  Create First Consultation
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Appointments</CardTitle>
              <CardDescription>Scheduled appointments and consultations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <HiCalendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Upcoming Appointments</h3>
                <p className="text-gray-500 mb-6">
                  No appointments are currently scheduled for this patient.
                </p>
                <Button>
                  <HiPlus className="w-4 h-4 mr-2" />
                  Schedule Appointment
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
          <CardDescription>Common consultation-related actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="justify-start h-auto py-4">
              <div className="text-left">
                <div className="font-semibold">New Consultation</div>
                <div className="text-sm text-gray-500">Record a new patient consultation</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-4">
              <div className="text-left">
                <div className="font-semibold">Schedule Follow-up</div>
                <div className="text-sm text-gray-500">Book the next appointment</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-4">
              <div className="text-left">
                <div className="font-semibold">View Prescriptions</div>
                <div className="text-sm text-gray-500">See prescription history</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}