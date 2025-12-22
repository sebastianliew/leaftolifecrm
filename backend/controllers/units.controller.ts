import { Request, Response } from 'express';
import { UnitOfMeasurement, IUnitOfMeasurement } from '../models/UnitOfMeasurement.js';

// Request interfaces
interface UnitQueryParams {
  isActive?: string;
}

interface CreateUnitRequest {
  name: string;
  abbreviation: string;
  type?: 'weight' | 'volume' | 'count' | 'other';
  description?: string;
  isActive?: boolean;
  baseUnit?: string;
  conversionRate?: number;
}

interface UpdateUnitRequest extends Partial<CreateUnitRequest> {
  _id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const getUnits = async (
  req: Request<Record<string, never>, Record<string, never>, Record<string, never>, UnitQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const { isActive } = req.query;
    
    interface UnitFilter {
      isActive?: boolean;
    }
    
    const filter: UnitFilter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    const units = await UnitOfMeasurement.find(filter).sort({ name: 1 });
    res.json(units);
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
};

export const getUnitById = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const unit = await UnitOfMeasurement.findById(req.params.id);
    
    if (!unit) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }
    
    res.json(unit);
  } catch (error) {
    console.error('Error fetching unit:', error);
    res.status(500).json({ error: 'Failed to fetch unit' });
  }
};

export const createUnit = async (
  req: Request<Record<string, never>, Record<string, never>, CreateUnitRequest>,
  res: Response
): Promise<void> => {
  try {
    const { name, abbreviation, type, description, isActive, baseUnit, conversionRate } = req.body;
    
    // Check if unit with same abbreviation exists
    const existingUnit = await UnitOfMeasurement.findOne({ abbreviation });
    if (existingUnit) {
      res.status(400).json({ error: 'Unit with this abbreviation already exists' });
      return;
    }
    
    const unit = new UnitOfMeasurement({
      name,
      abbreviation,
      type,
      description,
      isActive: isActive !== false,
      baseUnit,
      conversionRate
    });
    
    await unit.save();
    res.status(201).json(unit);
  } catch (error) {
    console.error('Error creating unit:', error);
    res.status(500).json({ error: 'Failed to create unit' });
  }
};

export const updateUnit = async (
  req: Request<{ id: string }, Record<string, never>, UpdateUnitRequest>,
  res: Response
): Promise<void> => {
  try {
    const { name, abbreviation, type, description, isActive, baseUnit, conversionRate } = req.body;
    
    // Check if abbreviation is being changed and if it conflicts
    if (abbreviation) {
      const existingUnit = await UnitOfMeasurement.findOne({ 
        abbreviation, 
        _id: { $ne: req.params.id } 
      });
      if (existingUnit) {
        res.status(400).json({ error: 'Unit with this abbreviation already exists' });
        return;
      }
    }
    
    const updates: Partial<IUnitOfMeasurement> = {};
    
    // Only add fields that are defined
    if (name !== undefined) updates.name = name;
    if (abbreviation !== undefined) updates.abbreviation = abbreviation;
    if (type !== undefined) updates.type = type;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;
    if (baseUnit !== undefined) updates.baseUnit = baseUnit;
    if (conversionRate !== undefined) updates.conversionRate = conversionRate;
    
    const unit = await UnitOfMeasurement.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!unit) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }
    
    res.json(unit);
  } catch (error) {
    console.error('Error updating unit:', error);
    res.status(500).json({ error: 'Failed to update unit' });
  }
};

export const deleteUnit = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    // You might want to check if the unit is in use before deleting
    // For now, we'll just delete it
    const unit = await UnitOfMeasurement.findByIdAndDelete(req.params.id);
    
    if (!unit) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }
    
    res.json({ message: 'Unit deleted successfully' });
  } catch (error) {
    console.error('Error deleting unit:', error);
    res.status(500).json({ error: 'Failed to delete unit' });
  }
};