"use client"

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FaTimes, FaSave } from 'react-icons/fa';
import { ImSpinner8 } from 'react-icons/im';

interface FormActionsProps {
  loading?: boolean;
  onCancel: () => void;
  isEdit: boolean;
}

export function FormActions({ loading, onCancel, isEdit }: FormActionsProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {isEdit ? 'All changes will be saved to the existing template' : 'A new blend template will be created'}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onCancel} className="min-w-24">
              <FaTimes className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="min-w-32">
              {loading ? (
                <ImSpinner8 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FaSave className="mr-2 h-4 w-4" />
              )}
              {isEdit ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}