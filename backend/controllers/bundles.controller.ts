import { Request, Response } from 'express';
import { Bundle } from '../models/Bundle.js';
import { Product } from '../models/Product.js';
import { BlendTemplate } from '../models/BlendTemplate.js';
import { IUser } from '../models/User.js';

// Request interfaces
interface BundleQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  category?: string;
  isActive?: string;
  isPromoted?: string;
  minPrice?: string;
  maxPrice?: string;
  minSavings?: string;
  tags?: string;
}

interface BundleProduct {
  productId: string;
  name: string;
  quantity: number;
  individualPrice: number;
  totalPrice: number;
  productType?: string;
  blendTemplateId?: string;
}

interface CreateBundleRequest {
  name: string;
  description?: string;
  category?: string;
  bundleProducts: BundleProduct[];
  bundlePrice: number;
  isActive?: boolean;
  isPromoted?: boolean;
  promotionText?: string;
  tags?: string[];
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  availableQuantity?: number;
  maxQuantity?: number;
  reorderPoint?: number;
}

interface UpdateBundleRequest extends Partial<CreateBundleRequest> {
  _id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastModifiedBy?: string;
}

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export const getBundles = async (
  req: Request<Record<string, never>, Record<string, never>, Record<string, never>, BundleQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const { 
      page = '1', 
      limit = '20', 
      search, 
      sortBy = 'name', 
      sortOrder = 'asc',
      category,
      isActive,
      isPromoted,
      minPrice,
      maxPrice,
      minSavings,
      tags
    } = req.query;
    
    // Build query
    interface BundleQuery {
      $or?: Array<
        | { name: { $regex: string; $options: string } }
        | { description: { $regex: string; $options: string } }
        | { category: { $regex: string; $options: string } }
      >;
      category?: { $regex: string; $options: string };
      isActive?: boolean;
      isPromoted?: boolean;
      bundlePrice?: { $gte?: number; $lte?: number };
      savingsPercentage?: { $gte?: number };
      tags?: { $in: string[] };
    }
    
    const query: BundleQuery = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (isPromoted !== undefined) {
      query.isPromoted = isPromoted === 'true';
    }
    
    if (minPrice || maxPrice) {
      query.bundlePrice = {};
      if (minPrice) query.bundlePrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.bundlePrice.$lte = parseFloat(maxPrice);
    }
    
    if (minSavings) {
      query.savingsPercentage = { $gte: parseFloat(minSavings) };
    }
    
    if (tags) {
      query.tags = { $in: tags.split(',') };
    }
    
    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Execute query - removed problematic createdBy populate for now
    const [bundles, total] = await Promise.all([
      Bundle.find(query)
        .populate('bundleProducts.productId', 'name sku availableStock')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Bundle.countDocuments(query)
    ]);
    
    res.json({
      bundles,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching bundles:', error);
    res.status(500).json({ error: 'Failed to fetch bundles' });
  }
};

export const getBundleById = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const bundle = await Bundle.findById(req.params.id)
      .populate('bundleProducts.productId', 'name sku availableStock sellingPrice')
      .lean();
    
    if (!bundle) {
      res.status(404).json({ error: 'Bundle not found' });
      return;
    }
    
    res.json(bundle);
  } catch (error) {
    console.error('Error fetching bundle:', error);
    res.status(500).json({ error: 'Failed to fetch bundle' });
  }
};

export const createBundle = async (
  req: Request<Record<string, never>, Record<string, never>, CreateBundleRequest>,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Authentication is required - user must be logged in
    if (!authReq.user) {
      res.status(401).json({ error: 'User authentication required' });
      return;
    }
    
    const userId = authReq.user.id;
    
    const bundleData = req.body;
    
    console.log(`Creating bundle with data by user ${authReq.user.email} (${userId}):`, JSON.stringify(bundleData, null, 2));
    
    // Validate basic required fields
    if (!bundleData.name || !bundleData.bundleProducts || !bundleData.bundlePrice) {
      res.status(400).json({ error: 'Missing required fields: name, bundleProducts, or bundlePrice' });
      return;
    }
    
    // Calculate pricing and add missing required fields
    let individualTotalPrice = 0;
    
    // Validate bundle products and calculate totals
    for (const bundleProduct of bundleData.bundleProducts) {
      console.log('Validating product:', bundleProduct.productId, 'Type:', bundleProduct.productType);
      
      let item = null;
      
      if (bundleProduct.productType === 'fixed_blend' || bundleProduct.blendTemplateId) {
        // Check if it's a blend template
        item = await BlendTemplate.findById(bundleProduct.productId);
        if (!item) {
          console.error(`Blend template not found: ${bundleProduct.productId}`);
          res.status(400).json({ error: `Blend template with ID ${bundleProduct.productId} not found` });
          return;
        }
      } else {
        // Check if it's a regular product
        item = await Product.findById(bundleProduct.productId);
        if (!item) {
          console.error(`Product not found: ${bundleProduct.productId}`);
          res.status(400).json({ error: `Product with ID ${bundleProduct.productId} not found` });
          return;
        }
      }
      
      // Update product name from database
      bundleProduct.name = item.name;
      bundleProduct.totalPrice = bundleProduct.quantity * bundleProduct.individualPrice;
      individualTotalPrice += bundleProduct.totalPrice;
    }
    
    // Calculate savings
    const savings = Math.max(0, individualTotalPrice - bundleData.bundlePrice);
    const savingsPercentage = individualTotalPrice > 0 
      ? Math.round((savings / individualTotalPrice) * 100) 
      : 0;
    
    // Generate SKU
    const sku = `BDL-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    const bundle = new Bundle({
      ...bundleData,
      sku,
      individualTotalPrice,
      savings,
      savingsPercentage,
      currency: 'SGD',
      createdBy: userId
    });
    
    await bundle.save();
    
    // Update availability after creation
    await bundle.updateAvailability();
    
    // Populate for response - skip createdBy populate to avoid ObjectId casting errors
    await bundle.populate('bundleProducts.productId', 'name sku availableStock');
    
    res.status(201).json(bundle);
  } catch (error) {
    console.error('Error creating bundle:', error);
    res.status(500).json({ error: 'Failed to create bundle' });
  }
};

export const updateBundle = async (
  req: Request<{ id: string }, Record<string, never>, UpdateBundleRequest>,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const updates = req.body;
    
    // Validate bundle products if being updated
    if (updates.bundleProducts) {
      for (const bundleProduct of updates.bundleProducts) {
        let item = null;
        
        if (bundleProduct.productType === 'fixed_blend' || bundleProduct.blendTemplateId) {
          // Check if it's a blend template
          item = await BlendTemplate.findById(bundleProduct.productId);
          if (!item) {
            res.status(400).json({ error: `Blend template with ID ${bundleProduct.productId} not found` });
            return;
          }
        } else {
          // Check if it's a regular product
          item = await Product.findById(bundleProduct.productId);
          if (!item) {
            res.status(400).json({ error: `Product with ID ${bundleProduct.productId} not found` });
            return;
          }
        }
        
        // Update product name from database
        bundleProduct.name = item.name;
      }
    }
    
    const bundle = await Bundle.findByIdAndUpdate(
      req.params.id,
      { 
        ...updates, 
        lastModifiedBy: authReq.user.id 
      },
      { new: true, runValidators: true }
    );
    
    if (!bundle) {
      res.status(404).json({ error: 'Bundle not found' });
      return;
    }
    
    // Update availability after modification
    await bundle.updateAvailability();
    
    // Populate for response - skip user populates to avoid ObjectId casting errors
    await bundle.populate('bundleProducts.productId', 'name sku availableStock');
    
    console.log(`Bundle updated by ${authReq.user.email}: ${bundle.name}`);
    
    res.json(bundle);
  } catch (error) {
    console.error('Error updating bundle:', error);
    res.status(500).json({ error: 'Failed to update bundle' });
  }
};

export const deleteBundle = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const bundle = await Bundle.findByIdAndDelete(req.params.id);
    
    if (!bundle) {
      res.status(404).json({ error: 'Bundle not found' });
      return;
    }
    
    console.log(`Bundle deleted by ${authReq.user.email}: ${bundle.name}`);
    
    res.json({ message: 'Bundle deleted successfully' });
  } catch (error) {
    console.error('Error deleting bundle:', error);
    res.status(500).json({ error: 'Failed to delete bundle' });
  }
};

export const getBundleCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const categories = await Bundle.distinct('category', { category: { $nin: [null, ''] } });
    res.json({ categories: categories.filter(cat => cat) });
  } catch (error) {
    console.error('Error fetching bundle categories:', error);
    res.status(500).json({ error: 'Failed to fetch bundle categories' });
  }
};

export const getPopularBundles = async (
  req: Request<Record<string, never>, Record<string, never>, Record<string, never>, { limit?: string }>,
  res: Response
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit || '10');
    
    const bundles = await Bundle.find({ isActive: true })
      .populate('bundleProducts.productId', 'name sku')
      .sort({ savingsPercentage: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    
    res.json({ bundles });
  } catch (error) {
    console.error('Error fetching popular bundles:', error);
    res.status(500).json({ error: 'Failed to fetch popular bundles' });
  }
};

export const getPromotedBundles = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const bundles = await Bundle.find({ isActive: true, isPromoted: true })
      .populate('bundleProducts.productId', 'name sku')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({ bundles });
  } catch (error) {
    console.error('Error fetching promoted bundles:', error);
    res.status(500).json({ error: 'Failed to fetch promoted bundles' });
  }
};

export const getBundleStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const [total, active, promoted, totalValue] = await Promise.all([
      Bundle.countDocuments({}),
      Bundle.countDocuments({ isActive: true }),
      Bundle.countDocuments({ isPromoted: true }),
      Bundle.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: '$bundlePrice' } } }
      ])
    ]);
    
    res.json({
      stats: {
        total,
        active,
        promoted,
        totalValue: totalValue[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Error fetching bundle stats:', error);
    res.status(500).json({ error: 'Failed to fetch bundle stats' });
  }
};

export const checkBundleAvailability = async (
  req: Request<{ id: string }, Record<string, never>, Record<string, never>, { quantity?: string }>,
  res: Response
): Promise<void> => {
  try {
    const quantity = parseInt(req.query.quantity || '1');
    
    const bundle = await Bundle.findById(req.params.id);
    if (!bundle) {
      res.status(404).json({ error: 'Bundle not found' });
      return;
    }
    
    const availability = await bundle.checkAvailability(quantity);
    res.json(availability);
  } catch (error) {
    console.error('Error checking bundle availability:', error);
    res.status(500).json({ error: 'Failed to check bundle availability' });
  }
};

export const calculateBundlePricing = async (
  req: Request<Record<string, never>, Record<string, never>, { bundleProducts: BundleProduct[]; bundlePrice: number }>,
  res: Response
): Promise<void> => {
  try {
    const { bundleProducts, bundlePrice } = req.body;
    
    if (!bundleProducts || !bundleProducts.length) {
      res.status(400).json({ error: 'Bundle products are required' });
      return;
    }
    
    let individualTotalPrice = 0;
    
    for (const bundleProduct of bundleProducts) {
      let item = null;
      
      if (bundleProduct.productType === 'fixed_blend' || bundleProduct.blendTemplateId) {
        // Check if it's a blend template
        item = await BlendTemplate.findById(bundleProduct.productId);
        if (!item) {
          res.status(400).json({ error: `Blend template with ID ${bundleProduct.productId} not found` });
          return;
        }
      } else {
        // Check if it's a regular product
        item = await Product.findById(bundleProduct.productId);
        if (!item) {
          res.status(400).json({ error: `Product with ID ${bundleProduct.productId} not found` });
          return;
        }
      }
      
      const itemTotal = bundleProduct.quantity * (bundleProduct.individualPrice || item.sellingPrice || 0);
      individualTotalPrice += itemTotal;
    }
    
    const savings = Math.max(0, individualTotalPrice - bundlePrice);
    const savingsPercentage = individualTotalPrice > 0 
      ? Math.round((savings / individualTotalPrice) * 100) 
      : 0;
    
    res.json({
      bundlePrice,
      individualTotalPrice,
      savings,
      savingsPercentage,
      currency: 'SGD'
    });
  } catch (error) {
    console.error('Error calculating bundle pricing:', error);
    res.status(500).json({ error: 'Failed to calculate bundle pricing' });
  }
};