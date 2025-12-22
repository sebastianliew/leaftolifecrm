"use client"

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FaClipboardList } from 'react-icons/fa';
import type { BlendTemplate } from '@/types/blend';

interface TemplateFormHeaderProps {
  template?: BlendTemplate;
}

export function TemplateFormHeader({ template }: TemplateFormHeaderProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FaClipboardList className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-xl">
              {template ? 'Edit Blend Template' : 'Create New Blend Template'}
            </CardTitle>
            <CardDescription className="mt-1">
              {template 
                ? 'Update your blend recipe details and ingredients'
                : 'Create a reusable blend recipe for consistent formulations'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}