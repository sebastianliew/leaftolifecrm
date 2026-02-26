import { Request, Response } from 'express';
import { Bundle } from '../models/Bundle.js';
import { Product } from '../models/Product.js';
import { BlendTemplate } from '../models/BlendTemplate.js';
import { IUser } from '../models/User.js';
import { QueryBuilder } from '../lib/QueryBuilder.js';
import { asyncHandler, NotFoundError, ValidationError, ForbiddenError } from '../middlewares/errorHandler.middleware.js';

interface BundleProduct {
  productId: string;
  name: string;
  quantity: number;
  individualPrice: number;
  totalPrice: number;
  productType?: string;
  blendTemplateId?: string;
}

interface AuthenticatedRequest extends Request { user?: IUser; }

const BUNDLE_POPULATE = { path: 'bundleProducts.productId', select: 'name sku availableStock sellingPrice' };

// ── Shared helper: validate bundle products and calculate pricing ──

async function validateAndPriceBundleProducts(
  bundleProducts: BundleProduct[],
  bundlePrice: number
) {
  let individualTotalPrice = 0;

  for (const bp of bundleProducts) {
    const isBlend = bp.productType === 'fixed_blend' || bp.blendTemplateId;
    const item = isBlend
      ? await BlendTemplate.findById(bp.productId)
      : await Product.findById(bp.productId);

    if (!item) {
      throw new ValidationError(`${isBlend ? 'Blend template' : 'Product'} with ID ${bp.productId} not found`);
    }

    bp.name = item.name;
    bp.totalPrice = bp.quantity * bp.individualPrice;
    individualTotalPrice += bp.totalPrice;
  }

  const savings = Math.max(0, individualTotalPrice - bundlePrice);
  const savingsPercentage = individualTotalPrice > 0
    ? Math.round((savings / individualTotalPrice) * 100)
    : 0;

  return { individualTotalPrice, savings, savingsPercentage };
}

function requireAuth(req: Request): AuthenticatedRequest {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) throw new ForbiddenError('User authentication required');
  return authReq;
}

// ── Controllers ──

export const getBundles = asyncHandler(async (req: Request, res: Response) => {
  const getAllBundles = (req.query as Record<string, string>).getAllBundles === 'true';

  const qb = new QueryBuilder(req.query as Record<string, string>)
    .search(['name', 'description', 'category']);

  // Custom filters
  const params = req.query as Record<string, string>;
  if (params.category) qb.where({ category: { $regex: params.category, $options: 'i' } } as Record<string, unknown>);
  if (params.isActive !== undefined) qb.where({ isActive: params.isActive === 'true' } as Record<string, unknown>);
  if (params.isPromoted !== undefined) qb.where({ isPromoted: params.isPromoted === 'true' } as Record<string, unknown>);
  if (params.tags) qb.where({ tags: { $in: params.tags.split(',') } } as Record<string, unknown>);

  qb.rangeFilter('bundlePrice', 'minPrice', 'maxPrice', 'float');
  if (params.minSavings) qb.where({ savingsPercentage: { $gte: parseFloat(params.minSavings) } } as Record<string, unknown>);

  const { query, sort, skip, limit, pagination } = qb.build();

  let bundlesQuery = Bundle.find(query).populate(BUNDLE_POPULATE).sort(sort);
  if (!getAllBundles) bundlesQuery = bundlesQuery.skip(skip).limit(limit);

  const [bundles, total] = await Promise.all([bundlesQuery.lean(), Bundle.countDocuments(query)]);

  res.json({
    bundles,
    pagination: getAllBundles
      ? { total, page: 1, limit: total, pages: 1 }
      : QueryBuilder.paginationResponse(total, pagination.page, pagination.limit)
  });
});

export const getBundleById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const bundle = await Bundle.findById(req.params.id).populate(BUNDLE_POPULATE).lean();
  if (!bundle) throw new NotFoundError('Bundle', req.params.id);
  res.json(bundle);
});

export const createBundle = asyncHandler(async (req: Request, res: Response) => {
  const authReq = requireAuth(req);
  const data = req.body;

  if (!data.name || !data.bundleProducts || !data.bundlePrice) {
    throw new ValidationError('Missing required fields: name, bundleProducts, or bundlePrice');
  }

  const pricing = await validateAndPriceBundleProducts(data.bundleProducts, data.bundlePrice);

  const bundle = new Bundle({
    ...data,
    sku: `BDL-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
    ...pricing,
    currency: 'SGD',
    createdBy: authReq.user!.id
  });

  await bundle.save();
  await bundle.updateAvailability();
  await bundle.populate(BUNDLE_POPULATE);

  res.status(201).json(bundle);
});

export const updateBundle = asyncHandler(async (req: Request, res: Response) => {
  const authReq = requireAuth(req);
  const updates = req.body;

  if (updates.bundleProducts) {
    await validateAndPriceBundleProducts(updates.bundleProducts, updates.bundlePrice || 0);
  }

  const bundle = await Bundle.findByIdAndUpdate(
    req.params.id,
    { ...updates, lastModifiedBy: authReq.user!.id },
    { new: true, runValidators: true }
  );
  if (!bundle) throw new NotFoundError('Bundle', req.params.id);

  await bundle.updateAvailability();
  await bundle.populate(BUNDLE_POPULATE);

  console.log(`Bundle updated by ${authReq.user!.email}: ${bundle.name}`);
  res.json(bundle);
});

export const deleteBundle = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const authReq = requireAuth(req);
  const bundle = await Bundle.findByIdAndDelete(req.params.id);
  if (!bundle) throw new NotFoundError('Bundle', req.params.id);

  console.log(`Bundle deleted by ${authReq.user!.email}: ${bundle.name}`);
  res.json({ message: 'Bundle deleted successfully' });
});

export const getBundleCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await Bundle.distinct('category', { category: { $nin: [null, ''] } });
  res.json({ categories: categories.filter(Boolean) });
});

export const getPopularBundles = asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string || '10');
  const bundles = await Bundle.find({ isActive: true })
    .populate('bundleProducts.productId', 'name sku')
    .sort({ savingsPercentage: -1, createdAt: -1 })
    .limit(limit).lean();
  res.json({ bundles });
});

export const getPromotedBundles = asyncHandler(async (_req: Request, res: Response) => {
  const bundles = await Bundle.find({ isActive: true, isPromoted: true })
    .populate('bundleProducts.productId', 'name sku')
    .sort({ createdAt: -1 }).lean();
  res.json({ bundles });
});

export const getBundleStats = asyncHandler(async (_req: Request, res: Response) => {
  const [total, active, promoted, totalValue] = await Promise.all([
    Bundle.countDocuments({}),
    Bundle.countDocuments({ isActive: true }),
    Bundle.countDocuments({ isPromoted: true }),
    Bundle.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, total: { $sum: '$bundlePrice' } } }])
  ]);
  res.json({ stats: { total, active, promoted, totalValue: totalValue[0]?.total || 0 } });
});

export const checkBundleAvailability = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const quantity = parseInt(req.query.quantity as string || '1');
  const bundle = await Bundle.findById(req.params.id);
  if (!bundle) throw new NotFoundError('Bundle', req.params.id);
  const availability = await bundle.checkAvailability(quantity);
  res.json(availability);
});

export const calculateBundlePricing = asyncHandler(async (req: Request, res: Response) => {
  const { bundleProducts, bundlePrice } = req.body;
  if (!bundleProducts?.length) throw new ValidationError('Bundle products are required');

  const pricing = await validateAndPriceBundleProducts(bundleProducts, bundlePrice);
  res.json({ bundlePrice, ...pricing, currency: 'SGD' });
});
