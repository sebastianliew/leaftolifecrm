import { Request, Response } from 'express';
import { Category, ICategory } from '../models/Category.js';
import { Product } from '../models/Product.js';
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
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ])
  ]);

  const countMap = new Map(productCounts.map((p: { _id: string; count: number }) => [p._id?.toString(), p.count]));

  res.json({
    categories: categories.map(c => ({
      ...c,
      productCount: countMap.get((c._id as string).toString()) || 0
    })),
    pagination: QueryBuilder.paginationResponse(total, pagination.page, pagination.limit)
  });
});

export const getCategoryById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const category = await findCategoryOrFail(req.params.id);
  const productCount = await Product.countDocuments({ category: category._id as string, isActive: true });
  res.json({ ...category, productCount });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name: rawName, description: rawDesc, level = 1, isActive = true } = req.body;
  if (!rawName) throw new ValidationError('Category name is required');

  const name = sanitizeString(rawName);
  const description = rawDesc !== undefined ? sanitizeString(rawDesc) : undefined;
  if (!name) throw new ValidationError('Category name is required');

  await checkDuplicateName(name);
  const category = await new Category({ name, description, level, isActive }).save();
  res.status(201).json(category);
});

export const updateCategory = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const { name: rawName, description: rawDesc, level, isActive } = req.body;
  const updates: Partial<ICategory> = {};

  if (rawName !== undefined) {
    const name = sanitizeString(rawName);
    if (!name) throw new ValidationError('Category name is required');
    await checkDuplicateName(name, req.params.id);
    updates.name = name;
  }
  if (rawDesc !== undefined) updates.description = sanitizeString(rawDesc);
  if (level !== undefined) updates.level = level;
  if (isActive !== undefined) updates.isActive = isActive;

  const category = await Category.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!category) throw new NotFoundError('Category', req.params.id);

  const authReq = req as AuthenticatedRequest;
  if (authReq.user) console.log(`Category updated by ${authReq.user.email}: ${category.name}`);

  res.json(category);
});

export const deleteCategory = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const productCount = await Product.countDocuments({ category: req.params.id });
  if (productCount > 0) {
    throw new ValidationError(`Cannot delete category. ${productCount} products are using this category.`);
  }

  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new NotFoundError('Category', req.params.id);

  const authReq = req as AuthenticatedRequest;
  if (authReq.user) console.log(`Category deleted by ${authReq.user.email}: ${category.name}`);

  res.json({ message: 'Category deleted successfully' });
});
