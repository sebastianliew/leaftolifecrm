import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAppointment extends Document {
  wordpressId?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredDate: Date;
  appointmentType: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' | 'trashed';
  source: string;
  formId?: number;
  healthConcerns?: string;
  allergies?: string;
  medications?: string;
  rawFormData?: Record<string, unknown>;
  submittedAt?: Date;
  syncedAt?: Date;
  notes?: string;
  patientId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<IAppointment>({
  wordpressId: { type: Number, sparse: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  preferredDate: { type: Date, required: true },
  appointmentType: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['scheduled', 'completed', 'cancelled', 'rescheduled', 'trashed'],
    default: 'scheduled'
  },
  source: { type: String, required: true },
  formId: { type: Number },
  healthConcerns: { type: String },
  allergies: { type: String },
  medications: { type: String },
  rawFormData: { type: Schema.Types.Mixed },
  submittedAt: { type: Date },
  syncedAt: { type: Date },
  notes: { type: String },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient' }
}, {
  timestamps: true
});

// Indexes for efficient querying
appointmentSchema.index({ preferredDate: 1, status: 1 });
appointmentSchema.index({ email: 1 });
appointmentSchema.index({ wordpressId: 1, source: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ createdAt: -1 });

const Appointment = mongoose.models.Appointment || mongoose.model<IAppointment>('Appointment', appointmentSchema);

export default Appointment;