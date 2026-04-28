"use client"

import { useState, useCallback, useMemo } from "react"
import { HiPlus, HiPencil, HiTrash, HiFunnel } from "react-icons/hi2"
import { useUnitsQuery, useCreateUnitMutation, useUpdateUnitMutation, useDeleteUnitMutation } from "@/hooks/queries/use-units-query"
import { useToast } from "@/components/ui/toast"
import { UnitForm } from "@/components/inventory/unit-form"
import type { UnitOfMeasurement } from "@/types/inventory"
import {
  EditorialPage,
  EditorialMasthead,
  EditorialStats,
  EditorialStat,
  EditorialSearch,
  EditorialButton,
  EditorialFilterRow,
  EditorialField,
  EditorialSelect,
  EditorialTable,
  EditorialTHead,
  EditorialTh,
  EditorialTr,
  EditorialTd,
  EditorialEmptyRow,
  EditorialModal,
  EditorialModalFooter,
  EditorialMeta,
} from "@/components/ui/editorial"

const typeToneMap: Record<string, string> = {
  weight: 'text-[#0A0A0A]',
  volume: 'text-[#16A34A]',
  count: 'text-[#7C3AED]',
  length: 'text-[#EAB308]',
  area: 'text-[#DC2626]',
  temperature: 'text-[#EA580C]',
}

export default function UnitsPage() {
  const { data: units = [], isLoading: loading } = useUnitsQuery()
  const createUnitMutation = useCreateUnitMutation()
  const updateUnitMutation = useUpdateUnitMutation()
  const deleteUnitMutation = useDeleteUnitMutation()

  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<UnitOfMeasurement | null>(null)
  const [unitToDelete, setUnitToDelete] = useState<UnitOfMeasurement | null>(null)

  const [sortBy, setSortBy] = useState<string>("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  const handleSearch = useCallback((term: string) => setSearchTerm(term), [])

  const sortedUnits = useMemo(() => {
    const filtered = units.filter((unit) => {
      const matchesSearch = !searchTerm ||
        unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        unit.abbreviation.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === "all" || unit.type === typeFilter
      return matchesSearch && matchesType
    })

    return [...filtered].sort((a, b) => {
      const get = (u: UnitOfMeasurement) => {
        switch (sortBy) {
          case "name": return u.name.toLowerCase()
          case "abbreviation": return u.abbreviation.toLowerCase()
          case "type": return u.type
          case "status": return u.isActive ? 1 : 0
          default: return ''
        }
      }
      const aVal = get(a)
      const bVal = get(b)
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1
      return 0
    })
  }, [units, searchTerm, typeFilter, sortBy, sortOrder])

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  const handleCreateUnit = async (data: Partial<UnitOfMeasurement>) => {
    try {
      await createUnitMutation.mutateAsync(data)
      setSelectedUnit(null)
      toast({ title: "Success", description: "Unit created successfully", variant: "success" })
    } catch {
      toast({ title: "Error", description: "Failed to create unit", variant: "destructive" })
    }
  }

  const handleUpdateUnit = async (data: Partial<UnitOfMeasurement>) => {
    if (!selectedUnit?._id && !selectedUnit?.id) return
    try {
      await updateUnitMutation.mutateAsync({ id: selectedUnit._id || selectedUnit.id, data })
      setSelectedUnit(null)
      toast({ title: "Success", description: "Unit updated successfully", variant: "success" })
    } catch {
      toast({ title: "Error", description: "Failed to update unit", variant: "destructive" })
    }
  }

  const confirmDelete = async () => {
    if (!unitToDelete?._id && !unitToDelete?.id) return
    try {
      await deleteUnitMutation.mutateAsync(unitToDelete._id || unitToDelete.id)
      setUnitToDelete(null)
      toast({ title: "Success", description: "Unit deleted successfully", variant: "success" })
    } catch {
      toast({ title: "Error", description: "Failed to delete unit", variant: "destructive" })
    }
  }

  const totalUnits = units.length
  const activeUnits = units.filter((u) => u.isActive).length
  const distinctTypes = new Set(units.map((u) => u.type)).size

  const isModalEditing = !!selectedUnit && (selectedUnit._id || selectedUnit.id)

  return (
    <EditorialPage>
      <EditorialMasthead
        kicker="Inventory · Units"
        title="Measurement"
        subtitle={
          <>
            <span className="tabular-nums">{totalUnits}</span> unit{totalUnits === 1 ? '' : 's'} on file
          </>
        }
      >
        <EditorialSearch onSearch={handleSearch} placeholder="Search units..." />
        <EditorialButton
          variant={showFilters ? 'ghost-active' : 'ghost'}
          icon={<HiFunnel className="h-3 w-3" />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filter
        </EditorialButton>
        <EditorialButton
          variant="primary"
          icon={<HiPlus className="h-3 w-3" />}
          arrow
          onClick={() => setSelectedUnit({} as UnitOfMeasurement)}
          disabled={loading}
        >
          New unit
        </EditorialButton>
      </EditorialMasthead>

      <EditorialStats columns={3}>
        <EditorialStat index="i." label="Total units" value={totalUnits} caption={<><span className="tabular-nums">{activeUnits}</span> active</>} />
        <EditorialStat index="ii." label="Distinct types" value={distinctTypes} caption="measurement classes" />
        <EditorialStat index="iii." label="Showing" value={sortedUnits.length} caption="after filters" />
      </EditorialStats>

      {showFilters && (
        <EditorialFilterRow columns={2}>
          <EditorialField label="Type">
            <EditorialSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              <option value="weight">Weight</option>
              <option value="volume">Volume</option>
              <option value="count">Count</option>
              <option value="length">Length</option>
              <option value="area">Area</option>
              <option value="temperature">Temperature</option>
            </EditorialSelect>
          </EditorialField>
        </EditorialFilterRow>
      )}

      <EditorialTable>
        <EditorialTHead>
          <EditorialTh sortKey="name" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort}>Name</EditorialTh>
          <EditorialTh sortKey="abbreviation" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort}>Abbrev.</EditorialTh>
          <EditorialTh sortKey="type" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort}>Type</EditorialTh>
          <EditorialTh>Description</EditorialTh>
          <EditorialTh sortKey="status" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort}>Status</EditorialTh>
          <EditorialTh align="right" className="w-32">Actions</EditorialTh>
        </EditorialTHead>
        <tbody>
          {loading ? (
            <EditorialEmptyRow colSpan={6} title="Loading" description="Fetching units…" />
          ) : sortedUnits.length === 0 ? (
            <EditorialEmptyRow colSpan={6} description="No units match the current filters." />
          ) : (
            sortedUnits.map((unit) => {
              const tone = typeToneMap[unit.type] || 'text-[#6B7280]'
              return (
                <EditorialTr key={unit._id || unit.id}>
                  <EditorialTd size="lg" className="pr-4">
                    <p className="text-[14px] text-[#0A0A0A] font-medium">{unit.name}</p>
                  </EditorialTd>
                  <EditorialTd className="font-mono tracking-wide">{unit.abbreviation}</EditorialTd>
                  <EditorialTd>
                    <span className={`text-[10px] uppercase tracking-[0.28em] ${tone}`}>{unit.type}</span>
                  </EditorialTd>
                  <EditorialTd className="italic font-light">{unit.description || '—'}</EditorialTd>
                  <EditorialTd>
                    <span className={`text-[10px] uppercase tracking-[0.28em] ${unit.isActive ? 'text-[#16A34A]' : 'text-[#9CA3AF]'}`}>
                      {unit.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </EditorialTd>
                  <EditorialTd align="right">
                    <div className="flex items-center justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setSelectedUnit(unit)} title="Edit" className="text-[#6B7280] hover:text-[#0A0A0A] transition-colors">
                        <HiPencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setUnitToDelete(unit)} title="Delete" className="text-[#6B7280] hover:text-[#DC2626] transition-colors">
                        <HiTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </EditorialTd>
                </EditorialTr>
              )
            })
          )}
        </tbody>
      </EditorialTable>

      <EditorialModal
        open={!!selectedUnit}
        onOpenChange={(open) => !open && setSelectedUnit(null)}
        kicker="Units"
        title={isModalEditing ? `Edit ${selectedUnit?.name || 'unit'}` : 'New unit'}
        size="xl"
      >
        {selectedUnit && (
          <UnitForm
            unit={selectedUnit}
            onSubmit={isModalEditing ? handleUpdateUnit : handleCreateUnit}
            onCancel={() => setSelectedUnit(null)}
            loading={createUnitMutation.isPending || updateUnitMutation.isPending}
            units={units}
          />
        )}
      </EditorialModal>

      <EditorialModal
        open={!!unitToDelete}
        onOpenChange={(open) => !open && setUnitToDelete(null)}
        kicker="Delete unit"
        kickerTone="danger"
        title={unitToDelete ? `Remove ${unitToDelete.name}?` : 'Remove unit?'}
        description="This action cannot be undone."
      >
        <EditorialMeta className="italic">
          Removing this unit may affect linked products that reference it.
        </EditorialMeta>
        <EditorialModalFooter>
          <EditorialButton variant="ghost" onClick={() => setUnitToDelete(null)} disabled={deleteUnitMutation.isPending}>
            Cancel
          </EditorialButton>
          <EditorialButton variant="primary" arrow onClick={confirmDelete} disabled={deleteUnitMutation.isPending}>
            {deleteUnitMutation.isPending ? 'Deleting…' : 'Delete'}
          </EditorialButton>
        </EditorialModalFooter>
      </EditorialModal>
    </EditorialPage>
  )
}
