import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { IUser } from '../models/User.js';
import { QueryBuilder } from '../lib/QueryBuilder.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middlewares/errorHandler.middleware.js';
import { validateRefs } from '../lib/validations/referenceValidator.js';

// ── Types ──

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

// ── Populate config (single source of truth) ──

const PRODUCT_POPULATE = [
  { path: 'category', select: 'name' },
  { path: 'brand', select: 'name' },
  { path: 'unitOfMeasurement', select: 'name abbreviation' }
];

// ── Controllers ──

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const { query, sort, skip, limit, pagination } = new QueryBuilder(req.query as Record<string, string>)
    .search(['name', 'sku', 'description'])
    .filter('category')
    .filter('brand')
    .filter('status')
    .excludeDeleted()
    .stockStatusFilter()
    .rangeFilter('currentStock', 'minStock', 'maxStock', 'int')
    .rangeFilter('sellingPrice', 'minPrice', 'maxPrice', 'float')
    .build();

  // Sync isActive with status filter
  if (req.query.status) {
    (query as Record<string, unknown>).isActive = req.query.status === 'active';
  }

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate(PRODUCT_POPULATE)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(query)
  ]);

  // Strip costPrice for non-admin users
  const authReq = req as AuthenticatedRequest;
  const canViewCost = authReq.user?.role === 'super_admin' || authReq.user?.role === 'admin';
  const sanitized = canViewCost ? products : products.map(p => {
    const { costPrice, ...rest } = p as Record<string, unknown>;
    return rest;
  });

  res.json({
    products: sanitized,
    pagination: QueryBuilder.paginationResponse(total, pagination.page, pagination.limit)
  });
});

// ── Stats ──

export const getInventoryStats = asyncHandler(async (req: Request, res: Response) => {
  const baseFilter = { isDeleted: { $ne: true } };

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [stats] = await Product.aggregate([
    { $match: baseFilter },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        activeProducts: { $sum: { $cond: ['$isActive', 1, 0] } },
        outOfStock: { $sum: { $cond: [{ $lte: ['$currentStock', 0] }, 1, 0] } },
        lowStock: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ['$currentStock', 0] }, { $lte: ['$currentStock', '$reorderPoint'] }] },
              1, 0
            ]
          }
        },
        expired: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ['$expiryDate', null] }, { $lt: ['$expiryDate', now] }] },
              1, 0
            ]
          }
        },
        expiringSoon: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$expiryDate', null] },
                  { $gte: ['$expiryDate', now] },
                  { $lte: ['$expiryDate', thirtyDaysFromNow] }
                ]
              },
              1, 0
            ]
          }
        },
        totalValue: {
          $sum: { $multiply: [{ $ifNull: ['$currentStock', 0] }, { $ifNull: ['$costPrice', 0] }] }
        }
      }
    }
  ]);

  res.json(stats || {
    totalProducts: 0, activeProducts: 0, outOfStock: 0,
    lowStock: 0, expired: 0, expiringSoon: 0, totalValue: 0
  });
});

export const getProductById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const product = await Product.findById(req.params.id)
    .populate(PRODUCT_POPULATE)
    .lean();

  if (!product) throw new NotFoundError('Product', req.params.id);
  res.json(product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const {
    name, sku, description, category, brand, unitOfMeasurement,
    quantity, reorderPoint, currentStock, costPrice, sellingPrice,
    status = 'active', expiryDate
  } = req.body;

  // Validate references
  await validateRefs([
    { model: 'Category', id: category },
    { model: 'UnitOfMeasurement', id: unitOfMeasurement },
    { model: 'Brand', id: brand, optional: true }
  ]);

  // Check duplicate name (case-insensitive, excluding soft-deleted)
  if (name) {
    const existing = await Product.findOne({
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      isDeleted: { $ne: true }
    });
    if (existing) throw new ValidationError(`Product with name "${name}" already exists`);
  }

  const product = new Product({
    name, sku, description, category, brand, unitOfMeasurement,
    quantity: quantity || 0,
    reorderPoint: reorderPoint || 0,
    currentStock: currentStock || 0,
    totalQuantity: currentStock || 0,
    availableStock: currentStock || 0,
    reservedStock: 0,
    costPrice, sellingPrice, status,
    isActive: status === 'active',
    expiryDate
  });

  if (!product.sku) await product.generateSKU();
  await product.save();
  await product.populate(PRODUCT_POPULATE);

  res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const updates = { ...req.body };
  delete updates._id;
  delete updates.createdAt;
  delete updates.updatedAt;

  // Validate references if being updated
  await validateRefs([
    { model: 'Category', id: updates.category, optional: true },
    { model: 'UnitOfMeasurement', id: updates.unitOfMeasurement, optional: true },
    { model: 'Brand', id: updates.brand, optional: true }
  ]);

  // Check duplicate name (case-insensitive, excluding soft-deleted)
  if (updates.name) {
    const existingByName = await Product.findOne({
      name: { $regex: new RegExp(`^${updates.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      _id: { $ne: req.params.id },
      isDeleted: { $ne: true }
    });
    if (existingByName) throw new ValidationError(`Product with name "${updates.name}" already exists`);
  }

  // Check SKU uniqueness if being updated
  if (updates.sku) {
    const existingProduct = await Product.findOne({
      sku: updates.sku,
      _id: { $ne: req.params.id }
    });
    if (existingProduct) throw new ValidationError('Product with this SKU already exists');
  }

  // Sync isActive with status
  if (updates.status !== undefined) {
    updates.isActive = updates.status === 'active';
  }

  // Check cost price permission
  const originalProduct = await Product.findById(req.params.id);
  if (!originalProduct) throw new NotFoundError('Product', req.params.id);

  const authReq = req as AuthenticatedRequest;
  if (updates.costPrice !== undefined && updates.costPrice !== originalProduct.costPrice) {
    if (!authReq.user || authReq.user.role !== 'super_admin') {
      res.status(403).json({ error: 'Only super admin can modify cost price' });
      return;
    }
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  ).populate(PRODUCT_POPULATE);

  if (!product) throw new NotFoundError('Product', req.params.id);
  res.json(product);
});

export const deleteProduct = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new NotFoundError('Product', req.params.id);
  if (product.isDeleted) throw new ValidationError('Product is already deleted');

  // Check for active references before allowing deletion
  const { BlendTemplate } = await import('../models/BlendTemplate.js');
  const { Bundle } = await import('../models/Bundle.js');

  const [blendRef, bundleRef] = await Promise.all([
    BlendTemplate.findOne({
      'ingredients.productId': req.params.id,
      isActive: true,
      isDeleted: { $ne: true }
    }).select('name').lean(),
    Bundle.findOne({
      'bundleProducts.productId': req.params.id,
      isActive: true,
      isDeleted: { $ne: true }
    }).select('name').lean()
  ]);

  if (blendRef) {
    throw new ValidationError(`Cannot delete: product is an ingredient in active blend template "${(blendRef as unknown as { name: string }).name}"`);
  }
  if (bundleRef) {
    throw new ValidationError(`Cannot delete: product is part of active bundle "${(bundleRef as unknown as { name: string }).name}"`);
  }

  const authReq = req as AuthenticatedRequest;
  await product.softDelete(authReq.user ? String(authReq.user._id) : undefined, 'User requested deletion');

  res.json({ message: 'Product deleted successfully' });
});

export const getProductTemplates = asyncHandler(async (_req: Request, res: Response) => {
  const templates = await Product.find({ isActive: true })
    .select('name sku category brand unitOfMeasurement sellingPrice costPrice')
    .populate(PRODUCT_POPULATE)
    .limit(50)
    .lean();

  res.json(templates);
});

export const bulkDeleteProducts = asyncHandler(async (req: Request, res: Response) => {
  const { productIds } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    throw new ValidationError('Product IDs array is required');
  }

  const invalidIds = productIds.filter((id: string) => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    throw new ValidationError('Invalid product IDs provided');
  }

  const existingProducts = await Product.find({
    _id: { $in: productIds },
    isDeleted: { $ne: true }
  }).select('_id name sku');

  if (existingProducts.length === 0) {
    throw new NotFoundError('No products found or all already deleted');
  }

  const authReq = req as AuthenticatedRequest;

  const result = await Product.updateMany(
    { _id: { $in: existingProducts.map(p => p._id) }, isDeleted: { $ne: true } },
    {
      $set: {
        isDeleted: true,
        isActive: false,
        status: 'inactive',
        deletedAt: new Date(),
        deletedBy: authReq.user?._id?.toString() || 'system',
        deleteReason: 'Bulk deletion requested by user',
        updatedAt: new Date()
      }
    }
  );

  res.json({
    message: `Successfully deleted ${result.modifiedCount} products`,
    deactivatedCount: result.modifiedCount,
    requestedCount: productIds.length,
    notFoundCount: productIds.length - existingProducts.length,
    products: existingProducts.map(p => ({ id: p._id, name: p.name, sku: p.sku }))
  });
});

export const exportProducts = asyncHandler(async (req: Request, res: Response) => {
  const XLSX = await import('xlsx');
  const user = (req as unknown as { user: IUser }).user;
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  const products = await Product.find({ isDeleted: { $ne: true } })
    .populate('category', 'name')
    .populate('brand', 'name')
    .populate('unitOfMeasurement', 'name')
    .sort({ name: 1 })
    .lean();

  const rows = products.map((p: Record<string, unknown>) => {
    const cat = p.category as { name?: string } | null;
    const brand = p.brand as { name?: string } | null;
    const unit = p.unitOfMeasurement as { name?: string } | null;
    const row: Record<string, unknown> = {
      'Product Name': p.name || '',
      'SKU': p.sku || '',
      'Category': cat?.name || '',
      'Brand': brand?.name || '',
      'Unit': unit?.name || '',
      'Selling Price': p.sellingPrice ?? '',
      'Current Stock': p.currentStock ?? 0,
      'Reorder Point': p.reorderPoint ?? '',
      'Status': p.isActive ? 'Active' : 'Inactive',
    };
    if (isAdmin) {
      row['Cost Price'] = p.costPrice ?? '';
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const filename = `inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
});
