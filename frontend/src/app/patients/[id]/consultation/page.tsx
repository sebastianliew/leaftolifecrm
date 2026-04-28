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

export default function PatientConsultationPage() {
  const params = useParams()
  const router = useRouter()
  const patientId = params?.id as string

  const { getPatientById } = usePatients()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('consultations')

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

  return (
    <EditorialPage>
      <EditorialBreadcrumb
        segments={[
          { label: 'Patients', href: '/patients' },
          { label: patientName, href: `/patients/${patient.id}` },
          { label: 'Consultations' },
        ]}
      />

      <EditorialMasthead
        kicker="Consultations"
        title={patientName}
        subtitle="Consultation history and upcoming appointments."
      >
        <EditorialButton
          variant="ghost"
          icon={<HiArrowLeft className="h-3 w-3" />}
          onClick={() => router.push(`/patients/${patientId}`)}
        >
          Back
        </EditorialButton>
        <EditorialButton variant="primary" arrow icon={<HiPlus className="h-3 w-3" />}>
          New consultation
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
            { label: 'Contact', value: patient.phone || '—', tone: patient.phone ? 'ink' : 'muted' },
          ]}
        />
      </EditorialSection>

      <div className="mt-8">
        <EditorialTabs
          tabs={[
            { id: 'consultations', label: 'History' },
            { id: 'upcoming', label: 'Upcoming' },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'consultations' && (
        <EditorialSection title="Consultation history" description="Past consultations and notes for this patient.">
          <div className="text-center py-20">
            <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">Nothing on file</p>
            <p className="text-sm italic font-light text-[#6B7280] mt-3 mb-6">
              This patient hasn&apos;t had any consultations recorded yet.
            </p>
            <EditorialButton variant="primary" arrow icon={<HiPlus className="h-3 w-3" />}>
              Create first consultation
            </EditorialButton>
          </div>
        </EditorialSection>
      )}

      {activeTab === 'upcoming' && (
        <EditorialSection title="Upcoming appointments" description="Scheduled appointments and consultations.">
          <div className="text-center py-20">
            <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">Nothing scheduled</p>
            <p className="text-sm italic font-light text-[#6B7280] mt-3 mb-6">
              No appointments are currently scheduled for this patient.
            </p>
            <EditorialButton variant="primary" arrow icon={<HiPlus className="h-3 w-3" />}>
              Schedule appointment
            </EditorialButton>
          </div>
        </EditorialSection>
      )}

      <EditorialSection title="Quick actions" description="Common consultation-related actions.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { title: 'New consultation', desc: 'Record a new patient consultation.' },
            { title: 'Schedule follow-up', desc: 'Book the next appointment.' },
            { title: 'View prescriptions', desc: 'See prescription history.', href: `/patients/${patient.id}/prescription` },
          ].map((action) => (
            action.href ? (
              <a
                key={action.title}
                href={action.href}
                className="text-left p-5 border border-[#E5E7EB] hover:border-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors block"
              >
                <p className="text-[14px] text-[#0A0A0A] font-medium">{action.title}</p>
                <p className="text-[11px] text-[#6B7280] italic font-light mt-1 leading-relaxed">{action.desc}</p>
              </a>
            ) : (
              <button
                key={action.title}
                className="text-left p-5 border border-[#E5E7EB] hover:border-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
              >
                <p className="text-[14px] text-[#0A0A0A] font-medium">{action.title}</p>
                <p className="text-[11px] text-[#6B7280] italic font-light mt-1 leading-relaxed">{action.desc}</p>
              </button>
            )
          ))}
        </div>
      </EditorialSection>
    </EditorialPage>
  )
}
