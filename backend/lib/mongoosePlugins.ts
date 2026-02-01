import { Schema } from 'mongoose';

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
