"use client"

import React, { useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FiPlus, FiTrash2 } from 'react-icons/fi'

interface RemedyRow {
  id: string
  name: string
}

interface RowData {
  [key: string]: string
}

interface RemedyScheduleTableProps {
  remedyRows: RemedyRow[]
  rowData: RowData
  editMode: boolean
  readOnly: boolean
  onAddRow: () => void
  onDeleteRow: (rowId: string) => void
  onCellChange: (rowId: string, cellKey: string, value: string) => void
}

export function RemedyScheduleTable({
  remedyRows,
  rowData,
  editMode,
  readOnly,
  onAddRow,
  onDeleteRow,
  onCellChange
}: RemedyScheduleTableProps) {
  const contentEditableRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Meal colors for visual organization
  const mealColors = {
    breakfast: 'bg-yellow-50',
    lunch: 'bg-green-50',
    dinner: 'bg-blue-50'
  }

  const handleCellEdit = (rowId: string, cellKey: string, content: string) => {
    onCellChange(rowId, cellKey, content)
  }

  const adjustHeight = (element: HTMLDivElement) => {
    element.style.height = 'auto'
    element.style.height = element.scrollHeight + 'px'
  }

  const handleInput = (e: React.FormEvent<HTMLDivElement>, rowId: string, cellKey: string) => {
    const content = e.currentTarget.textContent || ''
    handleCellEdit(rowId, cellKey, content)
    adjustHeight(e.currentTarget)
  }

  const getCellKey = (rowId: string, meal: string, timing: string) => {
    return `${rowId}-${meal}-${timing}`
  }

  useEffect(() => {
    // Adjust heights for all cells on mount and when data changes
    Object.values(contentEditableRefs.current).forEach(ref => {
      if (ref) {
        adjustHeight(ref)
      }
    })
  }, [rowData])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Daily Remedy Schedule</CardTitle>
          {editMode && !readOnly && (
            <Button
              size="sm"
              onClick={onAddRow}
              variant="outline"
            >
              <FiPlus className="h-4 w-4 mr-2" />
              Add Remedy
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40 font-bold">Remedy</TableHead>
                <TableHead colSpan={3} className={`text-center font-bold ${mealColors.breakfast}`}>
                  Breakfast
                </TableHead>
                <TableHead colSpan={3} className={`text-center font-bold ${mealColors.lunch}`}>
                  Lunch
                </TableHead>
                <TableHead colSpan={3} className={`text-center font-bold ${mealColors.dinner}`}>
                  Dinner
                </TableHead>
                {editMode && !readOnly && <TableHead className="w-20"></TableHead>}
              </TableRow>
              <TableRow>
                <TableHead></TableHead>
                {['breakfast', 'lunch', 'dinner'].map(meal => (
                  <React.Fragment key={meal}>
                    <TableHead className={`text-center text-xs ${mealColors[meal as keyof typeof mealColors]}`}>
                      Before
                    </TableHead>
                    <TableHead className={`text-center text-xs ${mealColors[meal as keyof typeof mealColors]}`}>
                      During
                    </TableHead>
                    <TableHead className={`text-center text-xs ${mealColors[meal as keyof typeof mealColors]}`}>
                      After
                    </TableHead>
                  </React.Fragment>
                ))}
                {editMode && !readOnly && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {remedyRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <div
                      ref={el => { contentEditableRefs.current[`${row.id}-name`] = el }}
                      contentEditable={editMode && !readOnly}
                      suppressContentEditableWarning
                      onInput={(e) => handleInput(e, row.id, 'name')}
                      className={`min-h-[40px] p-2 rounded ${
                        editMode && !readOnly ? 'bg-gray-50 hover:bg-gray-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500' : ''
                      }`}
                      style={{ resize: 'none', overflow: 'hidden' }}
                      dangerouslySetInnerHTML={{ 
                        __html: rowData[`${row.id}-name`] || row.name || '' 
                      }}
                    />
                  </TableCell>
                  {['breakfast', 'lunch', 'dinner'].map(meal => (
                    ['before', 'during', 'after'].map(timing => {
                      const cellKey = getCellKey(row.id, meal, timing)
                      return (
                        <TableCell 
                          key={cellKey} 
                          className={`p-1 ${mealColors[meal as keyof typeof mealColors]}`}
                        >
                          <div
                            ref={el => { contentEditableRefs.current[cellKey] = el }}
                            contentEditable={editMode && !readOnly}
                            suppressContentEditableWarning
                            onInput={(e) => handleInput(e, row.id, cellKey)}
                            className={`min-h-[40px] p-2 rounded ${
                              editMode && !readOnly ? 'hover:bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500' : ''
                            }`}
                            style={{ resize: 'none', overflow: 'hidden' }}
                            dangerouslySetInnerHTML={{ 
                              __html: rowData[cellKey] || '' 
                            }}
                          />
                        </TableCell>
                      )
                    })
                  ))}
                  {editMode && !readOnly && (
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteRow(row.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {remedyRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={editMode && !readOnly ? 11 : 10} className="text-center py-8 text-gray-500">
                    No remedies added yet. {editMode && !readOnly && 'Click "Add Remedy" to start.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}