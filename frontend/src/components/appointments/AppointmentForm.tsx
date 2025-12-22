"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { appointmentSchema, type AppointmentFormData } from '@/utils/validation/appointmentSchema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { DateInput } from '@/components/ui/date-input';
import { TimeSlot } from '@/types/appointments';

interface AppointmentFormProps {
  services: { id: string; name: string; duration: number }[];
  onSubmit: (data: AppointmentFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function AppointmentForm({
  services,
  onSubmit,
  onCancel,
  loading = false,
}: AppointmentFormProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
  });

  const handleDateChange = async (date: Date | undefined) => {
    if (!date) {
      setTimeSlots([]);
      setSelectedDate(null);
      return;
    }

    try {
      setValue('date', date);
      const dateString = date.toISOString().split('T')[0];
      const response = await fetch(`/api/appointments?date=${dateString}`);
      if (!response.ok) throw new Error('Failed to fetch time slots');
      const slots = await response.json();
      setTimeSlots(slots);
      setSelectedDate(date);
    } catch {
      setError('Failed to fetch available time slots');
    }
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      setValue('service', service.name);
    }
  };

  const handleTimeSlotSelect = (slot: TimeSlot) => {
    setValue('startTime', slot.startTime);
    setValue('endTime', slot.endTime);
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            {error}
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="date">Date</Label>
            <DateInput
              id="date"
              value={selectedDate || undefined}
              onChange={handleDateChange}
              placeholder="DD/MM/YYYY"
            />
            {errors.date && (
              <p className="text-sm text-red-500">{errors.date.message}</p>
            )}
          </div>

          {selectedDate && timeSlots.length > 0 && (
            <div>
              <Label>Available Time Slots</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {timeSlots.map((slot) => (
                  <Button
                    key={slot.startTime}
                    type="button"
                    variant={watch('startTime') === slot.startTime ? 'default' : 'outline'}
                    onClick={() => handleTimeSlotSelect(slot)}
                    disabled={!slot.isAvailable}
                  >
                    {slot.startTime}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="service">Service</Label>
            <Select onValueChange={handleServiceChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} ({service.duration} minutes)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.service && (
              <p className="text-sm text-red-500">{errors.service.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                {...register('patientInfo.firstName')}
              />
              {errors.patientInfo?.firstName && (
                <p className="text-sm text-red-500">{errors.patientInfo.firstName.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                {...register('patientInfo.lastName')}
              />
              {errors.patientInfo?.lastName && (
                <p className="text-sm text-red-500">{errors.patientInfo.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('patientInfo.email')}
            />
            {errors.patientInfo?.email && (
              <p className="text-sm text-red-500">{errors.patientInfo.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              {...register('patientInfo.phone')}
            />
            {errors.patientInfo?.phone && (
              <p className="text-sm text-red-500">{errors.patientInfo.phone.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              {...register('notes')}
            />
            {errors.notes && (
              <p className="text-sm text-red-500">{errors.notes.message}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
          >
            {loading ? 'Booking...' : 'Book Appointment'}
          </Button>
        </div>
      </form>
    </Card>
  );
} 