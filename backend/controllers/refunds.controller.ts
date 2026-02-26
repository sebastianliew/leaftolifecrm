import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { RefundService } from '../services/RefundService.js';
import { Refund } from '../models/Refund.js';
import { IUser } from '../models/User.js';
import { asyncHandler, ValidationError } from '../middlewares/errorHandler.middleware.js';

function validateId(id: string, label = 'ID') {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError(`Invalid ${label}`);
}

interface AuthenticatedRequest extends Request { user?: IUser; }

function getUserId(req: Request): string {
  return (req as AuthenticatedRequest).user?._id?.toString() || 'system';
}

export const getRefunds = asyncHandler(async (req: Request, res: Response) => {
  const { status, customerId, startDate, endDate, refundReason, page = '1', limit = '20' } = req.query as Record<string, string>;

  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (customerId) filters.customerId = customerId;
  if (refundReason) filters.refundReason = refundReason;
  if (startDate) filters.startDate = new Date(startDate);
  if (endDate) filters.endDate = new Date(endDate);

  const refunds = await RefundService.getRefunds(filters);

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const start = (pageNum - 1) * limitNum;

  res.json({
    refunds: refunds.slice(start, start + limitNum),
    pagination: { page: pageNum, limit: limitNum, total: refunds.length, pages: Math.ceil(refunds.length / limitNum) }
  });
});

export const getRefundById = asyncHandler(async (req: Request, res: Response) => {
  validateId(req.params.id, 'refund ID');
  const refund = await RefundService.getRefundById(req.params.id);
  if (!refund) throw new ValidationError('Refund not found');
  res.json(refund);
});

export const createRefund = asyncHandler(async (req: Request, res: Response) => {
  const { transactionId, ...refundData } = req.body;
  const refund = await RefundService.createRefund(transactionId, { ...refundData, createdBy: getUserId(req) });
  res.status(201).json(refund);
});

export const approveRefund = asyncHandler(async (req: Request, res: Response) => {
  res.json(await RefundService.approveRefund(req.params.id, getUserId(req), req.body.approvalNotes));
});

export const rejectRefund = asyncHandler(async (req: Request, res: Response) => {
  if (!req.body.rejectionReason) throw new ValidationError('Rejection reason is required');
  res.json(await RefundService.rejectRefund(req.params.id, getUserId(req), req.body.rejectionReason));
});

export const processRefund = asyncHandler(async (req: Request, res: Response) => {
  res.json(await RefundService.processRefund(req.params.id, getUserId(req)));
});

export const completeRefund = asyncHandler(async (req: Request, res: Response) => {
  res.json(await RefundService.completeRefund(req.params.id, getUserId(req), req.body.paymentDetails));
});

export const cancelRefund = asyncHandler(async (req: Request, res: Response) => {
  if (!req.body.reason) throw new ValidationError('Cancellation reason is required');
  res.json(await RefundService.cancelRefund(req.params.id, getUserId(req), req.body.reason));
});

export const getTransactionRefunds = asyncHandler(async (req: Request, res: Response) => {
  res.json(await RefundService.getTransactionRefunds(req.params.transactionId));
});

export const getRefundEligibility = asyncHandler(async (req: Request, res: Response) => {
  res.json(await RefundService.calculateRefundEligibility(req.params.transactionId));
});

export const getRefundStatistics = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as Record<string, string>;
  res.json(await Refund.getRefundStatistics(
    startDate ? new Date(startDate) : undefined,
    endDate ? new Date(endDate) : undefined
  ));
});
