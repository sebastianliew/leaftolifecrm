/**
 * ReferenceValidator — Eliminates duplicate existence checks across controllers.
 *
 * Usage:
 *   import { validateRef, validateRefs } from '../lib/validations/referenceValidator.js';
 *
 *   // Single check (throws NotFoundError on failure)
 *   await validateRef('Category', categoryId);
 *
 *   // Multiple checks in parallel
 *   await validateRefs([
 *     { model: 'Category', id: categoryId },
 *     { model: 'Brand', id: brandId, optional: true },
 *     { model: 'UnitOfMeasurement', id: unitId }
 *   ]);
 */

import mongoose from 'mongoose';
import { ValidationError } from '../../middlewares/errorHandler.middleware.js';

interface RefCheck {
  model: string;
  id: string | undefined | null;
  optional?: boolean;  // If true, skip when id is falsy
  label?: string;      // Human-readable name for error messages
}

/**
 * Validate a single reference exists.
 * Throws ValidationError if not found.
 */
export async function validateRef(
  modelName: string,
  id: string | undefined | null,
  label?: string
): Promise<void> {
  if (!id) {
    throw new ValidationError(`${label || modelName} ID is required`);
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError(`Invalid ${label || modelName} ID: ${id}`);
  }

  const model = mongoose.model(modelName);
  const exists = await model.exists({ _id: id });
  if (!exists) {
    throw new ValidationError(`${label || modelName} not found`);
  }
}

/**
 * Validate multiple references in parallel.
 * Optional refs are skipped when their id is falsy.
 */
export async function validateRefs(refs: RefCheck[]): Promise<void> {
  const checks = refs
    .filter(r => !r.optional || (r.id !== undefined && r.id !== null && r.id !== ''))
    .map(r => validateRef(r.model, r.id, r.label));

  await Promise.all(checks);
}

/**
 * Check for duplicate by field value (case-insensitive).
 * Throws ConflictError if found.
 */
export async function validateUnique(
  modelName: string,
  field: string,
  value: string,
  excludeId?: string,
  label?: string
): Promise<void> {
  if (!value) throw new ValidationError(`${label || modelName} ${field} is required`);
  const model = mongoose.model(modelName);
  const query: Record<string, unknown> = {
    [field]: { $regex: `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existing = await model.findOne(query);
  if (existing) {
    throw new ValidationError(`${label || modelName} with this ${field} already exists`);
  }
}
