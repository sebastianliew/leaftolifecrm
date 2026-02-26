import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Brand } from '../models/Brand.js';
import { Product } from '../models/Product.js';
import { IUser } from '../models/User.js';
import { QueryBuilder } from '../lib/QueryBuilder.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middlewares/errorHandler.middleware.js';
import { validateUnique } from '../lib/validations/referenceValidator.js';

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export const getBrands = asyncHandler(async (req: Request, res: Response) => {
  const { query, sort, skip, limit, pagination } = new QueryBuilder(req.query as Record<string, string>, { limit: 10 })
    .search(['name', 'code', 'description'])
    .filter('status')
    .build();

  if (req.query.status === 'active') {
    (query as Record<string, unknown>).isActive = true;
  }

  const [brands, total] = await Promise.all([
    Brand.find(query).sort(sort).skip(skip).limit(limit),
    Brand.countDocuments(query)
  ]);

  // Add product count to each brand
  const brandsWithCount = await Promise.all(
    brands.map(async (brand) => {
      const productCount = await Product.countDocuments({ brand: brand._id, isActive: true });
      return { ...brand.toObject(), productCount };
    })
  );

  res.json({
    brands: brandsWithCount,
    pagination: QueryBuilder.paginationResponse(total, pagination.page, pagination.limit)
  });
});

export const getBrandById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ValidationError('Invalid brand ID');

  const brand = await Brand.findById(req.params.id);
  if (!brand) throw new NotFoundError('Brand', req.params.id);

  const productCount = await Product.countDocuments({ brand: brand._id, isActive: true });
  res.json({ ...brand.toObject(), productCount });
});

export const createBrand = asyncHandler(async (req: Request, res: Response) => {
  const { name, code, description, website, contactEmail, contactPhone, status = 'active', isExclusive = false } = req.body;

  // Check for duplicate name/code
  await validateUnique('Brand', 'name', name, undefined, 'Brand');
  if (code) {
    const existingCode = await Brand.findOne({ code });
    if (existingCode) throw new ValidationError('Brand with this code already exists');
  }

  const brand = new Brand({
    name, code, description, website, contactEmail, contactPhone,
    status, isActive: status === 'active', isExclusive
  });
  await brand.save();

  res.status(201).json(brand);
});

export const updateBrand = asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ValidationError('Invalid brand ID');

  const updates = { ...req.body };
  delete updates._id;
  delete updates.createdAt;
  delete updates.updatedAt;

  if (updates.name) await validateUnique('Brand', 'name', updates.name, req.params.id, 'Brand');
  if (updates.code) {
    const existingCode = await Brand.findOne({ code: updates.code, _id: { $ne: req.params.id } });
    if (existingCode) throw new ValidationError('Brand with this code already exists');
  }

  if (updates.status !== undefined) updates.isActive = updates.status === 'active';

  const brand = await Brand.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!brand) throw new NotFoundError('Brand', req.params.id);

  const authReq = req as AuthenticatedRequest;
  if (authReq.user) console.log(`Brand updated by ${authReq.user.email}: ${brand.name}`);

  res.json(brand);
});

export const deleteBrand = asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ValidationError('Invalid brand ID');

  const productCount = await Product.countDocuments({ brand: req.params.id });
  if (productCount > 0) throw new ValidationError(`Cannot delete brand. ${productCount} products are using this brand.`);

  const brand = await Brand.findByIdAndDelete(req.params.id);
  if (!brand) throw new NotFoundError('Brand', req.params.id);

  const authReq = req as AuthenticatedRequest;
  if (authReq.user) console.log(`Brand deleted by ${authReq.user.email}: ${brand.name}`);

  res.json({ message: 'Brand deleted successfully' });
});
