"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { FaPlus } from "react-icons/fa"
import { useToast } from "@/components/ui/toast"
import type { ProductCategory, CreateCategoryRequest, UpdateCategoryRequest } from "@/types/inventory/category.types"
import { useCategoriesQuery, useCreateCategoryMutation, useUpdateCategoryMutation, useDeleteCategoryMutation } from "@/hooks/queries/use-categories-query"
import { useCategoryFilters } from "@/hooks/categories/useCategoryFilters"
import { CategoryFormDialog } from "@/components/categories/CategoryFormDialog"
import { CategoryDeleteDialog } from "@/components/categories/CategoryDeleteDialog"
import { CategoryTableHeader } from "@/components/categories/CategoryTableHeader"
import { CategoryTableRow } from "@/components/categories/CategoryTableRow"
import { CategorySearchBar } from "@/components/categories/CategorySearchBar"

export default function CategoryPage() {
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const { toast, ToastContainer } = useToast()

  // Data fetching
  const { data: categories = [], isLoading: loading, error } = useCategoriesQuery()
  const createCategoryMutation = useCreateCategoryMutation()
  const updateCategoryMutation = useUpdateCategoryMutation()
  const deleteCategoryMutation = useDeleteCategoryMutation()

  // Filtering and sorting
  const {
    filteredCategories,
    filters,
    sort,
    setSearch,
    handleSort,
    clearFilters,
  } = useCategoryFilters({ categories })

  // Pagination logic
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedCategories = filteredCategories.slice(startIndex, startIndex + itemsPerPage)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters.search, filters.isActive, filters.level, filters.parent])

  // Dialog handlers
  const handleCreate = () => {
    setSelectedCategory(null)
    setDialogMode('create')
  }

  const handleEdit = (category: ProductCategory) => {
    setSelectedCategory(category)
    setDialogMode('edit')
  }

  const handleDelete = (category: ProductCategory) => {
    setSelectedCategory(category)
    setDialogMode('delete')
  }

  const closeDialogs = () => {
    setDialogMode(null)
    setSelectedCategory(null)
  }

  // Form submission handlers
  const handleFormSubmit = async (data: CreateCategoryRequest | UpdateCategoryRequest) => {
    try {
      if (dialogMode === 'create') {
        await createCategoryMutation.mutateAsync(data as CreateCategoryRequest)
        toast({
          title: "Success",
          description: "Category created successfully",
          variant: "success",
        })
      } else if (dialogMode === 'edit') {
        await updateCategoryMutation.mutateAsync(data as UpdateCategoryRequest)
        toast({
          title: "Success",
          description: "Category updated successfully",
          variant: "success",
        })
      }
      closeDialogs()
    } catch {
      toast({
        title: "Error",
        description: dialogMode === 'create' ? "Failed to create category" : "Failed to update category",
        variant: "destructive",
      })
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedCategory) return

    try {
      await deleteCategoryMutation.mutateAsync(selectedCategory.id)
      toast({
        title: "Success",
        description: "Category deleted successfully",
        variant: "success",
      })
      closeDialogs()
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      })
    }
  }

  // Loading state for mutations
  const isLoading = createCategoryMutation.isPending || 
                   updateCategoryMutation.isPending || 
                   deleteCategoryMutation.isPending

  // Handle error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-600 mb-4">Failed to load categories</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <ToastContainer />

      <header className="shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Category Management</h1>
              <p className="text-gray-600">
                Manage product categories and organize your inventory
                {categories.length > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {categories.length} total
                  </span>
                )}
              </p>
            </div>
            <Button onClick={handleCreate} disabled={isLoading}>
              <FaPlus className="w-4 h-4 mr-2" />
              New Category
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Create and manage product categories to organize your inventory effectively
            </CardDescription>
            <CategorySearchBar
              filters={filters}
              onSearchChange={setSearch}
              onClearFilters={clearFilters}
              totalCount={categories.length}
              filteredCount={filteredCategories.length}
            />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <CategoryTableHeader
                  sort={sort}
                  onSort={handleSort}
                />
                <TableBody className="max-h-[600px] overflow-y-auto">
                  {(() => {
                    if (loading) {
                      return (
                        <TableRow key="loading" className="border-b-0">
                          <TableCell colSpan={4} className="text-center border-b-0 py-8">
                            <div className="flex items-center justify-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              <span>Loading categories...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    }
                    
                    if (paginatedCategories.length === 0) {
                      return (
                        <TableRow key="no-results" className="border-b-0">
                          <TableCell colSpan={4} className="text-center border-b-0 py-8">
                            <div className="text-gray-500">
                              {filters.search ? (
                                <>
                                  No categories found matching &quot;<span className="font-medium">{filters.search}</span>&quot;
                                </>
                              ) : (
                                "No categories available. Create your first category to get started."
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    }
                    
                    return paginatedCategories.map((category, index) => (
                      <CategoryTableRow
                        key={category.id || `category-${index}-${category.name}`}
                        category={category}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))
                  })()}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-gray-500">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredCategories.length)} of {filteredCategories.length} categories
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Form Dialog */}
      <CategoryFormDialog
        open={dialogMode === 'create' || dialogMode === 'edit'}
        onOpenChange={(open) => !open && closeDialogs()}
        mode={dialogMode === 'create' ? 'create' : 'edit'}
        category={selectedCategory}
        onSubmit={handleFormSubmit}
        loading={isLoading}
      />

      {/* Delete Dialog */}
      <CategoryDeleteDialog
        open={dialogMode === 'delete'}
        onOpenChange={(open) => !open && closeDialogs()}
        category={selectedCategory}
        onConfirm={handleDeleteConfirm}
        loading={isLoading}
      />
    </div>
  )
} 