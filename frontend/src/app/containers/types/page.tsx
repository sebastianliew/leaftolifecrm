"use client"

import { useState } from "react"
import { Plus, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { ContainerTypeForm } from "@/components/containers/container-type-form"
import { useContainerTypesQuery, useCreateContainerTypeMutation, useUpdateContainerTypeMutation, useDeleteContainerTypeMutation } from "@/hooks/queries/use-container-types-query"
import { useToast } from "@/components/ui/use-toast"
import type { ContainerType } from "@/types/container"

export default function ContainerTypesPage() {
  const { toast } = useToast()
  const [selectedContainerType, setSelectedContainerType] = useState<ContainerType | undefined>()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const { data: containerTypes = [], isLoading, error } = useContainerTypesQuery()
  const createMutation = useCreateContainerTypeMutation()
  const updateMutation = useUpdateContainerTypeMutation()
  const deleteMutation = useDeleteContainerTypeMutation()

  const handleCreate = async (data: ContainerType) => {
    try {
      await createMutation.mutateAsync(data)
      setIsDialogOpen(false)
      toast({
        title: "Success",
        description: "Container type created successfully",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to create container type",
        variant: "destructive",
      })
    }
  }

  const handleUpdate = async (data: ContainerType) => {
    if (!selectedContainerType) return
    
    try {
      await updateMutation.mutateAsync({ id: selectedContainerType.id, data })
      setIsDialogOpen(false)
      setSelectedContainerType(undefined)
      toast({
        title: "Success",
        description: "Container type updated successfully",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to update container type",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      toast({
        title: "Success",
        description: "Container type deleted successfully",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete container type",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (containerType: ContainerType) => {
    setSelectedContainerType(containerType)
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setSelectedContainerType(undefined)
  }

  // Pagination calculations
  const totalPages = Math.ceil(containerTypes.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedContainerTypes = containerTypes.slice(startIndex, startIndex + itemsPerPage)

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              Error loading container types. Please try again.
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Container Types</h1>
          <p className="text-muted-foreground">
            Manage container types and their allowed units of measurement
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedContainerType(undefined)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Container Type
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedContainerType ? "Edit Container Type" : "Create Container Type"}
              </DialogTitle>
            </DialogHeader>
            <ContainerTypeForm
              containerType={selectedContainerType}
              onSubmit={selectedContainerType ? handleUpdate : handleCreate}
              onCancel={handleCloseDialog}
              loading={createMutation.isPending || updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="border rounded-lg overflow-hidden">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-100 border-b"></div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-50 border-b"></div>
            ))}
          </div>
        </div>
      ) : containerTypes.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-muted-foreground mb-4">
                No container types found. Create your first container type to get started.
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setSelectedContainerType(undefined)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Container Type
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Name</TableHead>
                  <TableHead className="w-96">Description</TableHead>
                  <TableHead className="w-48">Allowed Units</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                  <TableHead className="w-24 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContainerTypes.map((containerType) => (
                  <TableRow key={containerType.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="font-medium">{containerType.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {containerType.description || "No description"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {containerType.allowedUoms?.length > 0 ? (
                          containerType.allowedUoms.map((uom) => (
                            <Badge key={uom} variant="outline" className="text-xs">
                              {uom}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">No units specified</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={containerType.isActive ? "default" : "secondary"}>
                        {containerType.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(containerType)}
                          title={`Edit ${containerType.name}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" title={`Delete ${containerType.name}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Container Type</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &quot;{containerType.name}&quot;? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(containerType.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {containerTypes.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, containerTypes.length)} of {containerTypes.length} container types
            </p>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="px-3 py-1 text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}