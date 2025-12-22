import mongoose, { Schema, Document } from 'mongoose';

export interface IUserAuditLog extends Document {
  userId: string;
  userEmail: string;
  action: string;
  targetUserId?: string;
  targetUserEmail?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const UserAuditLogSchema = new Schema<IUserAuditLog>({
  userId: { type: String, required: true },
  userEmail: { type: String, required: true },
  action: { type: String, required: true },
  targetUserId: { type: String },
  targetUserEmail: { type: String },
  oldData: { type: Schema.Types.Mixed },
  newData: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now }
});

export const UserAuditLog = mongoose.models.UserAuditLog || mongoose.model<IUserAuditLog>('UserAuditLog', UserAuditLogSchema);