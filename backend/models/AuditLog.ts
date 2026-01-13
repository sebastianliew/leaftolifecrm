import mongoose, { Schema, Document, Types } from 'mongoose';

export type AuditEntityType = 'transaction' | 'invoice' | 'refund' | 'product' | 'patient';
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'generate_invoice'
  | 'send_email'
  | 'refund'
  | 'partial_refund'
  | 'cancel';
export type AuditStatus = 'success' | 'failed' | 'pending';

// Input interface for creating audit logs (plain object, not Document)
export interface AuditLogInput {
  entityType: AuditEntityType;
  entityId: Types.ObjectId | string | unknown;
  action: AuditAction;
  status: AuditStatus;
  error?: string;
  userId?: Types.ObjectId | string;
  userEmail?: string;
  metadata?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
}

// Document interface for Mongoose
export interface IAuditLog extends Document {
  entityType: AuditEntityType;
  entityId: Types.ObjectId | string;
  action: AuditAction;
  status: AuditStatus;
  error?: string;
  userId?: Types.ObjectId | string;
  userEmail?: string;
  metadata?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  entityType: {
    type: String,
    required: true,
    enum: ['transaction', 'invoice', 'refund', 'product', 'patient'],
    index: true
  },
  entityId: {
    type: Schema.Types.Mixed,
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: ['create', 'update', 'delete', 'generate_invoice', 'send_email', 'refund', 'partial_refund', 'cancel'],
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['success', 'failed', 'pending'],
    index: true
  },
  error: { type: String },
  userId: { type: Schema.Types.Mixed },
  userEmail: { type: String },
  metadata: { type: Schema.Types.Mixed },
  previousState: { type: Schema.Types.Mixed },
  newState: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  duration: { type: Number },
  createdAt: { type: Date, default: Date.now, index: true }
});

// Compound indexes for common queries
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ status: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });

/**
 * Create an audit log entry.
 * This is a fire-and-forget operation - errors are logged but don't throw.
 */
export async function createAuditLog(data: AuditLogInput): Promise<IAuditLog | null> {
  try {
    const auditLog = new AuditLog(data);
    return await auditLog.save();
  } catch (error) {
    console.error('[AuditLog] Failed to create audit log:', error);
    return null;
  }
}

/**
 * Get audit logs for a specific entity.
 */
export async function getEntityAuditLogs(
  entityType: AuditEntityType,
  entityId: string,
  options: { limit?: number; skip?: number } = {}
): Promise<IAuditLog[]> {
  const { limit = 50, skip = 0 } = options;
  return AuditLog.find({ entityType, entityId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .exec();
}

/**
 * Get failed operations for review.
 */
export async function getFailedOperations(
  options: { limit?: number; since?: Date } = {}
): Promise<IAuditLog[]> {
  const { limit = 100, since = new Date(Date.now() - 24 * 60 * 60 * 1000) } = options;
  return AuditLog.find({
    status: 'failed',
    createdAt: { $gte: since }
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
}

export const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
