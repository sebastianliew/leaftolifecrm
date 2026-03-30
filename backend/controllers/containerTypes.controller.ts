import { Request, Response } from 'express';
import { ContainerType, IContainerType } from '../models/ContainerType.js';
import { Product } from '../models/Product.js';
import { IUser } from '../models/User.js';
import { QueryBuilder } from '../lib/QueryBuilder.js';
import { asyncHandler, NotFoundError, ValidationError, ConflictError } from '../middlewares/errorHandler.middleware.js';

interface AuthenticatedRequest extends Request { user?: IUser; }

// ── Helpers ──

function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Invalid input: expected a string');
  return value.replace(/<[^>]*>/g, '').trim();
}

async function findOrFail(id: string) {
  const ct = await ContainerType.findById(id).lean<IContainerType>();
  if (!ct) throw new NotFoundError('Container type', id);
  return ct;
}

async function checkDuplicateName(name: string, excludeId?: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query: Record<string, unknown> = { name: { $regex: `^${escaped}$`, $options: 'i' } };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await ContainerType.findOne(query);
  if (existing) throw new ConflictError('Container type with this name already exists');
}

// ── Controllers ──

export const getContainerTypes = asyncHandler(async (req: Request, res: Response) => {
  const params = req.query as Record<string, string>;

  const qb = new QueryBuilder(params).search(['name', 'description']);
  if (params.isActive !== undefined) qb.where({ isActive: params.isActive === 'true' } as Record<string, unknown>);

  const { query, sort, skip, limit, pagination } = qb.build();

  const [containerTypes, total, productCounts] = await Promise.all([
    ContainerType.find(query).sort(sort).skip(skip).limit(limit).lean<IContainerType[]>(),
    ContainerType.countDocuments(query),
    Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$containerType', count: { $sum: 1 } } }
    ])
  ]);

  const countMap = new Map(productCounts.map((p: { _id: string; count: number }) => [p._id?.toString(), p.count]));

  res.json({
    containerTypes: containerTypes.map(ct => ({
      ...ct,
      productCount: countMap.get(ct._id?.toString() ?? '') || 0
    })),
    pagination: QueryBuilder.paginationResponse(total, pagination.page, pagination.limit)
  });
});

export const getContainerTypeById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const ct = await findOrFail(req.params.id);
  const productCount = await Product.countDocuments({ containerType: ct._id, isActive: true });
  res.json({ ...ct, productCount });
});

export const createContainerType = asyncHandler(async (req: Request, res: Response) => {
  const { name: rawName, description: rawDesc, isActive = true, allowedUomTypes } = req.body;
  if (!rawName) throw new ValidationError('Container type name is required');

  const name = sanitizeString(rawName);
  const description = rawDesc !== undefined ? sanitizeString(rawDesc) : undefined;
  if (!name) throw new ValidationError('Container type name is required');

  if (!allowedUomTypes || !Array.isArray(allowedUomTypes) || allowedUomTypes.length === 0) {
    throw new ValidationError('At least one allowed unit of measurement type is required');
  }

  await checkDuplicateName(name);
  const ct = await new ContainerType({ name, description, isActive, allowedUomTypes }).save();
  res.status(201).json(ct);
});

export const updateContainerType = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const { name: rawName, description: rawDesc, isActive, allowedUomTypes } = req.body;
  const updates: Partial<IContainerType> = {};

  if (rawName !== undefined) {
    const name = sanitizeString(rawName);
    if (!name) throw new ValidationError('Container type name is required');
    await checkDuplicateName(name, req.params.id);
    updates.name = name;
  }
  if (rawDesc !== undefined) updates.description = sanitizeString(rawDesc);
  if (isActive !== undefined) updates.isActive = isActive;
  if (allowedUomTypes !== undefined) {
    if (!Array.isArray(allowedUomTypes) || allowedUomTypes.length === 0) {
      throw new ValidationError('At least one allowed unit of measurement type is required');
    }
    updates.allowedUomTypes = allowedUomTypes;
  }

  const ct = await ContainerType.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!ct) throw new NotFoundError('Container type', req.params.id);

  const authReq = req as AuthenticatedRequest;
  if (authReq.user) console.log(`Container type updated by ${authReq.user.email}: ${ct.name}`);

  res.json(ct);
});

export const deleteContainerType = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const productCount = await Product.countDocuments({ containerType: req.params.id, isDeleted: { $ne: true } });
  if (productCount > 0) {
    throw new ValidationError(`Cannot delete container type. ${productCount} products are using this container type.`);
  }

  const ct = await ContainerType.findByIdAndDelete(req.params.id);
  if (!ct) throw new NotFoundError('Container type', req.params.id);

  const authReq = req as AuthenticatedRequest;
  if (authReq.user) console.log(`Container type deleted by ${authReq.user.email}: ${ct.name}`);

  res.json({ message: 'Container type deleted successfully' });
});
