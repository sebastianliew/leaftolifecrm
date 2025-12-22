import { useMemo } from 'react';
import type { BlendTemplate } from '@/types/blend';

export interface TemplateStats {
  totalTemplates: number;
  activeTemplates: number;
  totalUsage: number;
  categoriesCount: number;
  averageUsage: string;
}

export function useTemplateStats(templates: BlendTemplate[]): TemplateStats {
  return useMemo(() => {
    const totalTemplates = templates.length;
    const activeTemplates = templates.filter(t => t.isActive).length;
    const totalUsage = templates.reduce((sum, t) => sum + t.usageCount, 0);
    const categoriesCount = new Set(templates.map(t => t.category).filter(Boolean)).size;
    const averageUsage = totalTemplates > 0 
      ? (totalUsage / totalTemplates).toFixed(1)
      : '0';

    return {
      totalTemplates,
      activeTemplates,
      totalUsage,
      categoriesCount,
      averageUsage
    };
  }, [templates]);
}