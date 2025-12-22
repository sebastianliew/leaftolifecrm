"use client";

import { Card } from "@/components/ui/card";
import { AppointmentForm } from "@/components/appointments/AppointmentForm";
import Image from "next/image";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import Link from "next/link";
import { AppointmentFormData } from '@/utils/validation/appointmentSchema';
import { api } from '@/lib/api-client';

// This would typically come from your database
const services = [
  { id: "consultation", name: "Initial Consultation", duration: 60 },
  { id: "follow-up", name: "Follow-up Visit", duration: 30 },
  { id: "emergency", name: "Emergency Visit", duration: 45 },
];

export default function AppointmentPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: AppointmentFormData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/appointments', data);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to create appointment');
      }
      
      setSuccess(true);
      // Reset form or redirect after successful booking
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Handle cancellation (e.g., redirect to home)
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-6">
              <Image
                src="/logo.jpeg"
                alt="Clinic Logo"
                width={200}
                height={200}
                priority
                className="rounded-lg"
              />
            </Link>
            <h1 className="text-3xl font-bold mb-4">Book Your Appointment</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Schedule your visit with our healthcare professionals. Choose your preferred date and time,
              and we&apos;ll confirm your appointment shortly.
            </p>
          </div>

          {success ? (
            <Card className="p-6 text-center">
              <h2 className="text-2xl font-semibold text-green-600 mb-4">Appointment Booked Successfully!</h2>
              <p className="text-gray-600 mb-6">
                Thank you for booking with us. We&apos;ve sent a confirmation email with your appointment details.
              </p>
              <Link
                href="/"
                className="text-blue-600 hover:text-blue-800"
              >
                Return to Home
              </Link>
            </Card>
          ) : (
            <Card className="p-6">
              {error && (
                <Alert variant="destructive" className="mb-6">
                  {error}
                </Alert>
              )}
              <AppointmentForm
                services={services}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                loading={loading}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
} 