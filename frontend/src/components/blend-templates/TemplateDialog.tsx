"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TemplateForm } from './TemplateForm';
import { TemplateDetailView } from './TemplateDetailView';
import { DIALOG_TITLES, ViewMode } from '@/constants/blend-templates';
import type { BlendTemplate, CreateBlendTemplateData, UpdateBlendTemplateData } from '@/types/blend';
import type { Product, UnitOfMeasurement } from '@/types/inventory';

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ViewMode;
  template?: BlendTemplate | null;
  products: Product[];
  units: UnitOfMeasurement[];
  onSubmit: (data: CreateBlendTemplateData | UpdateBlendTemplateData) => Promise<void>;
  onEdit?: (template: BlendTemplate) => void;
  loading?: boolean;
}

export function TemplateDialog({
  open,
  onOpenChange,
  view,
  template,
  products,
  units,
  onSubmit,
  onEdit,
  loading
}: TemplateDialogProps) {
  const title = view === 'create' ? DIALOG_TITLES.create : 
                view === 'edit' ? DIALOG_TITLES.edit : 
                DIALOG_TITLES.view;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {open && (
          <>
            {view === 'view' && template ? (
              <TemplateDetailView
                template={template}
                onClose={() => onOpenChange(false)}
                onEdit={onEdit}
              />
            ) : (
              <TemplateForm
                template={view === 'edit' ? (template ?? undefined) : undefined}
                products={products}
                unitOfMeasurements={units}
                onSubmit={onSubmit}
                onCancel={() => onOpenChange(false)}
                loading={loading}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}