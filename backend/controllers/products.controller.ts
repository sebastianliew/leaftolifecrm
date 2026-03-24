import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { IUser } from '../models/User.js';
import { QueryBuilder } from '../lib/QueryBuilder.js';
import { asyncHandler, NotFoundError, ValidationError, ReferenceConflictError } from '../middlewares/errorHandler.middleware.js';
import { validateRefs } from '../lib/validations/referenceValidator.js';
import { InventoryMovement } from '../models/inventory/InventoryMovement.js';
import { UnitOfMeasurement } from '../models/UnitOfMeasurement.js';
import { stockAlertService } from '../services/StockAlertService.js';

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

// ── Alerts ──

export const getStockAlerts = asyncHandler(async (_req: Request, res: Response) => {
  const alerts = await stockAlertService.getAlerts();
  res.json({ success: true, alerts });
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
    status = 'active', expiryDate, canSellLoose, containerCapacity,
    bundleInfo, bundlePrice, hasBundle, discountFlags, supplierId
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

  // Validate: canSellLoose requires containerCapacity > 1
  const effectiveContainerCapacity = containerCapacity || 1;
  if (canSellLoose && effectiveContainerCapacity <= 1) {
    throw new ValidationError(
      'Container capacity must be greater than 1 when loose selling is enabled. ' +
      'Set the container capacity to the amount of base units per container (e.g. 75 for a 75ml bottle).'
    );
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
    expiryDate,
    looseStock: 0,
    canSellLoose: canSellLoose || false,
    containerCapacity: effectiveContainerCapacity,
    bundleInfo, bundlePrice, hasBundle,
    discountFlags, supplierId,
  });

  if (!product.sku) await product.generateSKU();
  await product.save();
  await product.populate(PRODUCT_POPULATE);

  res.status(201).json(product);
});

// Fields that can be modified via PUT /products/:id.
// Anything not listed here is silently dropped — prevents mass-assignment of
// sensitive fields like isDeleted, deletedAt, reservedStock, totalQuantity, etc.
const ALLOWED_UPDATE_FIELDS = [
  'name', 'sku', 'description', 'category', 'brand', 'unitOfMeasurement',
  'reorderPoint', 'currentStock', 'costPrice', 'sellingPrice', 'status',
  'expiryDate', 'canSellLoose', 'containerCapacity', 'bundleInfo',
  'bundlePrice', 'hasBundle', 'discountFlags', 'supplierId',
];

export const updateProduct = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const updates: Record<string, any> = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => ALLOWED_UPDATE_FIELDS.includes(k))
  );

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

  // Validate: canSellLoose requires containerCapacity > 1
  const effectiveCanSellLoose = updates.canSellLoose !== undefined ? updates.canSellLoose : originalProduct.canSellLoose;
  const effectiveContainerCapacity = updates.containerCapacity !== undefined ? updates.containerCapacity : originalProduct.containerCapacity;
  if (effectiveCanSellLoose && (effectiveContainerCapacity || 1) <= 1) {
    throw new ValidationError(
      'Container capacity must be greater than 1 when loose selling is enabled. ' +
      'Set the container capacity to the amount of base units per container (e.g. 75 for a 75ml bottle).'
    );
  }

  const authReq = req as AuthenticatedRequest;
  if (updates.costPrice !== undefined && updates.costPrice !== originalProduct.costPrice) {
    if (!authReq.user || authReq.user.role !== 'super_admin') {
      // Non-super-admins cannot change cost price — silently strip it so other
      // fields (stock, selling price, etc.) can still be saved without a 403.
      delete updates.costPrice;
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
    const ref = blendRef as unknown as { _id: { toString(): string }; name: string };
    throw new ReferenceConflictError(
      `Cannot delete: product is an ingredient in active blend template "${ref.name}"`,
      { type: 'blend_template', name: ref.name, id: ref._id.toString() }
    );
  }
  if (bundleRef) {
    const ref = bundleRef as unknown as { _id: { toString(): string }; name: string };
    throw new ReferenceConflictError(
      `Cannot delete: product is part of active bundle "${ref.name}"`,
      { type: 'bundle', name: ref.name, id: ref._id.toString() }
    );
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

export const manageProductPool = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const { action, amount } = req.body as { action: "open" | "close"; amount: number };

  if (!["open", "close"].includes(action)) throw new ValidationError("action must be 'open' or 'close'");
  if (!amount || amount <= 0 || !Number.isFinite(amount)) throw new ValidationError("amount must be a positive number in the product's base unit (ml, g, pieces, etc.)");

  const product = await Product.findById(req.params.id).lean() as any;
  if (!product) throw new NotFoundError("Product", req.params.id);
  if (!product.canSellLoose) throw new ValidationError("This product is not configured for loose sales. Enable canSellLoose first.");

  const uom = await UnitOfMeasurement.findById(product.unitOfMeasurement).lean() as any;
  const uomType = uom?.type as string | undefined;

  const { validatePoolAllocation } = await import("../services/inventory/StockPoolService.js");
  const validation = validatePoolAllocation(product as any, amount, action, uomType);
  if (!validation.valid) throw new ValidationError(validation.error || "Invalid pool allocation");

  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user ? String((authReq.user as any)._id) : "system";
  const unit = product.unitName || "units";

  const movement = new InventoryMovement({
    productId: product._id,
    movementType: "pool_transfer",
    quantity: validation.delta,
    convertedQuantity: validation.delta,
    unitOfMeasurementId: product.unitOfMeasurement,
    baseUnit: unit,
    reference: `POOL-${Date.now()}`,
    notes: `Pool ${action}: ${amount} ${unit} ${action === "open" ? "moved to loose pool" : "sealed back"}`,
    createdBy: userId,
    productName: product.name,
    pool: "any",
  });

  await movement.save();
  await movement.updateProductStock();

  const updatedProduct = await Product.findById(req.params.id).populate(PRODUCT_POPULATE).lean() as any;
  const looseStock = updatedProduct?.looseStock ?? 0;
  const currentStock = updatedProduct?.currentStock ?? 0;

  res.json({
    success: true,
    message: `Successfully ${action === "open" ? "moved" : "sealed back"} ${amount} ${unit} ${action === "open" ? "to loose pool" : ""}`.trim(),
    product: updatedProduct,
    pool: {
      looseStock,
      sealedStock: currentStock - looseStock,
      containerCapacity: updatedProduct?.containerCapacity ?? 1,
    },
  });
});
