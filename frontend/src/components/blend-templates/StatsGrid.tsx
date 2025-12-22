"use client"

import { StatsCard } from '@/components/ui/stats-card';
import { STATS_CONFIG } from '@/constants/blend-templates';
import type { TemplateStats } from '@/hooks/useTemplateStats';

interface StatsGridProps {
  stats: TemplateStats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {STATS_CONFIG.map(config => (
        <StatsCard
          key={config.key}
          value={stats[config.key as keyof TemplateStats]}
          label={config.label}
          sublabel={config.getSublabel(stats)}
        />
      ))}
    </div>
  );
}