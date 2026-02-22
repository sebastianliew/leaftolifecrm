import mongoose from 'mongoose';

// Minimal Patient model for Next.js API routes (dashboard stats only).
// The full Patient schema lives in the backend.
const patientSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true, strict: false });

export const Patient = mongoose.models.Patient || mongoose.model('Patient', patientSchema);
