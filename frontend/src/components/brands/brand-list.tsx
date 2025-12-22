"use client"

import React from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { BrandForm } from "./brand-form"
import type { BrandFormData, BrandStatus } from "@/types/brands"
import { HiPencilAlt, HiTrash } from "react-icons/hi"

// Type for brands returned by API
type ApiBrand = {
  _id: string;
  name: string;
  description?: string;
  active: boolean;
  status?: BrandStatus;
}

interface BrandListProps {
  brands: ApiBrand[]
  loading: boolean
  onUpdateBrand: (id: string, data: BrandFormData) => Promise<void>
  onDeleteBrand: (brand: ApiBrand) => Promise<void>
  isSubmitting: boolean
}

export function BrandList({ 
  brands, 
  loading, 
  onUpdateBrand, 
  onDeleteBrand, 
  isSubmitting 
}: BrandListProps) {
  const [selectedBrand, setSelectedBrand] = React.useState<ApiBrand | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)

  const getStatusBadgeVariant = (status: BrandStatus) => {
    switch (status) {
      case 'active': return 'default'
      case 'inactive': return 'secondary'
      case 'discontinued': return 'destructive'
      case 'pending_approval': return 'outline'
      default: return 'secondary'
    }
  }

  const handleUpdateBrand = async (data: BrandFormData) => {
    if (!selectedBrand) return
    
    try {
      await onUpdateBrand(selectedBrand._id, data)
      setIsEditDialogOpen(false)
      setSelectedBrand(null)
    } catch (error) {
      console.error('Failed to update brand:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-600">Loading brands...</div>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Active</TableHead>
          <TableHead>Exclusive</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {brands.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-gray-500">
              No brands found. Click &quot;Add Brand&quot; to create your first brand.
            </TableCell>
          </TableRow>
        ) : (
          brands.map((brand) => (
            <TableRow key={brand._id}>
              <TableCell>
                <div>
                  <div className="font-medium">{brand.name}</div>
                  {brand.description && (
                    <div className="text-sm text-gray-500 truncate max-w-xs">
                      {brand.description}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                  {brand._id.slice(-6)}
                </code>
              </TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(brand.status || 'active')}>
                  {(brand.status || 'active').replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm text-gray-500">
                  No contact info
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={brand.active ? "default" : "secondary"}>
                  {brand.active ? "Yes" : "No"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  N/A
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Dialog open={isEditDialogOpen && selectedBrand?._id === brand._id} onOpenChange={(open) => {
                    setIsEditDialogOpen(open)
                    if (!open) setSelectedBrand(null)
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedBrand(brand)}
                      >
                        <HiPencilAlt className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Edit Brand: {brand.name}</DialogTitle>
                      </DialogHeader>
                      <BrandForm
                        brand={brand}
                        onSubmit={handleUpdateBrand}
                        onCancel={() => {
                          setIsEditDialogOpen(false)
                          setSelectedBrand(null)
                        }}
                        loading={isSubmitting}
                      />
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <HiTrash className="w-4 h-4 text-red-600" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Brand</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete &quot;{brand.name}&quot;? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDeleteBrand(brand)}
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
          ))
        )}
      </TableBody>
    </Table>
  )
}