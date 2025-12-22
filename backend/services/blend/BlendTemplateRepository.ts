import { BlendTemplate } from '../../models/BlendTemplate.js';
import { UnitOfMeasurement } from '../../models/UnitOfMeasurement.js';
import { connectDB } from '../../lib/mongoose.js';
import type { 
  BlendTemplate as IBlendTemplate,
  CreateBlendTemplateData, 
  UpdateBlendTemplateData, 
  TemplateFilters
} from '../../types/blend.js';

type MongoQuery = {
  isActive?: boolean;
  $or?: Array<{ [key: string]: { $regex: string; $options: string } }>;
  [key: string]: unknown;
};

/**
 * Repository for data access operations on blend templates
 * Single Responsibility: Database operations for blend templates
 */
export class BlendTemplateRepository {
  
  async create(data: CreateBlendTemplateData): Promise<IBlendTemplate> {
    await connectDB();
    
    const template = new BlendTemplate(data);
    await template.save();
    
    return this.findByIdWithPopulation(template._id.toString());
  }
  
  async findById(id: string): Promise<IBlendTemplate | null> {
    await connectDB();
    
    const template = await BlendTemplate.findById(id);
    return template ? template.toJSON() as IBlendTemplate : null;
  }
  
  async findByIdWithPopulation(id: string): Promise<IBlendTemplate> {
    await connectDB();
    
    const template = await BlendTemplate.findById(id)
      .populate('ingredients.productId')
      .populate('ingredients.unitOfMeasurementId')
      .populate('unitOfMeasurementId');
      
    if (!template) {
      throw new Error('Blend template not found');
    }
    
    return template.toJSON() as IBlendTemplate;
  }
  
  async findAll(filters: TemplateFilters = {}): Promise<IBlendTemplate[]> {
    await connectDB();
    
    const query = this.buildQuery(filters);
    
    const templates = await BlendTemplate.find(query)
      .populate('ingredients.productId')
      .populate('ingredients.unitOfMeasurementId')
      .populate('unitOfMeasurementId')
      .sort({ usageCount: -1, updatedAt: -1 });
      
    return templates.map(template => template.toJSON()) as IBlendTemplate[];
  }
  
  async update(id: string, data: UpdateBlendTemplateData): Promise<IBlendTemplate> {
    await connectDB();
    
    const template = await BlendTemplate.findById(id);
    if (!template) {
      throw new Error('Blend template not found');
    }
    
    // Update fields
    Object.assign(template, data);
    
    // Ensure Mongoose knows about changes
    if (data.sellingPrice !== undefined) {
      template.markModified('sellingPrice');
    }
    
    await template.save();
    
    return this.findByIdWithPopulation(id);
  }
  
  async delete(id: string): Promise<void> {
    await connectDB();
    
    const result = await BlendTemplate.findByIdAndDelete(id);
    if (!result) {
      throw new Error('Blend template not found');
    }
  }
  
  async findPopular(limit: number = 10): Promise<IBlendTemplate[]> {
    await connectDB();
    
    const templates = await BlendTemplate.find({ isActive: true })
      .sort({ usageCount: -1, lastUsed: -1 })
      .limit(limit)
      .populate('ingredients.productId')
      .populate('ingredients.unitOfMeasurementId')
      .populate('unitOfMeasurementId');
      
    return templates.map(template => template.toJSON()) as IBlendTemplate[];
  }
  
  async recordUsage(id: string): Promise<void> {
    await connectDB();
    
    const template = await BlendTemplate.findById(id);
    if (template) {
      await template.recordUsage();
    }
  }
  
  async getCategories(): Promise<string[]> {
    await connectDB();
    
    const categories = await BlendTemplate.distinct('category', { 
      isActive: true, 
      category: { $exists: true, $ne: null, $not: { $eq: '' } } 
    });
    
    return categories.filter(cat => cat).sort();
  }
  
  async getUnitOfMeasurement(id: string): Promise<{ _id: string; name: string; isActive: boolean; type?: string }> {
    await connectDB();
    
    const uom = await UnitOfMeasurement.findById(id);
    if (!uom) {
      throw new Error(`Unit of measurement not found: ${id}`);
    }
    
    return uom;
  }
  
  private buildQuery(filters: TemplateFilters): MongoQuery {
    const query: MongoQuery = {};
    
    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }
    
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } }
      ];
    }
    
    return query;
  }
}