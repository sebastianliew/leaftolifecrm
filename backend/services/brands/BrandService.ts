import { Brand, IBrand } from '../../models/Brand.js';
import type { 
  BrandDTO, 
  CreateBrandDTO, 
  UpdateBrandDTO, 
  BrandFilters 
} from '../../types/brands/brand.types';
import connectDB from '../../lib/mongodb.js';
import mongoose from 'mongoose';

export class BrandService {
  /**
   * Transform MongoDB document to DTO
   */
  private static transformToDTO(brand: IBrand & { _id: string }): BrandDTO {
    const doc = brand.toObject();
    return {
      ...doc,
      id: brand._id.toString(),
      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString(),
      categories: doc.categories || [],
      qualityStandards: doc.qualityStandards || [],
      _id: undefined
    } as BrandDTO;
  }

  /**
   * Get all brands with optional filters
   */
  static async getAllBrands(filters?: BrandFilters): Promise<BrandDTO[]> {
    await connectDB();
    
    interface BrandQuery {
      name?: { $regex: string; $options: string };
      status?: string;
      isActive?: boolean;
      isExclusive?: boolean;
      $or?: Array<
        | { name: { $regex: string; $options: string } }
        | { code: { $regex: string; $options: string } }
        | { description: { $regex: string; $options: string } }
      >;
    }
    
    const query: BrandQuery = {};
    
    if (filters) {
      if (filters.status !== undefined) {
        query.status = filters.status;
      }
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      if (filters.isExclusive !== undefined) {
        query.isExclusive = filters.isExclusive;
      }
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { code: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }
    }
    
    const brands = await Brand.find(query).sort({ createdAt: -1 });
    return brands.map(this.transformToDTO);
  }

  /**
   * Get brand by ID
   */
  static async getBrandById(id: string): Promise<BrandDTO | null> {
    await connectDB();
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid brand ID');
    }
    
    const brand = await Brand.findById(id);
    
    if (!brand) {
      return null;
    }
    
    return this.transformToDTO(brand);
  }

  /**
   * Create a new brand
   */
  static async createBrand(data: CreateBrandDTO): Promise<BrandDTO> {
    await connectDB();
    
    const brandData = {
      name: data.name,
      description: data.description || '',
      website: data.website || '',
      contactEmail: data.contactEmail || '',
      contactPhone: data.contactPhone || '',
      categories: data.categories || [],
      qualityStandards: data.qualityStandards || [],
      status: data.status || 'active',
      isActive: data.isActive !== undefined ? data.isActive : true,
      isExclusive: data.isExclusive || false,
      createdBy: data.createdBy || 'system'
    };
    
    const brand = await Brand.create(brandData);
    return this.transformToDTO(brand);
  }

  /**
   * Update a brand
   */
  static async updateBrand(id: string, data: UpdateBrandDTO): Promise<BrandDTO | null> {
    await connectDB();
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid brand ID');
    }
    
    // Filter out undefined values
    const updateData: Partial<UpdateBrandDTO> = {};
    Object.keys(data).forEach(key => {
      const typedKey = key as keyof UpdateBrandDTO;
      if (data[typedKey] !== undefined) {
        (updateData as Record<string, unknown>)[key] = data[typedKey];
      }
    });
    
    // Add last modified info
    updateData.lastModifiedBy = data.lastModifiedBy || 'system';
    
    const brand = await Brand.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!brand) {
      return null;
    }
    
    return this.transformToDTO(brand);
  }

  /**
   * Delete a brand
   */
  static async deleteBrand(id: string): Promise<boolean> {
    await connectDB();
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid brand ID');
    }
    
    const result = await Brand.findByIdAndDelete(id);
    return !!result;
  }

  /**
   * Check if brand exists by name
   */
  static async brandExistsByName(name: string, excludeId?: string): Promise<boolean> {
    await connectDB();
    
    const query: { name: { $regex: string; $options: string }; _id?: { $ne: string } } = { 
      name: { $regex: `^${name}$`, $options: 'i' } 
    };
    
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    
    const count = await Brand.countDocuments(query);
    return count > 0;
  }

  /**
   * Get brands by category
   */
  static async getBrandsByCategory(categoryId: string): Promise<BrandDTO[]> {
    await connectDB();
    
    const brands = await Brand.find({
      'categories.id': categoryId,
      isActive: true
    }).sort({ name: 1 });
    
    return brands.map(this.transformToDTO);
  }

  /**
   * Get active brands count
   */
  static async getActiveBrandsCount(): Promise<number> {
    await connectDB();
    return await Brand.countDocuments({ isActive: true });
  }

  /**
   * Get brands statistics
   */
  static async getBrandStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    exclusive: number;
    byStatus: Record<string, number>;
  }> {
    await connectDB();
    
    const [
      total,
      active,
      inactive,
      exclusive,
      statusCounts
    ] = await Promise.all([
      Brand.countDocuments({}),
      Brand.countDocuments({ isActive: true }),
      Brand.countDocuments({ isActive: false }),
      Brand.countDocuments({ isExclusive: true }),
      Brand.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);
    
    const byStatus = statusCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total,
      active,
      inactive,
      exclusive,
      byStatus
    };
  }
}