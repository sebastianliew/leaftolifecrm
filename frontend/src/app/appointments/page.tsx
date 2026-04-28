"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { AppointmentForm } from "@/components/appointments/AppointmentForm"
import { AppointmentFormData } from '@/utils/validation/appointmentSchema'
import { api } from '@/lib/api-client'
import { BRANDING } from '@/config/branding'
import { EditorialPage, EditorialKicker, EditorialButton } from "@/components/ui/editorial"

const services = [
  { id: "consultation", name: "Initial Consultation", duration: 60 },
  { id: "follow-up", name: "Follow-up Visit", duration: 30 },
  { id: "emergency", name: "Emergency Visit", duration: 45 },
]

export default function AppointmentPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (data: AppointmentFormData) => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.post('/appointments', data)
      if (!response.ok) throw new Error(response.error || 'Failed to create appointment')
      setSuccess(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create appointment')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => window.history.back()

  return (
    <EditorialPage>
      <div className="max-w-3xl mx-auto">
        <header className="text-center pb-12 border-b border-[#E5E7EB]">
          <Link href="/" className="inline-block mb-8">
            <Image
              src={BRANDING.logoPath}
              alt="Clinic Logo"
              width={160}
              height={160}
              priority
              className="mx-auto"
            />
          </Link>
          <EditorialKicker>Appointments</EditorialKicker>
          <h1 className="font-light text-[48px] leading-[1] mt-3 text-[#0A0A0A]">Book your visit</h1>
          <p className="text-sm text-[#6B7280] mt-4 italic font-light max-w-xl mx-auto">
            Schedule with our healthcare professionals. Choose your preferred date and time, and
            we&apos;ll confirm shortly.
          </p>
        </header>

        {success ? (
          <div className="mt-12 text-center max-w-lg mx-auto">
            <EditorialKicker tone="ok">Confirmed</EditorialKicker>
            <h2 className="font-light text-[36px] leading-[1.05] mt-3 text-[#0A0A0A]">
              Appointment booked.
            </h2>
            <p className="text-sm text-[#6B7280] mt-4 italic font-light">
              We&apos;ve sent a confirmation email with your appointment details.
            </p>
            <div className="mt-8">
              <Link href="/">
                <EditorialButton variant="primary" arrow>
                  Return home
                </EditorialButton>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-12">
            {error && (
              <div className="mb-8 border-l-2 border-[#DC2626] bg-[#FEF2F2] px-5 py-4">
                <p className="text-[10px] uppercase tracking-[0.4em] text-[#DC2626]">Error</p>
                <p className="text-[13px] text-[#0A0A0A] mt-2">{error}</p>
              </div>
            )}
            <AppointmentForm
              services={services}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              loading={loading}
            />
          </div>
        )}
      </div>
    </EditorialPage>
  )
}
