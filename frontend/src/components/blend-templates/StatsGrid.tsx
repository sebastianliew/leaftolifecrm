"use client"

import { EditorialStats, EditorialStat } from '@/components/ui/editorial'
import type { TemplateStats } from '@/hooks/useTemplateStats'

interface StatsGridProps {
  stats: TemplateStats
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <EditorialStats>
      <EditorialStat
        index="i."
        label="Total templates"
        value={stats.totalTemplates}
        caption={<><span className="tabular-nums">{stats.activeTemplates}</span> active</>}
      />
      <EditorialStat
        index="ii."
        label="Categories"
        value={stats.categoriesCount}
        caption="distinct blend types"
      />
      <EditorialStat
        index="iii."
        label="Total usage"
        value={stats.totalUsage}
        caption="times applied"
      />
      <EditorialStat
        index="iv."
        label="Avg usage"
        value={stats.averageUsage}
        caption="per template"
      />
    </EditorialStats>
  )
}
