export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled'
}

export interface BaseAppointment {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface PublicAppointment extends BaseAppointment {
  patientInfo: PatientInfo;
  service: string;
  notes?: string;
}

export interface AppointmentHistory {
  id: string;
  appointmentId: string;
  status: AppointmentStatus;
  changedAt: Date;
  changedBy: string;
  notes?: string;
}

export interface DashboardAppointment extends BaseAppointment {
  patientId: string;
  service: string;
  notes?: string;
  history: AppointmentHistory[];
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface AppointmentQuery {
  preferredDate?: {
    $gte: Date;
    $lte: Date;
  };
  status?: AppointmentStatus;
}