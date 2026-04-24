import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Category, ICategory } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Bundle } from '../models/Bundle.js';
import { BlendTemplate } from '../models/BlendTemplate.js';
import { IUser } from '../models/User.js';
import { QueryBuilder } from '../lib/QueryBuilder.js';
import { asyncHandler, NotFoundError, ValidationError, ConflictError } from '../middlewares/errorHandler.middleware.js';

interface AuthenticatedRequest extends Request { user?: IUser; }

// ── Helpers ──

/** Strip HTML tags and trim whitespace */
function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Invalid input: expected a string');
  return value.replace(/<[^>]*>/g, '').trim();
}

async function findCategoryOrFail(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ValidationError('Invalid ID format');
  const category = await Category.findById(id).lean<ICategory>();
  if (!category) throw new NotFoundError('Category', id);
  return category;
}

async function checkDuplicateName(name: string, excludeId?: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query: Record<string, unknown> = { name: { $regex: `^${escaped}$`, $options: 'i' } };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await Category.findOne(query);
  if (existing) throw new ConflictError('Category with this name already exists');
}

async function assertParentExists(parentId: unknown): Promise<mongoose.Types.ObjectId | null> {
  if (parentId === null || parentId === undefined || parentId === '') return null;
  if (typeof parentId !== 'string' || !mongoose.isValidObjectId(parentId)) {
    throw new ValidationError('Invalid parent id');
  }
  const parent = await Category.findById(parentId).lean<ICategory>();
  if (!parent) throw new ValidationError('Parent category does not exist');
  return new mongoose.Types.ObjectId(parentId);
}

/** Count active (non-deleted) product references — used for list/byId productCount */
function activeProductFilter() {
  return { isActive: true, isDeleted: { $ne: true } } as const;
}

// ── Controllers ──

export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const params = req.query as Record<string, string>;

  const qb = new QueryBuilder(params).search(['name', 'description']);
  if (params.isActive !== undefined) qb.where({ isActive: params.isActive === 'true' } as Record<string, unknown>);

  const { query, sort, skip, limit, pagination } = qb.build();

  const [categories, total, productCounts] = await Promise.all([
    Category.find(query).sort(sort).skip(skip).limit(limit).lean<ICategory[]>(),
    Category.countDocuments(query),
    Product.aggregate([
      { $match: activeProductFilter() },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ])
  ]);

  const countMap = new Map(productCounts.map((p: { _id: string; count: number }) => [p._id?.toString(), p.count]));

  res.json({
    categories: categories.map(c => ({
      ...c,
      productCount: countMap.get(c._id?.toString() ?? "") || 0
    })),
    pagination: QueryBuilder.paginationResponse(total, pagination.page, pagination.limit)
  });
});

export const getCategoryById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const category = await findCategoryOrFail(req.params.id);
  const productCount = await Product.countDocuments({ category: category._id, ...activeProductFilter() });
  res.json({ ...category, productCount });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name: rawName, description: rawDesc, level = 1, isActive = true, allowedUomTypes, defaultUom, defaultCanSellLoose, parent: rawParent } = req.body;
  if (rawName === undefined || rawName === null) throw new ValidationError('Category name is required');

  const name = sanitizeString(rawName);
  const description = rawDesc !== undefined && rawDesc !== null ? sanitizeString(rawDesc) : undefined;
  if (!name) throw new ValidationError('Category name is required');

  const parent = await assertParentExists(rawParent);

  await checkDuplicateName(name);
  const category = await new Category({
    name,
    description,
    level,
    isActive,
    allowedUomTypes: allowedUomTypes ?? [],
    ...(defaultUom ? { defaultUom } : {}),
    ...(defaultCanSellLoose !== undefined ? { defaultCanSellLoose } : {}),
    ...(parent ? { parent } : {})
  }).save();
  res.status(201).json(category);
});

export const updateCategory = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  // Existence & id-validity first — surfaces 404 before any conflict check.
  await findCategoryOrFail(req.params.id);

  const { name: rawName, description: rawDesc, level, isActive, allowedUomTypes, defaultUom, defaultCanSellLoose, parent: rawParent } = req.body;
  const updates: Record<string, unknown> = {};
  const unsets: Record<string, 1> = {};

  if (rawName !== undefined) {
    const name = sanitizeString(rawName);
    if (!name) throw new ValidationError('Category name is required');
    await checkDuplicateName(name, req.params.id);
    updates.name = name;
  }
  if (rawDesc !== undefined) updates.description = rawDesc === null ? '' : sanitizeString(rawDesc);
  if (level !== undefined) updates.level = level;
  if (isActive !== undefined) updates.isActive = isActive;
  if (allowedUomTypes !== undefined) updates.allowedUomTypes = allowedUomTypes;
  if (defaultUom !== undefined) {
    if (defaultUom === null || defaultUom === '') unsets.defaultUom = 1;
    else updates.defaultUom = defaultUom;
  }
  if (defaultCanSellLoose !== undefined) updates.defaultCanSellLoose = Boolean(defaultCanSellLoose);
  if (rawParent !== undefined) {
    if (rawParent === null || rawParent === '') {
      unsets.parent = 1;
    } else {
      if (typeof rawParent === 'string' && rawParent === req.params.id) {
        throw new ValidationError('Category cannot be its own parent');
      }
      updates.parent = await assertParentExists(rawParent);
    }
  }

  const mutation: Record<string, unknown> = { ...updates };
  if (Object.keys(unsets).length) mutation.$unset = unsets;

  const category = await Category.findByIdAndUpdate(req.params.id, mutation, { new: true, runValidators: true });
  if (!category) throw new NotFoundError('Category', req.params.id);

  const authReq = req as AuthenticatedRequest;
  if (authReq.user) console.log(`Category updated by ${authReq.user.email}: ${category.name}`);

  res.json(category);
});

export const deleteCategory = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const category = await findCategoryOrFail(req.params.id);

  const [productCount, childCount, bundleCount, blendCount] = await Promise.all([
    Product.countDocuments({ category: req.params.id, isDeleted: { $ne: true } }),
    Category.countDocuments({ parent: req.params.id }),
    // Bundle & BlendTemplate store `category` as a plain string (the name), not a ref.
    // Guard against orphaning those rows by the category's name.
    Bundle.countDocuments({ category: category.name }),
    BlendTemplate.countDocuments({ category: category.name })
  ]);

  const blockers: string[] = [];
  if (productCount > 0) blockers.push(`${productCount} product${productCount === 1 ? '' : 's'}`);
  if (childCount > 0) blockers.push(`${childCount} child categor${childCount === 1 ? 'y' : 'ies'}`);
  if (bundleCount > 0) blockers.push(`${bundleCount} bundle${bundleCount === 1 ? '' : 's'}`);
  if (blendCount > 0) blockers.push(`${blendCount} blend template${blendCount === 1 ? '' : 's'}`);

  if (blockers.length) {
    throw new ValidationError(`Cannot delete category. In use by: ${blockers.join(', ')}.`);
  }

  const deleted = await Category.findByIdAndDelete(req.params.id);
  if (!deleted) throw new NotFoundError('Category', req.params.id);

  const authReq = req as AuthenticatedRequest;
  if (authReq.user) console.log(`Category deleted by ${authReq.user.email}: ${deleted.name}`);

  res.json({ message: 'Category deleted successfully' });
});
