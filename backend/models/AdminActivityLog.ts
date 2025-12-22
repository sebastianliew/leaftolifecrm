import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminActivityLog extends Document {
  adminId: string;
  adminEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  metadata?: Record<string, string | number | boolean | Date>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const AdminActivityLogSchema = new Schema<IAdminActivityLog>({
  adminId: { type: String, required: true },
  adminEmail: { type: String, required: true },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: { type: String },
  oldData: { type: Schema.Types.Mixed },
  newData: { type: Schema.Types.Mixed },
  metadata: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now }
});

export const AdminActivityLog = mongoose.models.AdminActivityLog || mongoose.model<IAdminActivityLog>('AdminActivityLog', AdminActivityLogSchema);