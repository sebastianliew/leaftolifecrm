import { z } from "zod";
import { AppointmentStatus } from "@/types/appointments";

export const patientInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required")
    .regex(/^[0-9+\-\s()]*$/, "Invalid phone number format")
});

export const appointmentSchema = z.object({
  date: z.date({
    message: "Date is required"
  }),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  service: z.string().min(1, "Service is required"),
  patientInfo: patientInfoSchema,
  notes: z.string().optional()
});

export type AppointmentFormData = z.infer<typeof appointmentSchema>;

export const appointmentUpdateSchema = z.object({
  date: z.date().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  service: z.string().optional(),
  notes: z.string().optional(),
  status: z.nativeEnum(AppointmentStatus).optional()
});

export const timeSlotSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  isAvailable: z.boolean()
});

export const serviceSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  duration: z.number().min(1, "Duration must be at least 1 minute"),
  price: z.number().min(0, "Price must be a positive number"),
  description: z.string().optional()
}); 