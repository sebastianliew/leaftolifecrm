"use client"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { HiPencil, HiTrash } from "react-icons/hi2"
import { DiscountPreset } from "./types"
import { PresetForm } from "./PresetForm"

interface ConsultationPricesTableProps {
  presets: DiscountPreset[];
  loading: boolean;
  editingPreset: string | null;
  showNewPreset: boolean;
  formData: { name: string; price: number };
  isLoading: boolean;
  onFormChange: (data: { name: string; price: number }) => void;
  onCreatePreset: () => void;
  onUpdatePreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onStartEdit: (preset: DiscountPreset) => void;
  onCancelEdit: () => void;
}

export function ConsultationPricesTable({
  presets,
  loading,
  editingPreset,
  showNewPreset,
  formData,
  isLoading,
  onFormChange,
  onCreatePreset,
  onUpdatePreset,
  onDeletePreset,
  onStartEdit,
  onCancelEdit
}: ConsultationPricesTableProps) {
  if (loading && presets.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-gray-500">Loading consultation prices...</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {showNewPreset && (
            <TableRow>
              <PresetForm
                formData={formData}
                onFormChange={onFormChange}
                onSave={onCreatePreset}
                onCancel={onCancelEdit}
                isLoading={isLoading}
              />
            </TableRow>
          )}
          {presets.map((preset) => (
            <TableRow key={preset.id}>
              {editingPreset === preset.id ? (
                <>
                  <PresetForm
                    formData={formData}
                    onFormChange={onFormChange}
                    onSave={() => onUpdatePreset(preset.id)}
                    onCancel={onCancelEdit}
                    isLoading={isLoading}
                    isEditing
                  />
                </>
              ) : (
                <>
                  <TableCell>
                    <div className="font-medium">{preset.name}</div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-green-600">
                      ${(preset.price || 0).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onStartEdit(preset)}
                        title="Edit Preset"
                        disabled={editingPreset !== null || showNewPreset}
                      >
                        <HiPencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDeletePreset(preset.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete Preset"
                        disabled={editingPreset !== null || showNewPreset || isLoading}
                      >
                        <HiTrash className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}