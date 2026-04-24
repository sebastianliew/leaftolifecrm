import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Supplier } from '../models/Supplier.js';
import { Product } from '../models/Product.js';
import { IUser } from '../models/User.js';
import { QueryBuilder } from '../lib/QueryBuilder.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middlewares/errorHandler.middleware.js';
import { validateUnique } from '../lib/validations/referenceValidator.js';

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

// ── Field whitelists: prevent mass-assignment of server-managed columns ──

const CLIENT_WRITABLE_FIELDS = [
  'name', 'code', 'description',
  'email', 'phone', 'fax', 'website', 'contactPerson',
  'address', 'city', 'state', 'postalCode', 'country',
  'businessType', 'taxId', 'businessRegistrationNumber',
  'paymentTerms', 'creditLimit', 'minimumOrderValue', 'currency',
  'categories', 'qualityStandards',
  'status', 'isActive',
  'isPreferred', 'requiresApproval',
  'notes', 'internalNotes', 'tags',
] as const;

const STRING_FIELDS_TO_SANITIZE = [
  'name', 'description', 'contactPerson',
  'address', 'city', 'state', 'postalCode', 'country',
  'notes', 'internalNotes',
  'taxId', 'businessRegistrationNumber',
];

function pickAllowed(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of CLIENT_WRITABLE_FIELDS) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}

/** Strip HTML tags and trim on user-visible string fields + tags array. */
function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  for (const key of STRING_FIELDS_TO_SANITIZE) {
    const v = data[key];
    if (typeof v === 'string') {
      data[key] = v.replace(/<[^>]*>/g, '').trim();
    } else if (v === null) {
      data[key] = '';
    }
  }
  if (Array.isArray(data.tags)) {
    data.tags = (data.tags as unknown[])
      .filter((t): t is string => typeof t === 'string')
      .map(t => t.replace(/<[^>]*>/g, '').trim())
      .filter(Boolean);
  }
  return data;
}

/** `status` is the source of truth; keep `isActive` in lockstep. */
function applyStatusCoherence(data: Record<string, unknown>): void {
  if (data.status !== undefined) {
    data.isActive = data.status === 'active';
  } else if (data.isActive !== undefined) {
    data.status = data.isActive ? 'active' : 'inactive';
  }
}

function serialize(doc: { toObject: () => Record<string, unknown>; _id: unknown }): Record<string, unknown> {
  const { _id, __v, ...rest } = doc.toObject();
  void __v;
  return { ...rest, id: String(_id) };
}

// ── Controllers ──

export const getSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const params = req.query as Record<string, string>;
  const qb = new QueryBuilder(params, { limit: 10 })
    .search(['name', 'code', 'description', 'contactPerson', 'email'])
    .filter('status')
    .filter('businessType');

  if (params.isActive !== undefined) {
    qb.where({ isActive: params.isActive === 'true' } as Record<string, unknown>);
  }

  const { query, sort, skip, limit, pagination } = qb.build();

  const [suppliers, total] = await Promise.all([
    Supplier.find(query).sort(sort).skip(skip).limit(limit),
    Supplier.countDocuments(query)
  ]);

  res.json({
    suppliers: suppliers.map(serialize),
    pagination: QueryBuilder.paginationResponse(total, pagination.page, pagination.limit)
  });
});

export const getSupplierById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ValidationError('Invalid ID format');
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new NotFoundError('Supplier', req.params.id);
  res.json(serialize(supplier));
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const data = sanitize(pickAllowed(req.body ?? {}));
  applyStatusCoherence(data);

  if (!data.name || typeof data.name !== 'string') {
    throw new ValidationError('Supplier name is required');
  }

  await validateUnique('Supplier', 'name', data.name as string, undefined, 'Supplier');
  if (data.code) {
    await validateUnique('Supplier', 'code', data.code as string, undefined, 'Supplier');
  }

  const authReq = req as AuthenticatedRequest;
  const supplier = new Supplier({
    ...data,
    createdBy: authReq.user?._id || 'system',
    lastModifiedBy: authReq.user?._id || 'system'
  });
  await supplier.save();

  res.status(201).json(serialize(supplier));
});

export const updateSupplier = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ValidationError('Invalid ID format');

  // Existence first — surfaces 404 before any conflict check.
  const exists = await Supplier.exists({ _id: req.params.id });
  if (!exists) throw new NotFoundError('Supplier', req.params.id);

  const updates = sanitize(pickAllowed(req.body ?? {}));

  // Handle explicit clearing of `code` (null or empty string) via $unset.
  const clearCode = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'code')
    && (req.body.code === null || req.body.code === '');
  if (clearCode) delete updates.code;

  if (typeof updates.name === 'string') {
    if (!updates.name) throw new ValidationError('Supplier name cannot be empty');
    await validateUnique('Supplier', 'name', updates.name, req.params.id, 'Supplier');
  }
  if (typeof updates.code === 'string' && updates.code) {
    await validateUnique('Supplier', 'code', updates.code, req.params.id, 'Supplier');
  }

  applyStatusCoherence(updates);

  const authReq = req as AuthenticatedRequest;
  updates.lastModifiedBy = authReq.user?._id || 'system';

  const mutation: Record<string, unknown> = { ...updates };
  if (clearCode) mutation.$unset = { code: 1 };

  const supplier = await Supplier.findByIdAndUpdate(req.params.id, mutation, { new: true, runValidators: true });
  if (!supplier) throw new NotFoundError('Supplier', req.params.id);

  if (authReq.user) console.log(`Supplier updated by ${authReq.user.email}: ${supplier.name}`);
  res.json(serialize(supplier));
});

export const deleteSupplier = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ValidationError('Invalid ID format');

  // Field is `supplierId` on Product (ObjectId ref). Only count non-soft-deleted.
  const productCount = await Product.countDocuments({
    supplierId: req.params.id,
    isDeleted: { $ne: true },
  });
  if (productCount > 0) {
    throw new ValidationError(`Cannot delete supplier. ${productCount} product${productCount === 1 ? '' : 's'} reference this supplier.`);
  }

  const supplier = await Supplier.findByIdAndDelete(req.params.id);
  if (!supplier) throw new NotFoundError('Supplier', req.params.id);

  const authReq = req as AuthenticatedRequest;
  if (authReq.user) console.log(`Supplier deleted by ${authReq.user.email}: ${supplier.name}`);
  res.json({ message: 'Supplier deleted successfully' });
});
