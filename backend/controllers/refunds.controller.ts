import { Request, Response } from 'express';
import { RefundService } from '../services/RefundService.js';
import { Refund } from '../models/Refund.js';
import { IUser } from '../models/User.js';

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

interface RefundQueryParams {
  status?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  refundReason?: string;
  page?: string;
  limit?: string;
}

// GET /api/refunds - Get all refunds with optional filters
export const getRefunds = async (req: Request<Record<string, never>, Record<string, never>, Record<string, never>, RefundQueryParams>, res: Response): Promise<void> => {
  try {
    const {
      status,
      customerId,
      startDate,
      endDate,
      refundReason,
      page = 1,
      limit = 20
    } = req.query;

    interface RefundFilters {
      status?: string;
      customerId?: string;
      refundReason?: string;
      startDate?: Date;
      endDate?: Date;
    }
    
    const filters: RefundFilters = {};
    
    if (status) filters.status = status;
    if (customerId) filters.customerId = customerId;
    if (refundReason) filters.refundReason = refundReason;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const refunds = await RefundService.getRefunds(filters);
    
    // Basic pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedRefunds = refunds.slice(startIndex, endIndex);

    res.json({
      refunds: paginatedRefunds,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: refunds.length,
        pages: Math.ceil(refunds.length / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching refunds:', error);
    res.status(500).json({ 
      error: 'Failed to fetch refunds',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// GET /api/refunds/:id - Get refund by ID
export const getRefundById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const refund = await RefundService.getRefundById(id);
    
    if (!refund) {
      res.status(404).json({ error: 'Refund not found' });
      return;
    }

    res.json(refund);
  } catch (error) {
    console.error('Error fetching refund:', error);
    res.status(500).json({ 
      error: 'Failed to fetch refund',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// POST /api/refunds - Create new refund
export const createRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId, ...refundData } = req.body;
    const userId = (req as AuthenticatedRequest).user?._id?.toString() || 'system';

    const refund = await RefundService.createRefund(transactionId, {
      ...refundData,
      createdBy: userId
    });

    res.status(201).json(refund);
  } catch (error) {
    console.error('Error creating refund:', error);
    res.status(400).json({ 
      error: 'Failed to create refund',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// PUT /api/refunds/:id/approve - Approve refund
export const approveRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { approvalNotes } = req.body;
    const userId = (req as AuthenticatedRequest).user?._id?.toString() || 'system';

    const refund = await RefundService.approveRefund(id, userId, approvalNotes);
    
    res.json(refund);
  } catch (error) {
    console.error('Error approving refund:', error);
    res.status(400).json({ 
      error: 'Failed to approve refund',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// PUT /api/refunds/:id/reject - Reject refund
export const rejectRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const userId = (req as AuthenticatedRequest).user?._id?.toString() || 'system';

    if (!rejectionReason) {
      res.status(400).json({ error: 'Rejection reason is required' });
      return;
    }

    const refund = await RefundService.rejectRefund(id, userId, rejectionReason);
    
    res.json(refund);
  } catch (error) {
    console.error('Error rejecting refund:', error);
    res.status(400).json({ 
      error: 'Failed to reject refund',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// PUT /api/refunds/:id/process - Process refund (handle inventory)
export const processRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).user?._id?.toString() || 'system';

    const refund = await RefundService.processRefund(id, userId);
    
    res.json(refund);
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(400).json({ 
      error: 'Failed to process refund',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// PUT /api/refunds/:id/complete - Complete refund (finalize payment)
export const completeRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { paymentDetails } = req.body;
    const userId = (req as AuthenticatedRequest).user?._id?.toString() || 'system';

    const refund = await RefundService.completeRefund(id, userId, paymentDetails);
    
    res.json(refund);
  } catch (error) {
    console.error('Error completing refund:', error);
    res.status(400).json({ 
      error: 'Failed to complete refund',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// PUT /api/refunds/:id/cancel - Cancel refund
export const cancelRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as AuthenticatedRequest).user?._id?.toString() || 'system';

    if (!reason) {
      res.status(400).json({ error: 'Cancellation reason is required' });
      return;
    }

    const refund = await RefundService.cancelRefund(id, userId, reason);
    
    res.json(refund);
  } catch (error) {
    console.error('Error cancelling refund:', error);
    res.status(400).json({ 
      error: 'Failed to cancel refund',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// GET /api/refunds/transaction/:transactionId - Get refunds for a transaction
export const getTransactionRefunds = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.params;
    const refunds = await RefundService.getTransactionRefunds(transactionId);
    
    res.json(refunds);
  } catch (error) {
    console.error('Error fetching transaction refunds:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transaction refunds',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// GET /api/refunds/eligibility/:transactionId - Check refund eligibility for transaction
export const getRefundEligibility = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.params;
    const eligibility = await RefundService.calculateRefundEligibility(transactionId);
    
    res.json(eligibility);
  } catch (error) {
    console.error('Error checking refund eligibility:', error);
    res.status(500).json({ 
      error: 'Failed to check refund eligibility',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// GET /api/refunds/statistics - Get refund statistics
export const getRefundStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const statistics = await Refund.getRefundStatistics(start, end);
    
    res.json(statistics);
  } catch (error) {
    console.error('Error fetching refund statistics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch refund statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};