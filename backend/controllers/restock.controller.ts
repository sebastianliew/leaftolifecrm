import { Request, Response } from 'express';
import { IUser } from '../models/User.js';

interface AuthenticatedRequest extends Request {
  user?: IUser;
}
import { RestockService } from '../services/inventory/RestockService.js';
import { RestockValidator } from '../lib/validations/restock.js';

const restockService = new RestockService();

export const getRestockSuggestions = async (req: Request, res: Response) => {
  try {
    const queryData = {
      threshold: parseFloat(req.query.threshold as string || '1.0'),
      category: req.query.category as string || undefined,
      supplier: req.query.supplier as string || undefined,
      includeInactive: req.query.includeInactive === 'true'
    };

    const validationResult = RestockValidator.validateRestockSuggestionQuery(queryData);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: validationResult.errors
      });
    }

    const suggestions = await restockService.getRestockSuggestions(
      validationResult.data!.threshold,
      validationResult.data!.category,
      validationResult.data!.supplier
    );

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return res.json({
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

  } catch (error) {
    console.error('Restock suggestions error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch restock suggestions'
    });
  }
};

export const restockProduct = async (req: Request, res: Response) => {
  try {
    const validationResult = RestockValidator.validateRestockOperation(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid restock operation',
        errors: validationResult.errors
      });
    }

    // Get user ID from authenticated request
    const createdBy = (req as AuthenticatedRequest).user?._id?.toString() || 'system';
    const result = await restockService.restockProduct(validationResult.data!, createdBy);
    
    return res.json({
      success: true,
      data: result,
      message: 'Product restocked successfully'
    });

  } catch (error) {
    console.error('Restock operation error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to process restock operation'
    });
  }
};

export const bulkRestockProducts = async (req: Request, res: Response) => {
  try {
    const validationResult = RestockValidator.validateBulkRestockRequest(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bulk restock request',
        errors: validationResult.errors
      });
    }

    // Get user ID from authenticated request
    const createdBy = (req as AuthenticatedRequest).user?._id?.toString() || 'system';
    const result = await restockService.bulkRestock(validationResult.data!, createdBy);
    
    return res.json({
      success: true,
      data: result,
      message: `Bulk restock completed: ${result.successCount}/${result.totalOperations} successful`
    });

  } catch (error) {
    console.error('Bulk restock error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to process bulk restock'
    });
  }
};

export const getRestockHistory = async (req: Request, res: Response) => {
  try {
    const productId = req.query.productId as string;
    const limit = parseInt(req.query.limit as string || '100');
    
    const history = await restockService.getRestockHistory(productId || undefined, limit);
    
    return res.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Restock history error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch restock history'
    });
  }
};

export const getRestockBatches = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '100');
    
    const batches = await restockService.getBatchHistory(limit);
    
    return res.json({
      success: true,
      data: batches
    });

  } catch (error) {
    console.error('Restock batches error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch restock batches'
    });
  }
};