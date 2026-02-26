import { Request, Response } from 'express';
import { IUser } from '../models/User.js';
import { RestockService } from '../services/inventory/RestockService.js';
import { RestockValidator } from '../lib/validations/restock.js';
import { asyncHandler, ValidationError } from '../middlewares/errorHandler.middleware.js';

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

const restockService = new RestockService();

export const getRestockSuggestions = asyncHandler(async (req: Request, res: Response) => {
  const queryData = {
    threshold: parseFloat(req.query.threshold as string || '1.0'),
    category: req.query.category as string || undefined,
    supplier: req.query.supplier as string || undefined,
    includeInactive: req.query.includeInactive === 'true'
  };

  const validationResult = RestockValidator.validateRestockSuggestionQuery(queryData);
  if (!validationResult.success) {
    throw new ValidationError('Invalid query parameters', validationResult.errors);
  }

  const suggestions = await restockService.getRestockSuggestions(
    validationResult.data!.threshold,
    validationResult.data!.category,
    validationResult.data!.supplier
  );

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  res.json({
    success: true,
    data: {
      suggestions,
      summary: {
        total: suggestions.length,
        high: suggestions.filter(s => s.priority === 'high').length,
        medium: suggestions.filter(s => s.priority === 'medium').length,
        low: suggestions.filter(s => s.priority === 'low').length
      }
    }
  });
});

export const restockProduct = asyncHandler(async (req: Request, res: Response) => {
  const validationResult = RestockValidator.validateRestockOperation(req.body);
  if (!validationResult.success) {
    throw new ValidationError('Invalid restock operation', validationResult.errors);
  }

  const createdBy = (req as AuthenticatedRequest).user?._id?.toString() || 'system';
  const result = await restockService.restockProduct(validationResult.data!, createdBy);

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
