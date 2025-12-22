"use client"

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useBrands, useCreateBrand, useUpdateBrand, useDeleteBrand } from "@/hooks/queries/use-common-queries"
import { BrandForm } from "@/components/brands/brand-form"
import { BrandList } from "@/components/brands/brand-list"
import type { BrandFormData, BrandStatus } from "@/types/brands"
import { HiPlus, HiSearch, HiFilter } from "react-icons/hi"

// Type for brands returned by useBrands hook
type ApiBrand = {
  _id: string;
  name: string;
  description?: string;
  active: boolean;
  status?: BrandStatus;
}

export default function BrandsPage() {
  const { data: brands = [], isLoading: loading } = useBrands()
  const createBrandMutation = useCreateBrand()
  const updateBrandMutation = useUpdateBrand()
  const deleteBrandMutation = useDeleteBrand()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<BrandStatus | 'all'>('all')
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | 'all'>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter brands on client side since TanStack Query doesn't support server-side filtering
  const filteredBrands = brands.filter((brand: ApiBrand) => {
    if (searchTerm && !brand.name?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    if (statusFilter !== 'all' && brand.status !== statusFilter) {
      return false
    }
    if (isActiveFilter !== 'all' && brand.active !== isActiveFilter) {
      return false
    }
    return true
  })

  const handleCreateBrand = async (data: BrandFormData) => {
    setIsSubmitting(true)
    try {
      await createBrandMutation.mutateAsync(data)
      setIsCreateDialogOpen(false)
    } catch (error) {
      console.error('Failed to create brand:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateBrand = async (id: string, data: Partial<BrandFormData>) => {
    try {
      await updateBrandMutation.mutateAsync({ id, data })
    } catch (error) {
      console.error('Failed to update brand:', error)
    }
  }

  const handleDeleteBrand = async (brand: ApiBrand) => {
    try {
      await deleteBrandMutation.mutateAsync(brand._id)
    } catch (error) {
      console.error('Failed to delete brand:', error)
    }
  }


  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Brand Management</h1>
          <p className="text-gray-600">Manage your product brands and suppliers</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <HiPlus className="w-4 h-4 mr-2" />
              Add Brand
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Brand</DialogTitle>
            </DialogHeader>
            <BrandForm
              onSubmit={handleCreateBrand}
              onCancel={() => setIsCreateDialogOpen(false)}
              loading={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HiFilter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <HiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search brands..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as BrandStatus | 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Active Status</label>
              <Select value={isActiveFilter.toString()} onValueChange={(value) => setIsActiveFilter(value === 'all' ? 'all' : value === 'true')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Active Only</SelectItem>
                  <SelectItem value="false">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button className="w-full" disabled>
                <HiSearch className="w-4 h-4 mr-2" />
                Filters Applied
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brands Table */}
      <Card>
        <CardHeader>
          <CardTitle>Brands ({filteredBrands.length})</CardTitle>
          <CardDescription>
            Manage your brand portfolio and supplier relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandList 
            brands={filteredBrands}
            loading={loading}
            onUpdateBrand={handleUpdateBrand}
            onDeleteBrand={handleDeleteBrand}
            isSubmitting={isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  )
}