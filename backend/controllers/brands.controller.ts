import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Brand } from '../models/Brand.js';
import { Product } from '../models/Product.js';
import { IUser } from '../models/User.js';

// Request interfaces
interface BrandQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface CreateBrandRequest {
  name: string;
  code?: string;
  description?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  status?: 'active' | 'inactive';
  isExclusive?: boolean;
}

interface UpdateBrandRequest extends Partial<CreateBrandRequest> {
  _id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export const getBrands = async (req: Request<Record<string, never>, Record<string, never>, Record<string, never>, BrandQueryParams>, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      search,
      status,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build query
    interface BrandQuery {
      $or?: Array<
        | { name: { $regex: string; $options: string } }
        | { code: { $regex: string; $options: string } }
        | { description: { $regex: string; $options: string } }
      >;
      status?: string;
      isActive?: boolean;
    }
    
    const query: BrandQuery = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
      if (status === 'active') {
        query.isActive = true;
      }
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const sortOptions: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query
    const brands = await Brand.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);
    
    const total = await Brand.countDocuments(query);

    // Add product count to each brand
    const brandsWithCount = await Promise.all(
      brands.map(async (brand) => {
        const productCount = await Product.countDocuments({ 
          brand: brand._id,
          isActive: true 
        });
        return { ...brand.toObject(), productCount };
      })
    );

    res.json({
      brands: brandsWithCount,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
};

export const getBrandById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid brand ID' });
      return;
    }

    const brand = await Brand.findById(req.params.id);
    
    if (!brand) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }
    
    // Get product count
    const productCount = await Product.countDocuments({ 
      brand: brand._id,
      isActive: true 
    });
    
    res.json({ ...brand.toObject(), productCount });
  } catch (error) {
    console.error('Error fetching brand:', error);
    res.status(500).json({ error: 'Failed to fetch brand' });
  }
};

export const createBrand = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { 
      name, 
      code, 
      description, 
      website, 
      contactEmail, 
      contactPhone,
      status = 'active',
      isExclusive = false
    } = req.body as CreateBrandRequest;
    
    // Check if brand with same name or code exists
    const existingBrand = await Brand.findOne({
      $or: [
        { name: { $regex: `^${name}$`, $options: 'i' } },
        ...(code ? [{ code }] : [])
      ]
    });
    
    if (existingBrand) {
      res.status(400).json({ 
        error: existingBrand.name.toLowerCase() === name.toLowerCase() 
          ? 'Brand with this name already exists' 
          : 'Brand with this code already exists'
      });
      return;
    }
    
    const brand = new Brand({
      name,
      code,
      description,
      website,
      contactEmail,
      contactPhone,
      status,
      isActive: status === 'active',
      isExclusive
    });
    
    await brand.save();
    
    
    res.status(201).json(brand);
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({ error: 'Failed to create brand' });
  }
};

export const updateBrand = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid brand ID' });
      return;
    }

    const updates = { ...req.body } as UpdateBrandRequest;
    
    // Remove fields that shouldn't be updated
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;
    
    // Check if name is being changed and if it conflicts
    if (updates.name) {
      const existingBrand = await Brand.findOne({ 
        name: { $regex: `^${updates.name}$`, $options: 'i' },
        _id: { $ne: req.params.id }
      });
      
      if (existingBrand) {
        res.status(400).json({ error: 'Brand with this name already exists' });
        return;
      }
    }
    
    // Check if code is being changed and if it conflicts
    if (updates.code) {
      const existingBrand = await Brand.findOne({ 
        code: updates.code,
        _id: { $ne: req.params.id }
      });
      
      if (existingBrand) {
        res.status(400).json({ error: 'Brand with this code already exists' });
        return;
      }
    }
    
    // Update isActive based on status
    const updatedFields = { ...updates } as typeof updates & { isActive?: boolean };
    if (updates.status !== undefined) {
      updatedFields.isActive = updates.status === 'active';
    }
    
    const brand = await Brand.findByIdAndUpdate(
      req.params.id,
      updatedFields,
      { new: true, runValidators: true }
    );
    
    if (!brand) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }
    
    // Log activity
    if (req.user) {
      console.log(`Brand updated by ${req.user.email}: ${brand.name}`);
    }
    
    res.json(brand);
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({ error: 'Failed to update brand' });
  }
};

export const deleteBrand = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid brand ID' });
      return;
    }

    // Check if brand has products
    const productCount = await Product.countDocuments({ brand: req.params.id });
    
    if (productCount > 0) {
      res.status(400).json({ 
        error: `Cannot delete brand. ${productCount} products are using this brand.` 
      });
      return;
    }
    
    const brand = await Brand.findByIdAndDelete(req.params.id);
    
    if (!brand) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }
    
    // Log activity
    if (req.user) {
      console.log(`Brand deleted by ${req.user.email}: ${brand.name}`);
    }
    
    res.json({ message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({ error: 'Failed to delete brand' });
  }
};