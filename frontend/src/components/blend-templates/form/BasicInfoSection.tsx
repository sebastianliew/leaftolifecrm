"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FaInfoCircle } from 'react-icons/fa';
import type { UnitOfMeasurement } from '@/types/inventory';
import { extractUnitId } from '@/utils/unit-helpers';

interface FormData {
  name: string;
  description: string;
  category: string;
  unitOfMeasurementId: string;
  createdBy: string;
  sellingPrice: number;
}

interface BasicInfoSectionProps {
  formData: FormData;
  onChange: (data: Partial<FormData>) => void;
  errors: Record<string, string>;
  units: UnitOfMeasurement[];
}

export function BasicInfoSection({ formData, onChange, errors, units }: BasicInfoSectionProps) {
  const activeUnits = units.filter(unit => unit.isActive);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <FaInfoCircle className="h-4 w-4 text-blue-600" />
          <CardTitle className="text-lg">Basic Information</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="name" className="text-sm font-medium">Template Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g., Pain Relief Blend"
              className={`mt-1 ${errors.name ? 'border-red-500' : ''}`}
            />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <Label htmlFor="unitOfMeasurementId" className="text-sm font-medium">Base Unit *</Label>
            <Select
              value={formData.unitOfMeasurementId}
              onValueChange={(value) => onChange({ unitOfMeasurementId: value })}
            >
              <SelectTrigger className={`mt-1 ${errors.unitOfMeasurementId ? 'border-red-500' : ''}`}>
                <SelectValue placeholder="Select unit for final blend" />
              </SelectTrigger>
              <SelectContent>
                {activeUnits
                  .filter(uom => extractUnitId(uom))
                  .map(uom => {
                    const unitId = extractUnitId(uom);
                    return (
                      <SelectItem key={unitId} value={unitId}>
                        {uom.name} ({uom.abbreviation})
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
            {errors.unitOfMeasurementId && <p className="text-sm text-red-500 mt-1">{errors.unitOfMeasurementId}</p>}
            <p className="text-xs text-gray-500 mt-1">
              Unit for creating orders from this template
            </p>
          </div>
        </div>

        <div>
          <Label htmlFor="description" className="text-sm font-medium">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Describe the blend's purpose and effects"
            rows={2}
            className="mt-1"
          />
        </div>
      </CardContent>
    </Card>
  );
}