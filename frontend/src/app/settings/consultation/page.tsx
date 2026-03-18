"use client"

import { useEffect } from "react"
import { useConsultationSettings } from "@/hooks/useConsultationSettings"
import { ConsultationHeader, ConsultationPrices } from "@/components/settings/consultation"

export default function ConsultationSettingsPage() {
  const {
    settings: _settings,
    getSettings
  } = useConsultationSettings()

  useEffect(() => {
    getSettings()
  }, [getSettings])


  return (
    <div className="min-h-screen bg-gray-50">
      <ConsultationHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ConsultationPrices />
      </main>
    </div>
  )
}