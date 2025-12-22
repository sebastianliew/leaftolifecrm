"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FaSearch } from 'react-icons/fa';
import type { TemplateFilters } from '@/types/blend';

interface FilterPanelProps {
  filters: TemplateFilters;
  onFilterChange: (key: keyof TemplateFilters, value: string | boolean | undefined) => void;
  onApply: () => void;
  onReset: () => void;
  onSearch?: (searchTerm: string) => void;
}

export function FilterPanel({ filters, onFilterChange, onApply, onReset, onSearch }: FilterPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search templates..."
                value={filters.search || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  onFilterChange('search', value);
                  if (onSearch) {
                    onSearch(value);
                  }
                }}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={filters.isActive === undefined ? 'all' : filters.isActive.toString()}
              onValueChange={(value) => onFilterChange('isActive', value === 'all' ? undefined : value === 'true')}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button onClick={onApply} className="flex-1">
              Apply Filters
            </Button>
            <Button 
              variant="outline" 
              onClick={onReset}
            >
              Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}