"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { usePatients } from "@/hooks/usePatients"
import { PatientList } from "@/components/patients/PatientList"
import { PatientForm } from "@/components/patients/patient-form"
import type { Patient, PatientFormData } from "@/types/patient"
import { HiPlus, HiSearch, HiFilter } from "react-icons/hi"
import { useToast } from "@/components/ui/use-toast"
import { usePermissions } from "@/hooks/usePermissions"

export default function PatientsPage() {
  const { toast } = useToast()
  const { hasPermission } = usePermissions()

  // Permissions
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
    getRecentPatients,
  } = usePatients()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [tierFilter, setTierFilter] = useState<'all' | 'standard' | 'silver' | 'vip' | 'platinum'>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  const loadRecentPatients = async () => {
    try {
      await getRecentPatients()
    } catch (error) {
      console.error('Failed to load recent patients:', error)
      toast({
        title: "Error",
        description: "Failed to load recent patients. Please try again.",
        variant: "destructive"
      })
    }
  }

  const loadAllPatients = useCallback(async (page: number = 1) => {
    try {
      setCurrentPage(page)
      await getPatients(undefined, page, itemsPerPage)
    } catch (error) {
      console.error('Failed to load patients:', error)
      toast({
        title: "Error",
        description: "Failed to load patients. Please try again.",
        variant: "destructive"
      })
    }
  }, [getPatients, itemsPerPage, toast])

  useEffect(() => {
    // Load all patients on initial mount with pagination
    loadAllPatients(1)
  }, [loadAllPatients])

  // Reload when items per page changes
  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      getPatients(searchTerm.trim(), 1, itemsPerPage)
    } else {
      loadAllPatients(1)
    }
    setCurrentPage(1)
  }, [itemsPerPage, getPatients, loadAllPatients, searchTerm])

  const handlePageChange = async (page: number) => {
    if (searchTerm.trim().length >= 2) {
      await getPatients(searchTerm.trim(), page, itemsPerPage)
    } else {
      await loadAllPatients(page)
    }
    setCurrentPage(page)
  }

  const handleSearch = async () => {
    if (searchTerm.trim().length >= 2) {
      try {
        setCurrentPage(1)
        await getPatients(searchTerm.trim(), 1, itemsPerPage)
      } catch (error) {
        console.error('Failed to search patients:', error)
        toast({
          title: "Search Error",
          description: "Failed to search patients. Please try again.",
          variant: "destructive"
        })
      }
    } else {
      setCurrentPage(1)
      await loadAllPatients(1)
    }
  }

  const handleCreatePatient = async (data: PatientFormData) => {
    setIsSubmitting(true)
    try {
      const result = await createPatient(data)
      
      if ('error' in result) {
        toast({
          title: "Error Creating Patient",
          description: result.error,
          variant: "destructive"
        })
        return
      }
      
      toast({
        title: "Success",
        description: "Patient created successfully!",
        variant: "default"
      })
      
      setIsCreateDialogOpen(false)
      // Refresh the current view
      if (searchTerm.trim().length >= 2) {
        await getPatients(searchTerm.trim())
      } else {
        await loadRecentPatients()
      }
    } catch (error) {
      console.error('Failed to create patient:', error)
      toast({
        title: "Error Creating Patient",
        description: error instanceof Error ? error.message : "An unexpected error occurred. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePatient = async (patient: Patient) => {
    try {
      await deletePatient(patient.id)
      toast({
        title: "Success",
        description: `Patient ${patient.firstName} ${patient.lastName} deleted successfully!`,
        variant: "default"
      })
      // Refresh the current view
      if (searchTerm.trim().length >= 2) {
        await getPatients(searchTerm.trim())
      } else {
        await loadRecentPatients()
      }
    } catch (error) {
      console.error('Failed to delete patient:', error)
      toast({
        title: "Error Deleting Patient",
        description: error instanceof Error ? error.message : "Failed to delete patient. Please try again.",
        variant: "destructive"
      })
    }
  }

  // Always show patients from the main list (with pagination)
  const displayPatients = patients

  // Apply status and tier filters
  const filteredPatients = displayPatients.filter(patient => {
    // Status filter
    if (statusFilter !== 'all' && patient.status !== statusFilter) {
      return false
    }
    
    // Tier filter
    if (tierFilter !== 'all') {
      if (tierFilter === 'standard') {
        return !patient.memberBenefits
      } else {
        return patient.memberBenefits?.membershipTier === tierFilter
      }
    }
    
    return true
  })

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              Error loading patients: {error}
              <Button onClick={loadRecentPatients} className="ml-4" variant="outline">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Patient Management</h1>
          <p className="text-gray-600">Manage patient records and information</p>
        </div>
        
        {canCreatePatients && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <HiPlus className="w-4 h-4 mr-2" />
                Add Patient
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Patient</DialogTitle>
              </DialogHeader>
              <PatientForm
                onSubmit={handleCreatePatient}
                onCancel={() => setIsCreateDialogOpen(false)}
                loading={isSubmitting}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HiFilter className="w-5 h-5" />
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Patients</label>
              <div className="relative">
                <HiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by name, email, phone... (min 2 chars)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <p className="text-xs text-gray-500">
                Enter at least 2 characters to search. Leave empty to show all patients.
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'active' | 'inactive')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Membership Tier</label>
              <Select value={tierFilter} onValueChange={(value) => setTierFilter(value as 'all' | 'standard' | 'silver' | 'vip' | 'platinum')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="platinum">Platinum</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Items per page</label>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {searchTerm.trim().length >= 2 
              ? `Search Results (${filteredPatients.length} of ${pagination?.totalCount || 0})` 
              : `All Patients (${filteredPatients.length} of ${pagination?.totalCount || 0})`
            }
          </CardTitle>
          <CardDescription>
            {searchTerm.trim().length >= 2 
              ? 'Patients matching your search criteria'
              : `Page ${pagination?.currentPage || 1} of ${pagination?.totalPages || 1} • Showing ${itemsPerPage} patients per page`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PatientList
            patients={filteredPatients}
            loading={loading}
            onUpdatePatient={canEditPatients ? async (id, data) => {
              await updatePatient(id, data)
              // Refresh the current view
              if (searchTerm.trim().length >= 2) {
                await getPatients(searchTerm.trim(), currentPage, itemsPerPage)
              } else {
                await loadAllPatients(currentPage)
              }
            } : undefined}
            onDeletePatient={canDeletePatients ? handleDeletePatient : undefined}
            isSubmitting={isSubmitting}
          />

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault()
                        if (pagination.hasPrevPage && pagination.prevPage) {
                          handlePageChange(pagination.prevPage)
                        }
                      }}
                      className={pagination.hasPrevPage ? '' : 'pointer-events-none opacity-50'}
                    />
                  </PaginationItem>
                  
                  {/* Page Numbers */}
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const startPage = Math.max(1, pagination.currentPage - 2)
                    const pageNum = startPage + i
                    
                    if (pageNum > pagination.totalPages) return null
                    
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            handlePageChange(pageNum)
                          }}
                          isActive={pageNum === pagination.currentPage}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault()
                        if (pagination.hasNextPage && pagination.nextPage) {
                          handlePageChange(pagination.nextPage)
                        }
                      }}
                      className={pagination.hasNextPage ? '' : 'pointer-events-none opacity-50'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}