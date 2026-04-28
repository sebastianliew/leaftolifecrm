"use client"

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePatients } from "@/hooks/usePatients"
import type { Patient } from "@/types/patient"
import { HiArrowLeft, HiPlus } from "react-icons/hi2"
import { formatDate } from "@/lib/utils"
import {
  EditorialPage,
  EditorialPageSkeleton,
  EditorialErrorScreen,
  EditorialBreadcrumb,
  EditorialMasthead,
  EditorialButton,
  EditorialSection,
  EditorialDefList,
  EditorialPill,
  EditorialTabs,
} from "@/components/ui/editorial"

const tabContent: Record<string, { kicker: string; description: string; cta: string }> = {
  active: {
    kicker: 'No active prescriptions',
    description: "This patient doesn't have any active prescriptions at the moment.",
    cta: 'Create new prescription',
  },
  history: {
    kicker: 'No prescription history',
    description: 'No prescriptions have been recorded for this patient yet.',
    cta: 'Create first prescription',
  },
  templates: {
    kicker: 'No templates available',
    description: 'No prescription templates have been created for this patient.',
    cta: 'Create template',
  },
}

export default function PatientPrescriptionPage() {
  const params = useParams()
  const router = useRouter()
  const patientId = params?.id as string

  const { getPatientById } = usePatients()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('active')

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
    return <EditorialErrorScreen title="Invalid patient ID" onRetry={() => router.push('/patients')} />
  }

  if (loading) return <EditorialPageSkeleton />

  if (error || !patient) {
    return (
      <EditorialErrorScreen
        title="Could not load patient."
        description={error || 'Patient not found'}
        onRetry={loadPatient}
      />
    )
  }

  const patientName = patient.name || `${patient.firstName} ${patient.lastName}`.trim()
  const tab = tabContent[activeTab]

  return (
    <EditorialPage>
      <EditorialBreadcrumb
        segments={[
          { label: 'Patients', href: '/patients' },
          { label: patientName, href: `/patients/${patient.id}` },
          { label: 'Prescriptions' },
        ]}
      />

      <EditorialMasthead
        kicker="Prescriptions"
        title={patientName}
        subtitle="Active, historical, and template prescriptions for this patient."
      >
        <EditorialButton
          variant="ghost"
          icon={<HiArrowLeft className="h-3 w-3" />}
          onClick={() => router.push(`/patients/${patientId}`)}
        >
          Back
        </EditorialButton>
        <EditorialButton variant="primary" arrow icon={<HiPlus className="h-3 w-3" />}>
          New prescription
        </EditorialButton>
      </EditorialMasthead>

      <EditorialSection index="i." title="Patient summary">
        <EditorialDefList
          cols={4}
          items={[
            { label: 'Name', value: patientName },
            {
              label: 'Status',
              value: <EditorialPill tone={patient.status === 'active' ? 'ok' : 'muted'}>{patient.status}</EditorialPill>,
            },
            { label: 'Date of birth', value: <span className="tabular-nums">{formatDate(patient.dateOfBirth)}</span> },
            {
              label: 'Consent',
              value: <EditorialPill tone={patient.hasConsent ? 'ok' : 'danger'}>{patient.hasConsent ? 'Consented' : 'No consent'}</EditorialPill>,
            },
          ]}
        />
      </EditorialSection>

      <div className="mt-8">
        <EditorialTabs
          tabs={[
            { id: 'active', label: 'Active' },
            { id: 'history', label: 'History' },
            { id: 'templates', label: 'Templates' },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <EditorialSection title={tab.kicker.replace('No ', '')}>
        <div className="text-center py-20">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">{tab.kicker}</p>
          <p className="text-sm italic font-light text-[#6B7280] mt-3 mb-6">{tab.description}</p>
          <EditorialButton variant="primary" arrow icon={<HiPlus className="h-3 w-3" />}>
            {tab.cta}
          </EditorialButton>
        </div>
      </EditorialSection>

      <EditorialSection title="Quick actions" description="Common prescription-related actions.">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { title: 'New prescription', desc: 'Create a new prescription.' },
            { title: 'Refill prescription', desc: 'Refill an existing prescription.' },
            { title: 'Print prescription', desc: 'Print prescription labels.' },
            { title: 'View interactions', desc: 'Check drug interactions.' },
          ].map((action) => (
            <button
              key={action.title}
              className="text-left p-5 border border-[#E5E7EB] hover:border-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
            >
              <p className="text-[14px] text-[#0A0A0A] font-medium">{action.title}</p>
              <p className="text-[11px] text-[#6B7280] italic font-light mt-1 leading-relaxed">{action.desc}</p>
            </button>
          ))}
        </div>
      </EditorialSection>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-2">
        <EditorialSection title="Allergies & warnings">
          <div className="text-center py-10">
            <p className="text-sm italic font-light text-[#6B7280]">No known allergies recorded.</p>
            <EditorialButton variant="ghost" className="mt-4">
              Add allergy information
            </EditorialButton>
          </div>
        </EditorialSection>

        <EditorialSection title="Prescription notes">
          <div className="text-center py-10">
            <p className="text-sm italic font-light text-[#6B7280]">No prescription notes available.</p>
            <EditorialButton variant="ghost" className="mt-4">
              Add notes
            </EditorialButton>
          </div>
        </EditorialSection>
      </div>
    </EditorialPage>
  )
}
