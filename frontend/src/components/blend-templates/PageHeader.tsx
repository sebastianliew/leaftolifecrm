"use client"

import { Button } from "@/components/ui/button";
import { FaPlus } from 'react-icons/fa';

interface PageHeaderProps {
  onCreateTemplate?: () => void;
  onToggleFilters: () => void;
  showFilters: boolean;
  canCreate: boolean;
}

export function PageHeader({ 
  onCreateTemplate, 
  onToggleFilters, 
  showFilters,
  canCreate 
}: PageHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold">Blend Templates</h1>
        <p className="text-gray-600 mt-2">
          Create and manage reusable blend formulations for consistent mixing
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={onToggleFilters}
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
        {canCreate && onCreateTemplate && (
          <Button onClick={onCreateTemplate}>
            <FaPlus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        )}
      </div>
    </div>
  );
}