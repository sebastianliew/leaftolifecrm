import { Request, Response } from 'express';
import { Category, ICategory } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { IUser } from '../models/User.js';

// Request interfaces
interface CategoryQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isActive?: string;
}

interface CreateCategoryRequest {
  name: string;
  description?: string;
  level?: number;
  isActive?: boolean;
}

interface UpdateCategoryRequest extends Partial<CreateCategoryRequest> {
  _id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

interface CategoryWithCount extends ICategory {
  productCount: number;
}

export const getCategories = async (
  req: Request<Record<string, never>, Record<string, never>, Record<string, never>, CategoryQueryParams>,
  res: Response
): Promise<void> => {
  try {
    // console.log('🏷️ GET /api/inventory/categories endpoint hit');
    const { 
      page = '1', 
      limit = '10', 
      search, 
      sortBy = 'name', 
      sortOrder = 'asc',
      isActive 
    } = req.query;
    // console.log('🔍 Categories query params:', { page, limit, search, sortBy, sortOrder, isActive });
    
    // Build query
    interface CategoryQuery {
      $or?: Array<
        | { name: { $regex: string; $options: string } }
        | { description: { $regex: string; $options: string } }
      >;
      isActive?: boolean;
    }
    
    const query: CategoryQuery = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Execute query with product counts in a single aggregation (eliminates N+1)
    const [categories, total, productCounts] = await Promise.all([
      Category.find(query)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limitNum)
        .lean<ICategory[]>(),
      Category.countDocuments(query),
      // Get all product counts in one query using aggregation
      Product.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ])
    ]);

    // Build a map of category ID -> product count for O(1) lookup
    const countMap = new Map<string, number>();
    for (const item of productCounts) {
      if (item._id) {
        countMap.set(item._id.toString(), item.count);
      }
    }

    // Add product count to each category using the map (no additional DB queries)
    const categoriesWithCount: CategoryWithCount[] = categories.map(category => {
      const categoryId = (category._id as string).toString();
      const productCount = countMap.get(categoryId) || 0;
      return { ...category, productCount } as unknown as CategoryWithCount;
    });
    
    const response = {
      categories: categoriesWithCount,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    };
    // console.log('✅ Categories response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const getCategoryById = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id).lean<ICategory>();
    
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    // Get product count
    const productCount = await Product.countDocuments({ 
      category: category._id as string,
      isActive: true 
    });
    
    const categoryWithCount: CategoryWithCount = { ...category, productCount } as unknown as CategoryWithCount;
    
    res.json(categoryWithCount);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
};

export const createCategory = async (
  req: Request<Record<string, never>, Record<string, never>, CreateCategoryRequest>,
  res: Response
): Promise<void> => {
  try {
    const { name, description, level = 1, isActive = true } = req.body;
    
    // Check if category with same name exists
    const existingCategory = await Category.findOne({ 
      name: { $regex: `^${name}$`, $options: 'i' } 
    });
    
    if (existingCategory) {
      res.status(400).json({ error: 'Category with this name already exists' });
      return;
    }
    
    const category = new Category({
      name,
      description,
      level,
      isActive
    });
    
    await category.save();
    
    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateCategory = async (
  req: Request<{ id: string }, Record<string, never>, UpdateCategoryRequest>,
  res: Response
): Promise<void> => {
  try {
    const { name, description, level, isActive } = req.body;
    const updates: Partial<ICategory> = {};
    
    // Build update object with only provided fields
    if (name !== undefined) {
      // Check if name is being changed and if it conflicts
      const existingCategory = await Category.findOne({ 
        name: { $regex: `^${name}$`, $options: 'i' },
        _id: { $ne: req.params.id }
      });
      
      if (existingCategory) {
        res.status(400).json({ error: 'Category with this name already exists' });
        return;
      }
      
      updates.name = name;
    }
    
    if (description !== undefined) updates.description = description;
    if (level !== undefined) updates.level = level;
    if (isActive !== undefined) updates.isActive = isActive;
    
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    // Log activity
    const authReq = req as AuthenticatedRequest;
    if (authReq.user) {
      console.log(`Category updated by ${authReq.user.email}: ${category.name}`);
    }
    
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const deleteCategory = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    // Check if category has products
    const productCount = await Product.countDocuments({ category: req.params.id });
    
    if (productCount > 0) {
      res.status(400).json({ 
        error: `Cannot delete category. ${productCount} products are using this category.` 
      });
      return;
    }
    
    const category = await Category.findByIdAndDelete(req.params.id);
    
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    // Log activity
    const authReq = req as AuthenticatedRequest;
    if (authReq.user) {
      console.log(`Category deleted by ${authReq.user.email}: ${category.name}`);
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};