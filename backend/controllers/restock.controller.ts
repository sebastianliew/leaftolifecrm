import { Request, Response } from 'express';
import { IUser } from '../models/User.js';
import { RestockService } from '../services/inventory/RestockService.js';
import { RestockValidator } from '../lib/validations/restock.js';
import { asyncHandler, ValidationError } from '../middlewares/errorHandler.middleware.js';

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

const restockService = new RestockService();

export const restockProduct = asyncHandler(async (req: Request, res: Response) => {
  const validationResult = RestockValidator.validateRestockOperation(req.body);
  if (!validationResult.success) {
    throw new ValidationError('Invalid restock operation', validationResult.errors);
  }

  const createdBy = (req as AuthenticatedRequest).user?._id?.toString() || 'system';
  const result = await restockService.restockProduct(validationResult.data!, createdBy);

  // RestockService catches its own errors and returns `{success: false, error}`
  // inside the result. Translate that into a proper HTTP 400 so callers can
  // branch on status instead of inspecting the body.
  if (!result.success) {
    throw new ValidationError(result.error || 'Restock failed', { result });
  }

  res.json({ success: true, data: result, message: 'Product restocked successfully' });
});

export const bulkRestockProducts = asyncHandler(async (req: Request, res: Response) => {
  const validationResult = RestockValidator.validateBulkRestockRequest(req.body);
  if (!validationResult.success) {
    throw new ValidationError('Invalid bulk restock request', validationResult.errors);
  }

  const createdBy = (req as AuthenticatedRequest).user?._id?.toString() || 'system';
  const result = await restockService.bulkRestock(validationResult.data!, createdBy);

  res.json({
    success: true,
    data: result,
    message: `Bulk restock completed: ${result.successCount}/${result.totalOperations} successful`
  });
});

export const getRestockHistory = asyncHandler(async (req: Request, res: Response) => {
  const productId = req.query.productId as string;
  const limit = parseInt(req.query.limit as string || '100');

  const history = await restockService.getRestockHistory(productId || undefined, limit);
  res.json({ success: true, data: history });
});

export const getRestockBatches = asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string || '100');
  const batches = await restockService.getBatchHistory(limit);
  res.json({ success: true, data: batches });
});
