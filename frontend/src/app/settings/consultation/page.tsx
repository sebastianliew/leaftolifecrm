"use client"

import { useEffect } from "react"
import { useConsultationSettings } from "@/hooks/useConsultationSettings"
import { ConsultationHeader, ConsultationPrices } from "@/components/settings/consultation"
import { EditorialPage, EditorialSection } from "@/components/ui/editorial"

export default function ConsultationSettingsPage() {
  const { settings: _settings, getSettings } = useConsultationSettings()

  useEffect(() => {
    getSettings()
  }, [getSettings])

  return (
    <EditorialPage>
      <ConsultationHeader />
      <EditorialSection title="Pricing">
        <ConsultationPrices />
      </EditorialSection>
    </EditorialPage>
  )
}
