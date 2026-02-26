import { Request, Response } from 'express';
import { Supplier } from '../models/Supplier.js';
import { Product } from '../models/Product.js';
import { IUser } from '../models/User.js';
import { QueryBuilder } from '../lib/QueryBuilder.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middlewares/errorHandler.middleware.js';
import { validateUnique } from '../lib/validations/referenceValidator.js';

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export const getSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const { query, sort, skip, limit, pagination } = new QueryBuilder(req.query as Record<string, string>, { limit: 10 })
    .search(['name', 'code', 'description', 'contactPerson', 'email'])
    .filter('status')
    .build();

  if (req.query.status === 'active') (query as Record<string, unknown>).isActive = true;

  const [suppliers, total] = await Promise.all([
    Supplier.find(query).sort(sort).skip(skip).limit(limit),
    Supplier.countDocuments(query)
  ]);

  res.json({
    suppliers: suppliers.map(s => ({ ...s.toObject(), id: s._id.toString(), _id: undefined })),
    pagination: QueryBuilder.paginationResponse(total, pagination.page, pagination.limit)
  });
});

export const getSupplierById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new NotFoundError('Supplier', req.params.id);
  res.json({ ...supplier.toObject(), id: supplier._id.toString(), _id: undefined });
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body;

  await validateUnique('Supplier', 'name', data.name, undefined, 'Supplier');
  if (data.code) {
    const existing = await Supplier.findOne({ code: data.code });
    if (existing) throw new ValidationError('Supplier with this code already exists');
  }

  const authReq = req as AuthenticatedRequest;
  const supplier = new Supplier({
    ...data,
    isActive: data.status === 'active' || data.isActive,
    createdBy: authReq.user?._id || 'system',
    lastModifiedBy: authReq.user?._id || 'system'
  });
  await supplier.save();

  res.status(201).json({ ...supplier.toObject(), id: supplier._id.toString(), _id: undefined });
});

export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const updates = { ...req.body };
  delete updates._id;
  delete updates.createdAt;
  delete updates.updatedAt;

  if (updates.name) await validateUnique('Supplier', 'name', updates.name, req.params.id, 'Supplier');
  if (updates.code) {
    const existing = await Supplier.findOne({ code: updates.code, _id: { $ne: req.params.id } });
    if (existing) throw new ValidationError('Supplier with this code already exists');
  }

  const authReq = req as AuthenticatedRequest;
  if (updates.status !== undefined) updates.isActive = updates.status === 'active';
  updates.lastModifiedBy = authReq.user?._id || 'system';

  const supplier = await Supplier.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!supplier) throw new NotFoundError('Supplier', req.params.id);

  if (authReq.user) console.log(`Supplier updated by ${authReq.user.email}: ${supplier.name}`);
  res.json({ ...supplier.toObject(), id: supplier._id.toString(), _id: undefined });
});

export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  const productCount = await Product.countDocuments({ supplier: req.params.id });
  if (productCount > 0) throw new ValidationError(`Cannot delete supplier. ${productCount} products are using this supplier.`);

  const supplier = await Supplier.findByIdAndDelete(req.params.id);
  if (!supplier) throw new NotFoundError('Supplier', req.params.id);

  const authReq = req as AuthenticatedRequest;
  if (authReq.user) console.log(`Supplier deleted by ${authReq.user.email}: ${supplier.name}`);
  res.json({ message: 'Supplier deleted successfully' });
});
