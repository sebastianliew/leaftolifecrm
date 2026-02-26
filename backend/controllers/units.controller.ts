import { Request, Response } from 'express';
import { UnitOfMeasurement } from '../models/UnitOfMeasurement.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middlewares/errorHandler.middleware.js';

export const getUnits = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = {};
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const units = await UnitOfMeasurement.find(filter).sort({ name: 1 });
  res.json(units);
});

export const getUnitById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const unit = await UnitOfMeasurement.findById(req.params.id);
  if (!unit) throw new NotFoundError('Unit', req.params.id);
  res.json(unit);
});

export const createUnit = asyncHandler(async (req: Request, res: Response) => {
  const { name, abbreviation, type, description, isActive, baseUnit, conversionRate } = req.body;

  const existing = await UnitOfMeasurement.findOne({ abbreviation });
  if (existing) throw new ValidationError('Unit with this abbreviation already exists');

  const unit = new UnitOfMeasurement({
    name, abbreviation, type, description, isActive: isActive !== false, baseUnit, conversionRate
  });
  await unit.save();
  res.status(201).json(unit);
});

export const updateUnit = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const { abbreviation } = req.body;

  if (abbreviation) {
    const existing = await UnitOfMeasurement.findOne({ abbreviation, _id: { $ne: req.params.id } });
    if (existing) throw new ValidationError('Unit with this abbreviation already exists');
  }

  // Only include defined fields
  const updates: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(req.body)) {
    if (val !== undefined && !['_id', 'createdAt', 'updatedAt'].includes(key)) {
      updates[key] = val;
    }
  }

  const unit = await UnitOfMeasurement.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!unit) throw new NotFoundError('Unit', req.params.id);
  res.json(unit);
});

export const deleteUnit = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const unit = await UnitOfMeasurement.findByIdAndDelete(req.params.id);
  if (!unit) throw new NotFoundError('Unit', req.params.id);
  res.json({ message: 'Unit deleted successfully' });
});
