"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiStar } from "react-icons/fi"
import { FaChevronUp, FaChevronDown } from "react-icons/fa"
import Link from "next/link"
import { useSuppliers } from "@/hooks/suppliers/useSuppliers"
import { SupplierForm } from "@/components/suppliers/supplier-form"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/usePermissions"
import type { Supplier, SupplierFormData } from "@/types/suppliers/supplier.types"
import Image from "next/image"

export default function SuppliersPage() {
  const { suppliers, loading, getSuppliers, createSupplier, updateSupplier, deleteSupplier } = useSuppliers()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()

  // Check supplier permissions
  const canAddSuppliers = hasPermission('suppliers', 'canAddSuppliers')
  const canEditSuppliers = hasPermission('suppliers', 'canEditSuppliers')
  const canDeleteSuppliers = hasPermission('suppliers', 'canDeleteSuppliers')

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null)
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  useEffect(() => {
    getSuppliers()
  }, [getSuppliers])

  const handleCreateSupplier = async (data: SupplierFormData) => {
    setActionLoading(true)
    try {
      await createSupplier(data)
      setShowCreateDialog(false)
      toast({
        title: "Success",
        description: "Supplier created successfully",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to create supplier",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateSupplier = async (data: SupplierFormData) => {
    if (!selectedSupplier) return
    setActionLoading(true)
    try {
      await updateSupplier(selectedSupplier.id, data)
      setShowEditDialog(false)
      setSelectedSupplier(null)
      toast({
        title: "Success",
        description: "Supplier updated successfully",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to update supplier",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const openEditDialog = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setShowEditDialog(true)
  }

  const handleDeleteSupplier = async (supplier: Supplier) => {
    setSupplierToDelete(supplier)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!supplierToDelete) return
    setActionLoading(true)
    try {
      await deleteSupplier(supplierToDelete.id)
      setShowDeleteDialog(false)
      setSupplierToDelete(null)
      toast({
        title: "Success",
        description: "Supplier deleted successfully",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete supplier",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "inactive":
        return "bg-gray-100 text-gray-800"
      case "suspended":
        return "bg-red-100 text-red-800"
      case "pending_approval":
        return "bg-yellow-100 text-yellow-800"
      case "blacklisted":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const totalSuppliers = suppliers.length
  const activeSuppliers = suppliers.filter((s) => s.status === "active").length
  const preferredSuppliers = suppliers.filter((s) => s.isPreferred).length
  const approvalRequiredSuppliers = suppliers.filter((s) => s.requiresApproval).length
  
  // Sort suppliers
  const sortedSuppliers = [...suppliers].sort((a, b) => {
    let aValue: unknown;
    let bValue: unknown;
    
    switch (sortBy) {
      case "name":
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case "code":
        aValue = a.code?.toLowerCase() || '';
        bValue = b.code?.toLowerCase() || '';
        break;
      case "contactPerson":
        aValue = (a.contactPerson || "").toLowerCase();
        bValue = (b.contactPerson || "").toLowerCase();
        break;
      case "email":
        aValue = (a.email || "").toLowerCase();
        bValue = (b.email || "").toLowerCase();
        break;
      case "businessType":
        aValue = a.businessType || "";
        bValue = b.businessType || "";
        break;
      case "status":
        aValue = a.status;
        bValue = b.status;
        break;
      default:
        return 0;
    }
    
    if ((aValue as string) < (bValue as string)) return sortOrder === "asc" ? -1 : 1;
    if ((aValue as string) > (bValue as string)) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });
  
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  }

  return (
    <div>
      <header className="shadow-sm border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Supplier Management</h1>
              <p className="text-gray-600">Manage suppliers and vendor relationships</p>
            </div>
            {canAddSuppliers && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <FiPlus className="w-4 h-4 mr-2" />
                New Supplier
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 min-h-screen">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
              <div className="w-12 h-12 relative">
                <Image
                  src="/Distribution.png"
                  alt="Total Suppliers"
                  fill
                  className="object-contain"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSuppliers}</div>
              <p className="text-xs text-muted-foreground">{activeSuppliers} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Preferred Suppliers</CardTitle>
              <div className="w-12 h-12 relative">
                <Image
                  src="/Quality Check.png"
                  alt="Preferred Suppliers"
                  fill
                  className="object-contain"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{preferredSuppliers}</div>
              <p className="text-xs text-muted-foreground">Top tier partners</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <div className="w-12 h-12 relative">
                <Image
                  src="/Logistic Palette.png"
                  alt="Total Value"
                  fill
                  className="object-contain"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${suppliers.reduce((sum, s) => sum + (s.creditLimit || 0), 0).toLocaleString('en-GB')}
              </div>
              <p className="text-xs text-muted-foreground">Total credit limit</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approval Required</CardTitle>
              <div className="w-12 h-12 relative">
                <Image
                  src="/Check.png"
                  alt="Approval Required"
                  fill
                  className="object-contain"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{approvalRequiredSuppliers}</div>
              <p className="text-xs text-muted-foreground">Need order approval</p>
            </CardContent>
          </Card>
        </div>

        {/* Suppliers Table */}
        <Card>
          <CardHeader>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="text-gray-500">Loading suppliers...</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-1">
                          Name
                          {sortBy === "name" && (
                            sortOrder === "asc" ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort("code")}
                      >
                        <div className="flex items-center gap-1">
                          Code
                          {sortBy === "code" && (
                            sortOrder === "asc" ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort("contactPerson")}
                      >
                        <div className="flex items-center gap-1">
                          Contact Person
                          {sortBy === "contactPerson" && (
                            sortOrder === "asc" ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort("email")}
                      >
                        <div className="flex items-center gap-1">
                          Email
                          {sortBy === "email" && (
                            sortOrder === "asc" ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort("businessType")}
                      >
                        <div className="flex items-center gap-1">
                          Business Type
                          {sortBy === "businessType" && (
                            sortOrder === "asc" ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center gap-1">
                          Status
                          {sortBy === "status" && (
                            sortOrder === "asc" ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSuppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell>
                          <div className="font-medium flex items-center gap-2">
                            {supplier.name}
                            {supplier.isPreferred && <FiStar className="w-4 h-4 text-yellow-500 fill-current" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-500">{supplier.code}</div>
                        </TableCell>
                        <TableCell>
                          {supplier.contactPerson && (
                            <div className="text-sm font-medium">{supplier.contactPerson}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.email && <div className="text-sm text-gray-600">{supplier.email}</div>}
                        </TableCell>
                        <TableCell>
                          {supplier.phone && <div className="text-sm text-gray-600">{supplier.phone}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {supplier.businessType?.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(supplier.status)}>{supplier.status.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/suppliers/${supplier.id}`}>
                                <FiEye className="w-4 h-4" />
                              </Link>
                            </Button>
                            {canEditSuppliers && (
                              <Button size="sm" variant="outline" onClick={() => openEditDialog(supplier)}>
                                <FiEdit2 className="w-4 h-4" />
                              </Button>
                            )}
                            {canDeleteSuppliers && (
                              <Button size="sm" variant="outline" onClick={() => handleDeleteSupplier(supplier)}>
                                <FiTrash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Create Supplier Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Supplier</DialogTitle>
          </DialogHeader>
          <SupplierForm
            onSubmit={handleCreateSupplier}
            onCancel={() => setShowCreateDialog(false)}
            loading={actionLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          {selectedSupplier && (
            <SupplierForm
              supplier={selectedSupplier}
              onSubmit={handleUpdateSupplier}
              onCancel={() => {
                setShowEditDialog(false)
                setSelectedSupplier(null)
              }}
              loading={actionLoading}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {supplierToDelete?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={actionLoading}>
              {actionLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}