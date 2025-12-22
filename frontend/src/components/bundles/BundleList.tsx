"use client"

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
// Switch component removed - not used
import { FaSearch, FaPlus, FaEdit, FaTrash, FaEye, FaBox, FaTag, FaFilter, FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import { ImSpinner8 } from "react-icons/im";
import { useBundlesQuery, useDeleteBundleMutation, useBundleCategoriesQuery } from "@/hooks/queries/use-bundles-query";
import { useToast } from "@/components/ui/use-toast";
import type { Bundle, BundleFilters, BundleProduct } from '@/types/bundle';

interface BundleListProps {
  onCreateNew?: () => void;
  onEdit?: (bundle: Bundle) => void;
  onView: (bundle: Bundle) => void;
  canDelete?: boolean;
}

export function BundleList({ onCreateNew, onEdit, onView, canDelete = false }: BundleListProps) {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  
  const [filters, setFilters] = useState<BundleFilters>({
    search: '',
    category: undefined,
    isActive: true,
    isPromoted: undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  
  const { data: bundlesData, isLoading: loading, error } = useBundlesQuery(filters, currentPage, 10);
  const { data: categories = [] } = useBundleCategoriesQuery();
  const deleteBundleMutation = useDeleteBundleMutation();
  
  const bundles = Array.isArray(bundlesData) ? bundlesData : bundlesData?.data || [];
  const totalPages = bundlesData?.pagination?.totalPages || 0;
  const page = bundlesData?.pagination?.page || currentPage;

  const [showFilters, setShowFilters] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    bundle: Bundle | null;
  }>({ open: false, bundle: null });

  const handleFilterChange = (field: keyof BundleFilters, value: string | boolean | number | string[] | undefined) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleDeleteBundle = async () => {
    if (!deleteDialog.bundle) return;
    
    try {
      await deleteBundleMutation.mutateAsync(deleteDialog.bundle._id);
      setDeleteDialog({ open: false, bundle: null });
      toast({
        title: "Success",
        description: "Bundle deleted successfully",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete bundle",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined || isNaN(price)) {
      return 'S$0.00';
    }
    return `S$${price.toFixed(2)}`;
  };

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p>Error loading bundles. Please try again.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search bundles..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10 w-[300px]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <FaFilter />
            Filters
          </Button>
        </div>
        {onCreateNew && (
          <Button onClick={onCreateNew} className="gap-2">
            <FaPlus />
            Create Bundle
          </Button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Category</Label>
              <Select
                value={filters.category || 'all'}
                onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={filters.isActive === undefined ? 'all' : filters.isActive.toString()}
                onValueChange={(value) => handleFilterChange('isActive', value === 'all' ? undefined : value === 'true')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Promoted</Label>
              <Select
                value={filters.isPromoted === undefined ? 'all' : filters.isPromoted.toString()}
                onValueChange={(value) => handleFilterChange('isPromoted', value === 'all' ? undefined : value === 'true')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Promoted</SelectItem>
                  <SelectItem value="false">Not Promoted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Sort By</Label>
              <Select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onValueChange={(value) => {
                  const [sortBy, sortOrder] = value.split('-');
                  handleFilterChange('sortBy', sortBy as 'name' | 'category' | 'totalPrice' | 'isPromoted' | 'createdAt');
                  handleFilterChange('sortOrder', sortOrder as 'asc' | 'desc');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">Newest First</SelectItem>
                  <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                  <SelectItem value="price-asc">Price (Low to High)</SelectItem>
                  <SelectItem value="price-desc">Price (High to Low)</SelectItem>
                  <SelectItem value="savings-desc">Highest Savings</SelectItem>
                  <SelectItem value="totalSold-desc">Most Popular</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Bundles List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <ImSpinner8 className="animate-spin text-4xl text-gray-400" />
            </div>
          ) : bundles.length === 0 ? (
            <div className="text-center py-12">
              <FaBox className="mx-auto text-4xl text-gray-400 mb-4" />
              <p className="text-gray-500">No bundles found</p>
              {onCreateNew && (
                <Button onClick={onCreateNew} className="mt-4">
                  Create Your First Bundle
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => {
                        if (filters.sortBy === 'name') {
                          // Toggle sort order if already sorting by name
                          handleFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          // Set to sort by name ascending
                          handleFilterChange('sortBy', 'name');
                          handleFilterChange('sortOrder', 'asc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        Bundle
                        {filters.sortBy === 'name' ? (
                          filters.sortOrder === 'asc' ? (
                            <FaSortUp className="h-3 w-3" />
                          ) : (
                            <FaSortDown className="h-3 w-3" />
                          )
                        ) : (
                          <FaSort className="h-3 w-3 text-gray-400" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Savings</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundles.map((bundle: Bundle) => (
                    <TableRow key={bundle._id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{bundle.name}</div>
                          <div className="text-sm text-gray-500">
                            {bundle.category}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {bundle.bundleProducts.length} items
                          </Badge>
                          {bundle.bundleProducts.slice(0, 2).map((product: BundleProduct, index: number) => (
                            <span key={`${bundle._id}-product-${index}`} className="text-sm text-gray-500">
                              {product.name}
                            </span>
                          ))}
                          {bundle.bundleProducts.length > 2 && (
                            <span className="text-sm text-gray-400">
                              +{bundle.bundleProducts.length - 2} more
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{formatPrice(bundle.bundlePrice)}</div>
                          <div className="text-sm text-gray-500 line-through">
                            {formatPrice(bundle.individualTotalPrice)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="bg-green-500">
                            {bundle.savingsPercentage}% OFF
                          </Badge>
                          <span className="text-sm text-gray-500">
                            Save {formatPrice(bundle.savings)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={bundle.isActive ? "default" : "secondary"}>
                            {bundle.isActive ? "Active" : "Inactive"}
                          </Badge>
                          {bundle.isPromoted && (
                            <Badge variant="default" className="bg-purple-500">
                              <FaTag className="mr-1" />
                              Promoted
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <div className="font-medium">{bundle.totalSold || 0}</div>
                          <div className="text-sm text-gray-500">sold</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(bundle)}
                          >
                            <FaEye />
                          </Button>
                          {onEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(bundle)}
                            >
                              <FaEdit />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteDialog({ open: true, bundle })}
                              className="text-red-600 hover:text-red-700"
                            >
                              <FaTrash />
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => handlePageChange(page - 1)}
                  className={page === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => handlePageChange(pageNum)}
                      isActive={pageNum === page}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => handlePageChange(page + 1)}
                  className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => !deleteBundleMutation.isPending && setDeleteDialog({ open, bundle: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bundle</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteDialog.bundle?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, bundle: null })}
              disabled={deleteBundleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteBundle}
              disabled={deleteBundleMutation.isPending}
            >
              {deleteBundleMutation.isPending ? (
                <>
                  <ImSpinner8 className="mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}