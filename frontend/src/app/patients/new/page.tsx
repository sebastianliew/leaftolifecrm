"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePatients } from "@/hooks/usePatients"
import { PatientForm } from "@/components/patients/patient-form"
import type { PatientFormData } from "@/types/patient"
import { HiArrowLeft } from "react-icons/hi2"
import { useToast } from "@/components/ui/use-toast"
import {
  EditorialPage,
  EditorialBreadcrumb,
  EditorialMasthead,
  EditorialButton,
  EditorialSection,
} from "@/components/ui/editorial"

export default function NewPatientPage() {
  const router = useRouter()
  const { createPatient } = usePatients()
  const { toast } = useToast()

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreatePatient = async (data: PatientFormData) => {
    setIsSubmitting(true)

    const result = await createPatient(data)

    if ('error' in result) {
      if (result.error.includes('email or NRIC already exists')) {
        toast({
          variant: "destructive",
          title: "Patient already exists",
          description: "A patient with this email or NRIC already exists. Use a different one.",
        })
      } else {
        toast({
          variant: "destructive",
          title: "Failed to create patient",
          description: result.error,
        })
      }
    } else if (result.success && result.data) {
      toast({
        title: "Patient created",
        description: `${result.data.name || `${result.data.firstName} ${result.data.lastName}`} added to the roster.`,
      })
      router.push(`/patients/${result.data.id}`)
    }

    setIsSubmitting(false)
  }

  return (
    <EditorialPage>
      <EditorialBreadcrumb
        segments={[
          { label: 'Patients', href: '/patients' },
          { label: 'New' },
        ]}
      />

      <EditorialMasthead
        kicker="New patient"
        title="Capture record"
        subtitle="Enter patient details. Fields marked with * are required."
      >
        <EditorialButton
          variant="ghost"
          icon={<HiArrowLeft className="h-3 w-3" />}
          onClick={() => router.push('/patients')}
        >
          Back
        </EditorialButton>
      </EditorialMasthead>

      <EditorialSection title="Patient information">
        <PatientForm
          onSubmit={handleCreatePatient}
          onCancel={() => router.push('/patients')}
          loading={isSubmitting}
        />
      </EditorialSection>
    </EditorialPage>
  )
}
