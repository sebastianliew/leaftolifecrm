"use client"

import { useState, useEffect, useCallback } from 'react'
import { usePatients } from "@/hooks/usePatients"
import { PatientList } from "@/components/patients/PatientList"
import { PatientForm } from "@/components/patients/patient-form"
import type { Patient, PatientFormData } from "@/types/patient"
import { HiPlus, HiFunnel } from "react-icons/hi2"
import { TIER_CONFIG, type MembershipTier } from "@/config/membership-tiers"
import { useToast } from "@/components/ui/use-toast"
import { usePermissions } from "@/hooks/usePermissions"
import {
  EditorialPage,
  EditorialMasthead,
  EditorialStats,
  EditorialStat,
  EditorialSearch,
  EditorialButton,
  EditorialFilterRow,
  EditorialField,
  EditorialSelect,
  EditorialModal,
  EditorialPagination,
  EditorialErrorScreen,
} from "@/components/ui/editorial"

export default function PatientsPage() {
  const { toast } = useToast()
  const { hasPermission } = usePermissions()

  const canCreatePatients = hasPermission('patients', 'canCreatePatients')
  const canEditPatients = hasPermission('patients', 'canEditPatients')
  const canDeletePatients = hasPermission('patients', 'canDeletePatients')

  const {
    patients,
    pagination,
    loading,
    error,
    getPatients,
    createPatient,
    updatePatient,
    deletePatient,
  } = usePatients()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [tierFilter, setTierFilter] = useState<'all' | MembershipTier>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  const loadAllPatients = useCallback(async (page: number = 1) => {
    try {
      setCurrentPage(page)
      await getPatients(undefined, page, itemsPerPage, statusFilter, tierFilter)
    } catch (error) {
      console.error('Failed to load patients:', error)
      toast({ title: "Error", description: "Failed to load patients. Please try again.", variant: "destructive" })
    }
  }, [getPatients, itemsPerPage, statusFilter, tierFilter, toast])

  useEffect(() => {
    loadAllPatients(1)
  }, [loadAllPatients])

  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      getPatients(searchTerm.trim(), 1, itemsPerPage, statusFilter, tierFilter)
    } else {
      loadAllPatients(1)
    }
    setCurrentPage(1)
  }, [itemsPerPage, statusFilter, tierFilter, getPatients, loadAllPatients, searchTerm])

  const handlePageChange = async (page: number) => {
    if (searchTerm.trim().length >= 2) {
      await getPatients(searchTerm.trim(), page, itemsPerPage, statusFilter, tierFilter)
    } else {
      await loadAllPatients(page)
    }
    setCurrentPage(page)
  }

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term)
    setCurrentPage(1)
  }, [])

  const handleCreatePatient = async (data: PatientFormData) => {
    setIsSubmitting(true)
    try {
      const result = await createPatient(data)
      if ('error' in result) {
        toast({ title: "Error Creating Patient", description: result.error, variant: "destructive" })
        return
      }
      toast({ title: "Success", description: "Patient created successfully!" })
      setIsCreateDialogOpen(false)
      if (searchTerm.trim().length >= 2) {
        await getPatients(searchTerm.trim(), 1, itemsPerPage, statusFilter, tierFilter)
      } else {
        await loadAllPatients(1)
      }
    } catch (error) {
      console.error('Failed to create patient:', error)
      toast({
        title: "Error Creating Patient",
        description: error instanceof Error ? error.message : "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePatient = async (patient: Patient) => {
    try {
      await deletePatient(patient.id)
      toast({ title: "Success", description: `Patient ${patient.firstName} ${patient.lastName} deactivated.` })
      if (searchTerm.trim().length >= 2) {
        await getPatients(searchTerm.trim(), 1, itemsPerPage, statusFilter, tierFilter)
      } else {
        await loadAllPatients(1)
      }
    } catch (error) {
      console.error('Failed to delete patient:', error)
      toast({
        title: "Error Deleting Patient",
        description: error instanceof Error ? error.message : "Failed to delete patient. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (error) {
    return (
      <EditorialErrorScreen
        title="Could not load patients."
        description={error}
        onRetry={() => loadAllPatients(1)}
      />
    )
  }

  const totalCount = pagination?.totalCount || 0
  const activePatients = patients.filter((p) => p.status === 'active').length
  const tierBreakdown = patients.reduce<Record<string, number>>((acc, p) => {
    const tier = p.memberBenefits?.membershipTier
    if (tier) acc[tier] = (acc[tier] || 0) + 1
    return acc
  }, {})
  const topTier = Object.entries(tierBreakdown).sort((a, b) => b[1] - a[1])[0]

  return (
    <EditorialPage>
      <EditorialMasthead
        kicker="Patients"
        title="Roster"
        subtitle={
          <>
            <span className="tabular-nums">{totalCount}</span> patient{totalCount === 1 ? '' : 's'} on file
            {loading && <span className="ml-2 text-[#9CA3AF]">· refreshing…</span>}
          </>
        }
      >
        <EditorialSearch onSearch={handleSearch} placeholder="Search patients..." />
        <EditorialButton
          variant={showFilters ? 'ghost-active' : 'ghost'}
          icon={<HiFunnel className="h-3 w-3" />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filter
        </EditorialButton>
        {canCreatePatients && (
          <EditorialButton
            variant="primary"
            icon={<HiPlus className="h-3 w-3" />}
            arrow
            onClick={() => setIsCreateDialogOpen(true)}
          >
            New patient
          </EditorialButton>
        )}
      </EditorialMasthead>

      <EditorialStats>
        <EditorialStat index="i." label="Total patients" value={totalCount} caption={<><span className="tabular-nums">{activePatients}</span> active on this page</>} />
        <EditorialStat
          index="ii."
          label="Active"
          value={activePatients}
          caption="this page"
          tone="ok"
        />
        <EditorialStat
          index="iii."
          label="Top tier"
          value={topTier ? topTier[1] : 0}
          caption={topTier ? topTier[0].toUpperCase() : 'no members yet'}
        />
        <EditorialStat
          index="iv."
          label="Showing"
          value={patients.length}
          caption={`page ${pagination?.currentPage || 1} of ${pagination?.totalPages || 1}`}
        />
      </EditorialStats>

      {showFilters && (
        <EditorialFilterRow columns={3}>
          <EditorialField label="Status">
            <EditorialSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </EditorialSelect>
          </EditorialField>
          <EditorialField label="Membership tier">
            <EditorialSelect value={tierFilter} onChange={(e) => setTierFilter(e.target.value as 'all' | MembershipTier)}>
              <option value="all">All tiers</option>
              {Object.entries(TIER_CONFIG).map(([tier, { label }]) => (
                <option key={tier} value={tier}>{label}</option>
              ))}
            </EditorialSelect>
          </EditorialField>
          <EditorialField label="Per page">
            <EditorialSelect value={itemsPerPage.toString()} onChange={(e) => setItemsPerPage(parseInt(e.target.value))}>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </EditorialSelect>
          </EditorialField>
        </EditorialFilterRow>
      )}

      <PatientList
        patients={patients}
        loading={loading}
        onUpdatePatient={canEditPatients ? async (id, data) => {
          await updatePatient(id, data)
          if (searchTerm.trim().length >= 2) {
            await getPatients(searchTerm.trim(), currentPage, itemsPerPage, statusFilter, tierFilter)
          } else {
            await loadAllPatients(currentPage)
          }
        } : undefined}
        onDeletePatient={canDeletePatients ? handleDeletePatient : undefined}
        onCreateClick={canCreatePatients ? () => setIsCreateDialogOpen(true) : undefined}
        isSubmitting={isSubmitting}
      />

      {pagination && pagination.totalPages > 1 && (
        <EditorialPagination
          total={pagination.totalCount || 0}
          page={pagination.currentPage || 1}
          limit={itemsPerPage}
          pages={pagination.totalPages || 1}
          onPageChange={handlePageChange}
          onLimitChange={(l) => setItemsPerPage(l)}
          perPageOptions={[25, 50, 100]}
        />
      )}

      <EditorialModal
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        kicker="Patients"
        title="New patient"
        description="Capture a new patient record for the roster."
        size="xl"
      >
        <PatientForm
          onSubmit={handleCreatePatient}
          onCancel={() => setIsCreateDialogOpen(false)}
          loading={isSubmitting}
        />
      </EditorialModal>
    </EditorialPage>
  )
}
