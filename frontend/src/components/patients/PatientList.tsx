'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Patient, PatientFormData } from '@/types/patient'
import { HiPencil, HiTrash, HiEye } from 'react-icons/hi2'
import { formatDate } from '@/lib/utils'
import {
  EditorialTable,
  EditorialTHead,
  EditorialTh,
  EditorialTr,
  EditorialTd,
  EditorialEmptyRow,
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
  EditorialMeta,
} from '@/components/ui/editorial'

interface PatientListProps {
  patients: Patient[]
  loading?: boolean
  onUpdatePatient?: (id: string, data: PatientFormData) => Promise<void>
  onDeletePatient?: (patient: Patient) => Promise<void>
  onCreateClick?: () => void
  isSubmitting?: boolean
}

const tierToneMap: Record<string, { color: string; label: string }> = {
  platinum: { color: 'text-[#EA580C]', label: 'Platinum' },
  vip: { color: 'text-[#7C3AED]', label: 'VIP' },
  gold: { color: 'text-[#EAB308]', label: 'Gold' },
  silver: { color: 'text-[#6B7280]', label: 'Silver' },
  standard: { color: 'text-[#16A34A]', label: 'Standard' },
}

export function PatientList({
  patients,
  loading = false,
  onDeletePatient,
  isSubmitting = false,
}: PatientListProps) {
  const [confirmDelete, setConfirmDelete] = useState<Patient | null>(null)

  return (
    <>
      <EditorialTable>
        <EditorialTHead>
          <EditorialTh>Name</EditorialTh>
          <EditorialTh>Date of birth</EditorialTh>
          <EditorialTh>Gender</EditorialTh>
          <EditorialTh>Contact</EditorialTh>
          <EditorialTh>Tier</EditorialTh>
          <EditorialTh>Status</EditorialTh>
          <EditorialTh align="right" className="w-32">Actions</EditorialTh>
        </EditorialTHead>
        <tbody>
          {loading ? (
            <EditorialEmptyRow colSpan={7} title="Loading" description="Fetching patient records…" />
          ) : patients.length === 0 ? (
            <EditorialEmptyRow colSpan={7} description="No patients match the current filters." />
          ) : (
            patients.map((patient) => {
              const patientName = patient.name || `${patient.firstName} ${patient.lastName}`.trim()
              const tier = patient.memberBenefits?.membershipTier
              const tierInfo = tier ? tierToneMap[tier] : null
              return (
                <EditorialTr key={patient.id || patient._id}>
                  <EditorialTd size="lg" className="pr-4">
                    <p className="text-[14px] text-[#0A0A0A] font-medium">{patientName}</p>
                  </EditorialTd>
                  <EditorialTd className="tabular-nums">{formatDate(patient.dateOfBirth)}</EditorialTd>
                  <EditorialTd className="capitalize italic font-light">{patient.gender || '—'}</EditorialTd>
                  <EditorialTd>
                    <p>{patient.phone || '—'}</p>
                    {patient.email && <EditorialMeta>{patient.email}</EditorialMeta>}
                  </EditorialTd>
                  <EditorialTd>
                    {tierInfo ? (
                      <>
                        <span className={`text-[10px] uppercase tracking-[0.28em] ${tierInfo.color}`}>
                          {tierInfo.label}
                        </span>
                        <EditorialMeta className="italic font-light tabular-nums">
                          {patient.memberBenefits?.discountPercentage}% off
                        </EditorialMeta>
                      </>
                    ) : (
                      <span className="text-[10px] uppercase tracking-[0.28em] text-[#9CA3AF]">No tier</span>
                    )}
                  </EditorialTd>
                  <EditorialTd>
                    <span
                      className={`text-[10px] uppercase tracking-[0.28em] ${patient.status === 'active' ? 'text-[#16A34A]' : 'text-[#9CA3AF]'}`}
                    >
                      {patient.status || 'unknown'}
                    </span>
                  </EditorialTd>
                  <EditorialTd align="right">
                    <div className="flex items-center justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/patients/${patient.id}`}
                        title="View"
                        className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                      >
                        <HiEye className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href={`/patients/${patient.id}/edit`}
                        title="Edit"
                        className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
                      >
                        <HiPencil className="h-3.5 w-3.5" />
                      </Link>
                      {onDeletePatient && (
                        <button
                          onClick={() => setConfirmDelete(patient)}
                          disabled={isSubmitting}
                          title="Deactivate"
                          className="text-[#6B7280] hover:text-[#DC2626] disabled:opacity-30 transition-colors"
                        >
                          <HiTrash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </EditorialTd>
                </EditorialTr>
              )
            })
          )}
        </tbody>
      </EditorialTable>

      <EditorialModal
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        kicker="Deactivate patient"
        kickerTone="danger"
        title={
          confirmDelete
            ? `Deactivate ${confirmDelete.name || `${confirmDelete.firstName} ${confirmDelete.lastName}`.trim()}?`
            : 'Deactivate patient?'
        }
        description="The patient record will be set to inactive but kept for historical reporting."
      >
        <EditorialModalFooter>
          <EditorialButton variant="ghost" onClick={() => setConfirmDelete(null)}>
            Cancel
          </EditorialButton>
          <EditorialButton
            variant="primary"
            arrow
            onClick={async () => {
              if (confirmDelete && onDeletePatient) {
                await onDeletePatient(confirmDelete)
                setConfirmDelete(null)
              }
            }}
          >
            Deactivate
          </EditorialButton>
        </EditorialModalFooter>
      </EditorialModal>
    </>
  )
}
