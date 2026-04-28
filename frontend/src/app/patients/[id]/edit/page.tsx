"use client"

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePatients } from "@/hooks/usePatients"
import { PatientForm } from "@/components/patients/patient-form"
import type { Patient, PatientFormData } from "@/types/patient"
import { HiArrowLeft } from "react-icons/hi2"
import { useToast } from "@/components/ui/use-toast"
import {
  EditorialPage,
  EditorialPageSkeleton,
  EditorialErrorScreen,
  EditorialBreadcrumb,
  EditorialMasthead,
  EditorialButton,
  EditorialSection,
  EditorialNote,
} from "@/components/ui/editorial"

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
    return (
      <EditorialErrorScreen
        title="Invalid patient ID"
        onRetry={() => router.push('/patients')}
      />
    )
  }

  const handleUpdatePatient = async (data: PatientFormData) => {
    if (!patient) return
    setIsSubmitting(true)
    try {
      await updatePatient(patient.id, data)
      toast({
        title: "Success",
        description: `Patient ${patient.firstName} ${patient.lastName} updated.`,
      })
      router.push(`/patients/${patient.id}`)
    } catch (error) {
      console.error('Failed to update patient:', error)
      setError('Failed to update patient')
      toast({
        title: "Error updating patient",
        description: error instanceof Error ? error.message : "Failed to update. Try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) return <EditorialPageSkeleton />

  if (!patient) {
    return (
      <EditorialErrorScreen
        title="Could not load patient."
        description={error || 'Patient not found.'}
        onRetry={loadPatient}
      />
    )
  }

  const patientName = patient.name || `${patient.firstName} ${patient.lastName}`.trim()

  return (
    <EditorialPage>
      <EditorialBreadcrumb
        segments={[
          { label: 'Patients', href: '/patients' },
          { label: patientName, href: `/patients/${patient.id}` },
          { label: 'Edit' },
        ]}
      />

      <EditorialMasthead
        kicker="Edit patient"
        title={patientName}
        subtitle="Update patient details. Fields marked with * are required."
      >
        <EditorialButton
          variant="ghost"
          icon={<HiArrowLeft className="h-3 w-3" />}
          onClick={() => router.push(`/patients/${patientId}`)}
        >
          Back
        </EditorialButton>
      </EditorialMasthead>

      <EditorialSection title="Patient information">
        {error && (
          <EditorialNote tone="danger" kicker="Error" className="mb-6">
            {error}
          </EditorialNote>
        )}
        <PatientForm
          patient={patient}
          onSubmit={handleUpdatePatient}
          onCancel={() => router.push(`/patients/${patientId}`)}
          loading={isSubmitting}
        />
      </EditorialSection>
    </EditorialPage>
  )
}
