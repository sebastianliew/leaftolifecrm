import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BlendTemplate } from '@/types/blend';
import { fetchAPI } from '@/lib/query-client';

export interface TemplateStats {
  totalTemplates: number;
  activeTemplates: number;
  totalUsage: number;
  categoriesCount: number;
  averageUsage: string;
}

/**
 * Fetches template stats from the backend.
 * Falls back to local computation from the provided templates array
 * if the API call fails or is still loading.
 */
export function useTemplateStats(templates: BlendTemplate[]): TemplateStats {
  const { data: serverStats } = useQuery<TemplateStats>({
    queryKey: ['blendTemplates', 'stats'],
    queryFn: () => fetchAPI<TemplateStats>('/blend-templates/stats'),
    staleTime: 30_000,
  });

  // Fallback to local computation
  const localStats = useMemo(() => {
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

  return serverStats ?? localStats;
}
