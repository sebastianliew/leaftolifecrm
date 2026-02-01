"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { usePatients } from "@/hooks/usePatients"
import type { Patient } from "@/types/patient"
import { HiSearch, HiFilter, HiRefresh, HiTrash } from "react-icons/hi"
import { useToast } from "@/components/ui/use-toast"
import { usePermissions } from "@/hooks/usePermissions"
import { Loader2 } from "lucide-react"

type MembershipTier = 'standard' | 'silver' | 'gold' | 'vip' | 'platinum'

const TIER_DISCOUNTS: Record<MembershipTier, number> = {
  standard: 0,
  silver: 10,
  gold: 20,
  vip: 20,
  platinum: 40
}

const TIER_COLORS: Record<MembershipTier, string> = {
  standard: 'bg-gray-100 text-gray-800',
  silver: 'bg-slate-200 text-slate-800',
  gold: 'bg-amber-100 text-amber-800',
  vip: 'bg-purple-100 text-purple-800',
  platinum: 'bg-indigo-100 text-indigo-800'
}

export default function MembershipsPage() {
  const { toast } = useToast()
  const { hasPermission } = usePermissions()

  const canEditPatients = hasPermission('patients', 'canEditPatients')
  const canDeletePatients = hasPermission('patients', 'canDeletePatients')

  const {
    patients,
    pagination,
    loading,
    error,
    getPatients,
    updatePatient,
    deletePatient,
    clearSearchCache,
  } = usePatients()

  const [searchTerm, setSearchTerm] = useState('')
  const [tierFilter, setTierFilter] = useState<'all' | MembershipTier>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [updatingPatientId, setUpdatingPatientId] = useState<string | null>(null)
  const [deletingPatientId, setDeletingPatientId] = useState<string | null>(null)
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null)

  const loadPatients = useCallback(async (page: number = 1) => {
    try {
      setCurrentPage(page)
      await getPatients(searchTerm.trim().length >= 2 ? searchTerm.trim() : undefined, page, itemsPerPage)
    } catch (err) {
      console.error('Failed to load patients:', err)
      toast({
        title: "Error",
        description: "Failed to load patients. Please try again.",
        variant: "destructive"
      })
    }
  }, [getPatients, searchTerm, itemsPerPage, toast])

  useEffect(() => {
    loadPatients(1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadPatients(1)
    setCurrentPage(1)
  }, [itemsPerPage]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async () => {
    setCurrentPage(1)
    await loadPatients(1)
  }

  const handlePageChange = async (page: number) => {
    await loadPatients(page)
  }

  const handleRefresh = () => {
    clearSearchCache()
    loadPatients(currentPage)
    toast({
      title: "Refreshed",
      description: "Patient list has been refreshed.",
    })
  }

  const handleTierChange = async (patientId: string, newTier: MembershipTier) => {
    if (!canEditPatients) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to edit patient memberships.",
        variant: "destructive"
      })
      return
    }

    setUpdatingPatientId(patientId)
    try {
      await updatePatient(patientId, {
        memberBenefits: {
          membershipTier: newTier,
          discountPercentage: TIER_DISCOUNTS[newTier]
        }
      })

      toast({
        title: "Membership Updated",
        description: `Patient membership tier changed to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} (${TIER_DISCOUNTS[newTier]}% discount).`,
      })

      // Refresh the list to show updated data
      clearSearchCache()
      await loadPatients(currentPage)
    } catch (err) {
      console.error('Failed to update membership:', err)
      toast({
        title: "Update Failed",
        description: "Failed to update membership tier. Please try again.",
        variant: "destructive"
      })
    } finally {
      setUpdatingPatientId(null)
    }
  }

  const handleDeleteClick = (patient: Patient) => {
    setPatientToDelete(patient)
  }

  const handleDeleteConfirm = async () => {
    if (!patientToDelete) return

    const patientId = patientToDelete._id ?? patientToDelete.id
    setDeletingPatientId(patientId)

    try {
      await deletePatient(patientId)

      toast({
        title: "Patient Deleted",
        description: `${patientToDelete.firstName} ${patientToDelete.lastName} has been deleted.`,
      })

      // Refresh the list
      clearSearchCache()
      await loadPatients(currentPage)
    } catch (err) {
      console.error('Failed to delete patient:', err)
      toast({
        title: "Delete Failed",
        description: "Failed to delete patient. Please try again.",
        variant: "destructive"
      })
    } finally {
      setDeletingPatientId(null)
      setPatientToDelete(null)
    }
  }

  const handleDeleteCancel = () => {
    setPatientToDelete(null)
  }

  const getPatientTier = (patient: Patient): MembershipTier => {
    return patient.memberBenefits?.membershipTier || 'standard'
  }

  const getPatientDiscount = (patient: Patient): number => {
    return patient.memberBenefits?.discountPercentage ?? TIER_DISCOUNTS[getPatientTier(patient)]
  }

  // Apply tier filter
  const filteredPatients = patients.filter(patient => {
    if (tierFilter === 'all') return true
    const patientTier = getPatientTier(patient)
    return patientTier === tierFilter
  })

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              Error loading patients: {error}
              <Button onClick={() => loadPatients(1)} className="ml-4" variant="outline">
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
          <h1 className="text-3xl font-bold">Membership Management</h1>
          <p className="text-gray-600">Manage patient membership tiers and discounts</p>
        </div>

        <Button variant="outline" onClick={handleRefresh}>
          <HiRefresh className="w-4 h-4 mr-2" />
          Refresh
        </Button>
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
                  placeholder="Search by name, email... (min 2 chars)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Tier</label>
              <Select value={tierFilter} onValueChange={(value) => setTierFilter(value as 'all' | MembershipTier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="standard">Standard (0%)</SelectItem>
                  <SelectItem value="silver">Silver (10%)</SelectItem>
                  <SelectItem value="gold">Gold (20%)</SelectItem>
                  <SelectItem value="vip">VIP (20%)</SelectItem>
                  <SelectItem value="platinum">Platinum (40%)</SelectItem>
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

            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full">
                <HiSearch className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Membership Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Patient Memberships ({filteredPatients.length} of {pagination?.totalCount || patients.length})
          </CardTitle>
          <CardDescription>
            {canEditPatients
              ? 'Click the tier dropdown to change a patient\'s membership level'
              : 'View patient membership tiers (read-only)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading patients...</span>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Current Tier</TableHead>
                    <TableHead>Discount</TableHead>
                    {canEditPatients && <TableHead>Change Tier</TableHead>}
                    {canDeletePatients && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5 + (canEditPatients ? 1 : 0) + (canDeletePatients ? 1 : 0)} className="text-center py-8 text-gray-500">
                        No patients found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPatients.map((patient) => {
                      const tier = getPatientTier(patient)
                      const discount = getPatientDiscount(patient)
                      const isUpdating = updatingPatientId === (patient._id || patient._id)

                      return (
                        <TableRow key={patient._id || patient.id}>
                          <TableCell className="font-medium">
                            {patient.firstName} {patient.lastName}
                          </TableCell>
                          <TableCell>{patient.email}</TableCell>
                          <TableCell>{patient.phone}</TableCell>
                          <TableCell>
                            <Badge className={TIER_COLORS[tier]}>
                              {tier.charAt(0).toUpperCase() + tier.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {discount > 0 ? (
                              <span className="text-green-600 font-medium">{discount}%</span>
                            ) : (
                              <span className="text-gray-400">No discount</span>
                            )}
                          </TableCell>
                          {canEditPatients && (
                            <TableCell>
                              {isUpdating ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span className="text-sm text-gray-500">Updating...</span>
                                </div>
                              ) : (
                                <Select
                                  value={tier}
                                  onValueChange={(value) => handleTierChange(patient._id ?? patient.id, value as MembershipTier)}
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="standard">Standard (0%)</SelectItem>
                                    <SelectItem value="silver">Silver (10%)</SelectItem>
                                    <SelectItem value="gold">Gold (20%)</SelectItem>
                                    <SelectItem value="vip">VIP (20%)</SelectItem>
                                    <SelectItem value="platinum">Platinum (40%)</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                          )}
                          {canDeletePatients && (
                            <TableCell>
                              {deletingPatientId === (patient._id || patient.id) ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span className="text-sm text-gray-500">Deleting...</span>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteClick(patient)}
                                >
                                  <HiTrash className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>

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
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!patientToDelete} onOpenChange={(open) => !open && handleDeleteCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patient</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">
                {patientToDelete?.firstName} {patientToDelete?.lastName}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
