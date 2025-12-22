"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableCell } from "@/components/ui/table"
import { PresetFormData } from "./types"

interface PresetFormProps {
  formData: PresetFormData;
  onFormChange: (data: PresetFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  isLoading: boolean;
  isEditing?: boolean;
}

export function PresetForm({
  formData,
  onFormChange,
  onSave,
  onCancel,
  isLoading,
  isEditing: _isEditing = false
}: PresetFormProps) {
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFormChange({ ...formData, name: e.target.value });
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFormChange({ ...formData, price: parseFloat(e.target.value) || 0 });
  };

  return (
    <>
      <TableCell>
        <Input
          placeholder="Preset name"
          value={formData.name}
          onChange={handleNameChange}
          disabled={isLoading}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="text-sm">$</span>
          <Input
            type="number"
            placeholder="0.00"
            value={formData.price}
            onChange={handlePriceChange}
            className="w-32"
            min="0"
            step="0.01"
            disabled={isLoading}
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={onSave}
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      </TableCell>
    </>
  );
}