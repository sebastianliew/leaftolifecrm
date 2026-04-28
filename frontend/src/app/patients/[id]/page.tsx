"use client"

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePatients } from "@/hooks/usePatients"
import { PatientForm } from "@/components/patients/patient-form"
import { PatientInvoicesTab } from "@/components/patients/PatientInvoicesTab"
import type { Patient, PatientFormData } from "@/types/patient"
import { HiPencil, HiTrash, HiArrowLeft } from "react-icons/hi2"
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
  EditorialModal,
  EditorialModalFooter,
  EditorialTabs,
} from "@/components/ui/editorial"

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
  const [activeTab, setActiveTab] = useState('details')
  const [confirmDelete, setConfirmDelete] = useState(false)

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
        description="No patient identifier was provided in the URL."
        onRetry={() => router.push('/patients')}
      />
    )
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
    try {
      await deletePatient(patient.id)
      router.push('/patients')
    } catch (error) {
      console.error('Failed to delete patient:', error)
      setError('Failed to delete patient')
    }
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
          { label: patientName },
        ]}
      />

      <EditorialMasthead
        kicker="Patient"
        title={patientName}
        subtitle={
          <>
            <EditorialPill tone={patient.status === 'active' ? 'ok' : 'muted'}>{patient.status}</EditorialPill>
            {patient.memberBenefits && (
              <span className="ml-3 italic font-light">
                {patient.memberBenefits.membershipTier?.toUpperCase()} ·{' '}
                <span className="tabular-nums">{patient.memberBenefits.discountPercentage}%</span> off
              </span>
            )}
          </>
        }
      >
        <EditorialButton
          variant="ghost"
          icon={<HiArrowLeft className="h-3 w-3" />}
          onClick={() => router.push('/patients')}
        >
          Back
        </EditorialButton>
        <EditorialButton
          variant={isEditing ? 'ghost-active' : 'ghost'}
          icon={<HiPencil className="h-3 w-3" />}
          onClick={() => setIsEditing(!isEditing)}
          disabled={isSubmitting}
        >
          {isEditing ? 'Cancel edit' : 'Edit'}
        </EditorialButton>
        <EditorialButton
          variant="primary"
          arrow
          icon={<HiTrash className="h-3 w-3" />}
          onClick={() => setConfirmDelete(true)}
          disabled={isSubmitting}
        >
          Deactivate
        </EditorialButton>
      </EditorialMasthead>

      {isEditing ? (
        <EditorialSection title="Edit patient" description="Update patient details and information.">
          <PatientForm
            patient={patient}
            onSubmit={handleUpdatePatient}
            onCancel={() => setIsEditing(false)}
            loading={isSubmitting}
          />
        </EditorialSection>
      ) : (
        <>
          <div className="mt-8">
            <EditorialTabs
              tabs={[
                { id: 'details', label: 'Details' },
                { id: 'invoices', label: 'Invoices' },
                { id: 'prescriptions', label: 'Prescriptions' },
                { id: 'consultations', label: 'Consultations' },
              ]}
              active={activeTab}
              onChange={setActiveTab}
            />
          </div>

          {activeTab === 'details' && (
            <>
              <EditorialSection index="i." title="Basic information">
                <EditorialDefList
                  cols={3}
                  items={[
                    { label: 'Full name', value: patientName },
                    { label: 'Date of birth', value: <span className="tabular-nums">{formatDate(patient.dateOfBirth)}</span> },
                    { label: 'Gender', value: <span className="capitalize">{patient.gender || '—'}</span> },
                    ...(patient.nric ? [{ label: 'NRIC', value: <span className="font-mono tracking-wide">{patient.nric}</span> }] : []),
                    ...(patient.bloodType ? [{ label: 'Blood type', value: patient.bloodType }] : []),
                    ...(patient.maritalStatus ? [{ label: 'Marital status', value: <span className="capitalize">{patient.maritalStatus}</span> }] : []),
                    ...(patient.occupation ? [{ label: 'Occupation', value: patient.occupation }] : []),
                  ]}
                />
              </EditorialSection>

              <EditorialSection index="ii." title="Contact">
                <EditorialDefList
                  cols={2}
                  items={[
                    { label: 'Email', value: patient.email || '—', tone: patient.email ? 'ink' : 'muted' },
                    { label: 'Phone', value: patient.phone || '—', tone: patient.phone ? 'ink' : 'muted' },
                    ...(patient.altPhone ? [{ label: 'Alternative phone', value: patient.altPhone }] : []),
                    ...(patient.address ? [{
                      label: 'Address',
                      value: (
                        <>
                          {patient.address}
                          {patient.city && `, ${patient.city}`}
                          {patient.state && `, ${patient.state}`}
                          {patient.postalCode && ` ${patient.postalCode}`}
                        </>
                      ),
                    }] : []),
                  ]}
                />
              </EditorialSection>

              {patient.memberBenefits && (
                <EditorialSection index="iii." title="Member benefits">
                  <EditorialDefList
                    cols={3}
                    items={[
                      { label: 'Tier', value: <span className="capitalize">{patient.memberBenefits.membershipTier}</span> },
                      { label: 'Discount', value: <span className="tabular-nums">{patient.memberBenefits.discountPercentage}%</span> },
                      ...(patient.memberBenefits.discountReason ? [{
                        label: 'Reason',
                        value: <span className="italic font-light">{patient.memberBenefits.discountReason}</span>,
                      }] : []),
                    ]}
                  />
                </EditorialSection>
              )}

              <EditorialSection index="iv." title="System">
                <EditorialDefList
                  cols={3}
                  items={[
                    { label: 'Patient ID', value: <span className="font-mono tracking-wide text-[12px]">{patient.id}</span> },
                    {
                      label: 'Consent',
                      value: <EditorialPill tone={patient.hasConsent ? 'ok' : 'danger'}>{patient.hasConsent ? 'Consented' : 'No consent'}</EditorialPill>,
                    },
                    { label: 'Created', value: <span className="tabular-nums">{formatDate(patient.createdAt)}</span> },
                    { label: 'Last updated', value: <span className="tabular-nums">{formatDate(patient.updatedAt)}</span> },
                  ]}
                />
              </EditorialSection>
            </>
          )}

          {activeTab === 'invoices' && (
            <div className="mt-8">
              <PatientInvoicesTab patientId={patient.id} patientName={patientName} />
            </div>
          )}

          {activeTab === 'prescriptions' && (
            <EditorialSection
              title="Prescriptions"
              description="View and manage prescriptions for this patient."
              actions={
                <Link href={`/patients/${patient.id}/prescription`}>
                  <EditorialButton variant="primary" arrow>Manage prescriptions</EditorialButton>
                </Link>
              }
            >
              <p className="text-sm italic font-light text-[#6B7280] py-8 text-center">
                Prescription management coming soon — open the dedicated screen to begin.
              </p>
            </EditorialSection>
          )}

          {activeTab === 'consultations' && (
            <EditorialSection
              title="Consultations"
              description="View consultation history and notes."
              actions={
                <Link href={`/patients/${patient.id}/consultation`}>
                  <EditorialButton variant="primary" arrow>Manage consultations</EditorialButton>
                </Link>
              }
            >
              <p className="text-sm italic font-light text-[#6B7280] py-8 text-center">
                Consultation management coming soon — open the dedicated screen to begin.
              </p>
            </EditorialSection>
          )}
        </>
      )}

      <EditorialModal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        kicker="Deactivate patient"
        kickerTone="danger"
        title={`Deactivate ${patientName}?`}
        description="The patient will be set to inactive and hidden from default views. Their data and transaction history are preserved."
      >
        <EditorialModalFooter>
          <EditorialButton variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancel
          </EditorialButton>
          <EditorialButton
            variant="primary"
            arrow
            onClick={async () => {
              await handleDeletePatient()
              setConfirmDelete(false)
            }}
          >
            Deactivate
          </EditorialButton>
        </EditorialModalFooter>
      </EditorialModal>
    </EditorialPage>
  )
}
