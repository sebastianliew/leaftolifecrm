"use client"

import { EditorialBreadcrumb, EditorialMasthead } from "@/components/ui/editorial"

interface ConsultationHeaderProps {
  title?: string
  description?: string
}

export function ConsultationHeader({
  title = "Consultation",
  description = "Manage consultation pricing and discount presets.",
}: ConsultationHeaderProps) {
  return (
    <>
      <EditorialBreadcrumb
        segments={[
          { label: "Settings", href: "/settings" },
          { label: title },
        ]}
      />
      <EditorialMasthead
        kicker="Settings · Consultation"
        title={title}
        subtitle={description}
      />
    </>
  )
}
