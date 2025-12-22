import type { TemplateFilters } from '@/types/blend';
import type { TemplateStats } from '@/hooks/useTemplateStats';

export const DIALOG_TITLES = {
  create: 'Create New Blend Template',
  edit: 'Edit Blend Template',
  view: 'View Blend Template'
} as const;

export const DEFAULT_FILTERS: TemplateFilters = {
  search: '',
  category: undefined,
  isActive: undefined
};

export const BATCH_SIZE_DEFAULT = 1;
export const DEFAULT_INGREDIENT_QUANTITY = 0;
export const MIN_CONTAINER_QUANTITY = 4;

export const VIEW_MODES = {
  LIST: 'list',
  CREATE: 'create',
  EDIT: 'edit',
  VIEW: 'view'
} as const;

export type ViewMode = typeof VIEW_MODES[keyof typeof VIEW_MODES];

export const STATS_CONFIG = [
  { 
    key: 'totalTemplates', 
    label: 'Total Templates', 
    getSublabel: (stats: TemplateStats) => `${stats.activeTemplates} active` 
  },
  { 
    key: 'categoriesCount', 
    label: 'Categories', 
    getSublabel: () => 'Different blend types' 
  },
  { 
    key: 'totalUsage', 
    label: 'Total Usage', 
    getSublabel: () => 'Times templates used' 
  },
  { 
    key: 'averageUsage', 
    label: 'Avg Usage', 
    getSublabel: () => 'Per template' 
  }
] as const;