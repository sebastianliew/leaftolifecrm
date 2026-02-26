import { Schema, Query } from 'mongoose';

/**
 * Soft delete plugin — adds isDeleted/deletedAt/deletedBy/deleteReason fields
 * and auto-excludes deleted documents from queries unless explicitly included.
 *
 * Usage:
 *   schema.plugin(softDeletePlugin);
 *   // Then in code:
 *   await doc.softDelete(userId, reason);
 *   await doc.restore();
 *   // To include deleted: Model.find().setOptions({ includeDeleted: true })
 */
export function softDeletePlugin(schema: Schema): void {
  schema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: String },
    deleteReason: { type: String }
  });

  schema.methods.softDelete = function (userId?: string, reason?: string) {
    this.isDeleted = true;
    this.isActive = false;
    this.status = 'inactive';
    this.deletedAt = new Date();
    if (userId) this.deletedBy = userId;
    if (reason) this.deleteReason = reason;
    return this.save();
  };

  schema.methods.restore = function () {
    this.isDeleted = false;
    this.isActive = true;
    this.status = 'active';
    this.deletedAt = undefined;
    this.deletedBy = undefined;
    this.deleteReason = undefined;
    return this.save();
  };

  // Auto-exclude deleted docs from find queries
  const autoExclude = function (this: Query<unknown, unknown>) {
    const opts = this.getOptions() as { includeDeleted?: boolean };
    if (!opts.includeDeleted) {
      this.where({ isDeleted: { $ne: true } });
    }
  };

  schema.pre('find', autoExclude);
  schema.pre('findOne', autoExclude);
  schema.pre('countDocuments', autoExclude);
}

/**
 * Global serialization plugin for Mongoose schemas.
 * Ensures consistent JSON/Object output across all models:
 * - Includes virtual fields
 * - Removes __v (version key)
 * - Keeps _id as-is (no transformation to id)
 */
export function globalSerializationPlugin(schema: Schema): void {
  schema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      return ret;
    }
  });

  schema.set('toObject', {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.__v;
      return ret;
    }
  });
}
