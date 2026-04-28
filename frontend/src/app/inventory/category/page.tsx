"use client"

import { useState, useEffect, useCallback } from "react"
import { HiPlus } from "react-icons/hi2"
import { useToast } from "@/components/ui/toast"
import type { ProductCategory, CreateCategoryRequest, UpdateCategoryRequest } from "@/types/inventory/category.types"
import { useCategoriesQuery, useCreateCategoryMutation, useUpdateCategoryMutation, useDeleteCategoryMutation } from "@/hooks/queries/use-categories-query"
import { useCategoryFilters } from "@/hooks/categories/useCategoryFilters"
import { CategoryFormDialog } from "@/components/categories/CategoryFormDialog"
import { CategoryDeleteDialog } from "@/components/categories/CategoryDeleteDialog"
import { CategoryTableRow } from "@/components/categories/CategoryTableRow"
import {
  EditorialPage,
  EditorialMasthead,
  EditorialStats,
  EditorialStat,
  EditorialSearch,
  EditorialButton,
  EditorialTable,
  EditorialTHead,
  EditorialTh,
  EditorialEmptyRow,
  EditorialPagination,
  EditorialErrorScreen,
} from "@/components/ui/editorial"

export default function CategoryPage() {
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const { toast } = useToast()

  const { data: categories = [], isLoading: loading, error } = useCategoriesQuery()
  const createCategoryMutation = useCreateCategoryMutation()
  const updateCategoryMutation = useUpdateCategoryMutation()
  const deleteCategoryMutation = useDeleteCategoryMutation()

  const {
    filteredCategories,
    filters,
    sort,
    setSearch,
    handleSort,
  } = useCategoryFilters({ categories })

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedCategories = filteredCategories.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [filters.search, filters.isActive, filters.level, filters.parent])

  const handleSearch = useCallback((term: string) => setSearch(term), [setSearch])

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

  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error) return error.message
    if (typeof error === 'object' && error !== null && 'message' in error) return String((error as { message: string }).message)
    return fallback
  }

  const handleFormSubmit = async (data: CreateCategoryRequest | UpdateCategoryRequest) => {
    try {
      if (dialogMode === 'create') {
        await createCategoryMutation.mutateAsync(data as CreateCategoryRequest)
        toast({ title: "Success", description: "Category created successfully", variant: "success" })
      } else if (dialogMode === 'edit') {
        await updateCategoryMutation.mutateAsync(data as UpdateCategoryRequest)
        toast({ title: "Success", description: "Category updated successfully", variant: "success" })
      }
      closeDialogs()
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error, dialogMode === 'create' ? "Failed to create category" : "Failed to update category"),
        variant: "destructive",
      })
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedCategory) return
    try {
      await deleteCategoryMutation.mutateAsync(selectedCategory.id)
      toast({ title: "Success", description: "Category deleted successfully", variant: "success" })
      closeDialogs()
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to delete category"),
        variant: "destructive",
      })
    }
  }

  const isLoading = createCategoryMutation.isPending ||
    updateCategoryMutation.isPending ||
    deleteCategoryMutation.isPending

  if (error) {
    return (
      <EditorialErrorScreen
        title="Could not load categories."
        description="There was an error reaching the category service."
        onRetry={() => window.location.reload()}
      />
    )
  }

  const totalCategories = categories.length
  const activeCategories = categories.filter((c) => c.isActive).length
  const distinctLevels = new Set(categories.map((c) => c.level)).size

  return (
    <EditorialPage>
      <EditorialMasthead
        kicker="Inventory · Categories"
        title="Taxonomy"
        subtitle={
          <>
            <span className="tabular-nums">{totalCategories}</span> categor{totalCategories === 1 ? 'y' : 'ies'} on file
          </>
        }
      >
        <EditorialSearch onSearch={handleSearch} placeholder="Search categories..." />
        <EditorialButton variant="primary" icon={<HiPlus className="h-3 w-3" />} arrow onClick={handleCreate} disabled={isLoading}>
          New category
        </EditorialButton>
      </EditorialMasthead>

      <EditorialStats columns={3}>
        <EditorialStat index="i." label="Total categories" value={totalCategories} caption={<><span className="tabular-nums">{activeCategories}</span> active</>} />
        <EditorialStat index="ii." label="Levels" value={distinctLevels} caption="hierarchy depth" />
        <EditorialStat index="iii." label="Showing" value={filteredCategories.length} caption="after filters" />
      </EditorialStats>

      <EditorialTable>
        <EditorialTHead>
          <EditorialTh sortKey="name" currentSort={sort.field} currentOrder={sort.order} onSort={handleSort as (k: string) => void}>Name</EditorialTh>
          <EditorialTh sortKey="description" currentSort={sort.field} currentOrder={sort.order} onSort={handleSort as (k: string) => void}>Description</EditorialTh>
          <EditorialTh align="center" sortKey="level" currentSort={sort.field} currentOrder={sort.order} onSort={handleSort as (k: string) => void}>Level</EditorialTh>
          <EditorialTh sortKey="createdAt" currentSort={sort.field} currentOrder={sort.order} onSort={handleSort as (k: string) => void}>Created</EditorialTh>
          <EditorialTh align="right" className="w-32">Actions</EditorialTh>
        </EditorialTHead>
        <tbody>
          {loading ? (
            <EditorialEmptyRow colSpan={5} title="Loading" description="Fetching categories…" />
          ) : paginatedCategories.length === 0 ? (
            <EditorialEmptyRow
              colSpan={5}
              description={filters.search ? `No categories matching "${filters.search}".` : 'No categories yet. Create your first one to get started.'}
            />
          ) : (
            paginatedCategories.map((category, index) => (
              <CategoryTableRow
                key={category.id || `category-${index}-${category.name}`}
                category={category}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          )}
        </tbody>
      </EditorialTable>

      {filteredCategories.length > 0 && (
        <EditorialPagination
          total={filteredCategories.length}
          page={currentPage}
          limit={itemsPerPage}
          pages={totalPages}
          onPageChange={setCurrentPage}
          onLimitChange={(l) => { setItemsPerPage(l); setCurrentPage(1) }}
        />
      )}

      <CategoryFormDialog
        open={dialogMode === 'create' || dialogMode === 'edit'}
        onOpenChange={(open) => !open && closeDialogs()}
        mode={dialogMode === 'create' ? 'create' : 'edit'}
        category={selectedCategory}
        onSubmit={handleFormSubmit}
        loading={isLoading}
      />

      <CategoryDeleteDialog
        open={dialogMode === 'delete'}
        onOpenChange={(open) => !open && closeDialogs()}
        category={selectedCategory}
        onConfirm={handleDeleteConfirm}
        loading={isLoading}
      />
    </EditorialPage>
  )
}
