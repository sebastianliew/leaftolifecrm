"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HiSquare2Stack, HiPencil, HiTrash } from "react-icons/hi2"
import { FaChevronUp, FaChevronDown } from "react-icons/fa"
import { useUnitsQuery, useCreateUnitMutation, useUpdateUnitMutation, useDeleteUnitMutation } from "@/hooks/queries/use-units-query"
import { useToast } from "@/components/ui/toast"
import { UnitForm } from "@/components/inventory/unit-form"
import type { UnitOfMeasurement } from "@/types/inventory"
import Image from "next/image"

export default function UnitsPage() {
  const { data: units = [], isLoading: loading, error } = useUnitsQuery()
  const createUnitMutation = useCreateUnitMutation()
  const updateUnitMutation = useUpdateUnitMutation()
  const deleteUnitMutation = useDeleteUnitMutation()
  
  const { toast, ToastContainer } = useToast()

  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedUnit, setSelectedUnit] = useState<UnitOfMeasurement | null>(null)
  const [unitToDelete, setUnitToDelete] = useState<UnitOfMeasurement | null>(null)
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  // Show error if API call failed
  if (error) {
    console.error('Failed to fetch units:', error)
  }

  const filteredUnits = units.filter((unit) => {
    const matchesSearch = searchTerm === "" || 
      unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.abbreviation.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === "all" || unit.type === typeFilter
    return Boolean(matchesSearch && matchesType)
  })
  
  // Sort the filtered units
  const sortedUnits = [...filteredUnits].sort((a, b) => {
    let aValue: unknown;
    let bValue: unknown;
    
    switch (sortBy) {
      case "name":
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case "abbreviation":
        aValue = a.abbreviation.toLowerCase();
        bValue = b.abbreviation.toLowerCase();
        break;
      case "type":
        aValue = a.type;
        bValue = b.type;
        break;
      case "status":
        aValue = a.isActive;
        bValue = b.isActive;
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

  const handleCreateUnit = async (data: Partial<UnitOfMeasurement>) => {
    try {
      await createUnitMutation.mutateAsync(data)
      setSelectedUnit(null)
      toast({
        title: "Success",
        description: "Unit created successfully",
        variant: "success",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to create unit",
        variant: "destructive",
      })
    }
  }

  const handleUpdateUnit = async (data: Partial<UnitOfMeasurement>) => {
    if (!selectedUnit?._id && !selectedUnit?.id) return
    try {
      await updateUnitMutation.mutateAsync({ id: selectedUnit._id || selectedUnit.id, data })
      setSelectedUnit(null)
      toast({
        title: "Success",
        description: "Unit updated successfully",
        variant: "success",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to update unit",
        variant: "destructive",
      })
    }
  }

  const openEditDialog = (unit: UnitOfMeasurement) => {
    setSelectedUnit(unit)
  }

  const handleDeleteUnit = async (unit: UnitOfMeasurement) => {
    setUnitToDelete(unit)
  }

  const confirmDelete = async () => {
    if (!unitToDelete?._id && !unitToDelete?.id) return
    try {
      await deleteUnitMutation.mutateAsync(unitToDelete._id || unitToDelete.id)
      setUnitToDelete(null)
      toast({
        title: "Success",
        description: "Unit deleted successfully",
        variant: "success",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete unit",
        variant: "destructive",
      })
    }
  }

  const cancelDelete = () => {
    setUnitToDelete(null)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "weight":
        return "bg-blue-100 text-blue-800"
      case "volume":
        return "bg-green-100 text-green-800"
      case "count":
        return "bg-purple-100 text-purple-800"
      case "length":
        return "bg-yellow-100 text-yellow-800"
      case "area":
        return "bg-red-100 text-red-800"
      case "temperature":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const totalUnits = units.length
  const activeUnits = units.filter((u) => u.isActive).length

  return (
    <div>
      <ToastContainer />

      {/* Delete Confirmation Dialog */}
      {unitToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Delete Unit</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete &quot;{unitToDelete.name}&quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelDelete} disabled={deleteUnitMutation.isPending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleteUnitMutation.isPending}>
                {deleteUnitMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedUnit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <UnitForm
              unit={selectedUnit}
              onSubmit={selectedUnit._id || selectedUnit.id ? handleUpdateUnit : handleCreateUnit}
              onCancel={() => setSelectedUnit(null)}
              loading={createUnitMutation.isPending || updateUnitMutation.isPending}
              units={units}
            />
          </div>
        </div>
      )}

      <header className="shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Units of Measurement</h1>
              <p className="text-gray-600">Manage measurement units for your inventory</p>
            </div>
            <Button onClick={() => setSelectedUnit({} as UnitOfMeasurement)} disabled={loading}>
              <HiSquare2Stack className="w-4 h-4 mr-2" />
              New Unit
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Units</CardTitle>
              <div className="w-12 h-12 relative">
                <Image src="/Ruler.png" alt="Total Units" fill className="object-contain" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUnits}</div>
              <p className="text-xs text-muted-foreground">{activeUnits} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unit Types</CardTitle>
              <div className="w-12 h-12 relative">
                <Image src="/Box.png" alt="Unit Types" fill className="object-contain" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{new Set(units.map(u => u.type)).size}</div>
              <p className="text-xs text-muted-foreground">Different measurement types</p>
            </CardContent>
          </Card>
        </div>

        {/* Units Table */}
        <Card>
          <CardHeader>
            <CardTitle>Units ({sortedUnits.length})</CardTitle>
            <CardDescription>Manage your measurement units</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Input
                  placeholder="Search units..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="weight">Weight</SelectItem>
                  <SelectItem value="volume">Volume</SelectItem>
                  <SelectItem value="count">Count</SelectItem>
                  <SelectItem value="length">Length</SelectItem>
                  <SelectItem value="area">Area</SelectItem>
                  <SelectItem value="temperature">Temperature</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="text-gray-500">Loading units...</div>
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
                        onClick={() => handleSort("abbreviation")}
                      >
                        <div className="flex items-center gap-1">
                          Abbreviation
                          {sortBy === "abbreviation" && (
                            sortOrder === "asc" ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort("type")}
                      >
                        <div className="flex items-center gap-1">
                          Type
                          {sortBy === "type" && (
                            sortOrder === "asc" ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead>Description</TableHead>
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
                    {sortedUnits.map((unit) => (
                      <TableRow key={unit._id || unit.id}>
                        <TableCell>
                          <div className="font-medium">{unit.name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-500">{unit.abbreviation}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getTypeColor(unit.type)}>
                            {unit.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-600">{unit.description || '-'}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={unit.isActive ? "default" : "secondary"}>
                            {unit.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(unit)}
                              title="Edit Unit"
                            >
                              <HiPencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteUnit(unit)}
                              className="text-red-600 hover:text-red-700"
                              title="Delete Unit"
                            >
                              <HiTrash className="w-4 h-4" />
                            </Button>
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
    </div>
  )
} 