import { BlendTemplate } from '../models/BlendTemplate.js';
import { Product } from '../models/Product.js';
import { UnitOfMeasurement } from '../models/UnitOfMeasurement.js';
import { connectDB } from '../lib/mongoose.js';
import type {
  BlendTemplate as IBlendTemplate,
  CreateBlendTemplateData,
  UpdateBlendTemplateData,
  TemplateFilters,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  BlendIngredient
} from '../types/blend.js';

export class BlendTemplateService {
  
  // Template management
  async createTemplate(templateData: CreateBlendTemplateData): Promise<IBlendTemplate> {
    await connectDB();
    
    // Creating blend template
    
    try {
      // Validate template unit of measurement
      // Validating template unit of measurement
      if (!templateData.unitOfMeasurementId) {
        throw new Error('Template unit of measurement ID is required');
      }
      
      const templateUom = await UnitOfMeasurement.findById(templateData.unitOfMeasurementId);
      if (!templateUom) {
        throw new Error(`Template unit of measurement not found: ${templateData.unitOfMeasurementId}`);
      }
      // Template unit validated
      
      // Validate ingredients exist and get current pricing
      // Validating ingredients
      const enrichedIngredients = await this.validateAndEnrichIngredients(templateData.ingredients);
      // Ingredients validated successfully
      
      
      // Ensure unitName is set and sellingPrice defaults to 0 if not provided
      const finalTemplateData = {
        ...templateData,
        unitName: templateUom.name, // Use the actual UOM name from database
        ingredients: enrichedIngredients,
        sellingPrice: templateData.sellingPrice ?? 0
      };
      
      // Creating template with final data
      
      const template = new BlendTemplate(finalTemplateData);
      
      // Saving template to database
      await template.save();
      // Template saved to database
      
      // Populating template fields
      const populatedTemplate = await BlendTemplate.findById(template._id)
        .populate('ingredients.productId')
        .populate('ingredients.unitOfMeasurementId')
        .populate('unitOfMeasurementId');
        
      if (!populatedTemplate) {
        throw new Error('Failed to retrieve saved template');
      }
      
      // Template created successfully
      return populatedTemplate.toJSON() as IBlendTemplate;
    } catch (error: unknown) {
      console.error('Error creating blend template:', error);
      throw new Error(`Failed to create blend template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  async getTemplates(filters: TemplateFilters = {}): Promise<IBlendTemplate[]> {
    await connectDB();

    try {
      const query: Record<string, unknown> = {
        isDeleted: { $ne: true } // Exclude soft-deleted templates
      };

      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      const templates = await BlendTemplate.find(query)
        .populate('ingredients.productId')
        .populate('ingredients.unitOfMeasurementId')
        .populate('unitOfMeasurementId')
        .sort({ usageCount: -1, updatedAt: -1 });
        
      return templates.map(template => template.toJSON()) as IBlendTemplate[];
    } catch (error: unknown) {
      console.error('Error fetching blend templates:', error);
      throw new Error(`Failed to fetch blend templates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  async getTemplate(id: string): Promise<IBlendTemplate> {
    await connectDB();
    
    try {
      const template = await BlendTemplate.findById(id)
        .populate('ingredients.productId')
        .populate('ingredients.unitOfMeasurementId')
        .populate('unitOfMeasurementId');
        
      if (!template) {
        throw new Error('Blend template not found');
      }
      
      return template.toJSON() as IBlendTemplate;
    } catch (error: unknown) {
      console.error('Error fetching blend template:', error);
      throw new Error(`Failed to fetch blend template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  async updateTemplate(id: string, data: UpdateBlendTemplateData): Promise<IBlendTemplate> {
    await connectDB();
    
    try {
      const template = await BlendTemplate.findById(id);
      if (!template) {
        throw new Error('Blend template not found');
      }
      
      // If ingredients are being updated, validate them
      if (data.ingredients) {
        data.ingredients = await this.validateAndEnrichIngredients(data.ingredients);
      }
      
      // If unitOfMeasurementId is being updated, also update unitName
      if (data.unitOfMeasurementId) {
        const uom = await UnitOfMeasurement.findById(data.unitOfMeasurementId);
        if (!uom) {
          throw new Error(`Unit of measurement not found: ${data.unitOfMeasurementId}`);
        }
        data.unitName = uom.name;
      }
      
      // Update template fields explicitly to ensure all fields are updated
      if (data.name !== undefined) template.name = data.name;
      if (data.description !== undefined) template.description = data.description;
      if (data.category !== undefined) template.category = data.category;
      if (data.batchSize !== undefined) template.batchSize = data.batchSize;
      if (data.sellingPrice !== undefined) {
        template.sellingPrice = data.sellingPrice;
        template.markModified('sellingPrice'); // Ensure Mongoose knows this field changed
      }
      if (data.isActive !== undefined) template.isActive = data.isActive;
      if (data.unitOfMeasurementId !== undefined) template.unitOfMeasurementId = data.unitOfMeasurementId;
      if (data.unitName !== undefined) template.unitName = data.unitName;
      if (data.ingredients !== undefined) template.ingredients = data.ingredients;
      
      await template.save();
      
      const populatedTemplate = await BlendTemplate.findById(template._id)
        .populate('ingredients.productId')
        .populate('ingredients.unitOfMeasurementId')
        .populate('unitOfMeasurementId');
        
      return populatedTemplate?.toJSON() as IBlendTemplate;
    } catch (error: unknown) {
      console.error('Error updating blend template:', error);
      throw new Error(`Failed to update blend template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  async deleteTemplate(id: string, deletedBy?: string): Promise<void> {
    await connectDB();

    try {
      const template = await BlendTemplate.findById(id);
      if (!template) {
        throw new Error('Blend template not found');
      }

      // Check if already deleted
      if (template.isDeleted) {
        throw new Error('Blend template is already deleted');
      }

      // Perform soft delete
      template.isDeleted = true;
      template.deletedAt = new Date();
      template.deletedBy = deletedBy || 'system';
      template.deleteReason = 'User requested deletion';

      await template.save();

      console.log(`Blend template ${template.name} soft deleted by ${deletedBy || 'system'}`);
    } catch (error: unknown) {
      console.error('Error deleting blend template:', error);
      throw new Error(`Failed to delete blend template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Usage tracking
  async recordTemplateUsage(id: string): Promise<void> {
    await connectDB();
    
    try {
      const template = await BlendTemplate.findById(id);
      if (template) {
        await template.recordUsage();
      }
    } catch (error: unknown) {
      console.error('Error recording template usage:', error);
      // Don't throw error for usage tracking failure
    }
  }
  
  async getPopularTemplates(limit: number = 10): Promise<IBlendTemplate[]> {
    await connectDB();
    
    try {
      const templates = await BlendTemplate.find({ isActive: true })
        .sort({ usageCount: -1, lastUsed: -1 })
        .limit(limit)
        .populate('ingredients.productId')
        .populate('ingredients.unitOfMeasurementId')
        .populate('unitOfMeasurementId');
      return templates.map(template => template.toJSON()) as IBlendTemplate[];
    } catch (error: unknown) {
      console.error('Error fetching popular templates:', error);
      throw new Error(`Failed to fetch popular templates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  
  // Validation helpers
  async validateIngredientAvailability(ingredients: BlendIngredient[], batchQuantity: number = 1): Promise<ValidationResult> {
    await connectDB();
    
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    try {
      for (const ingredient of ingredients) {
        const product = await Product.findById(ingredient.productId);
        
        if (!product) {
          errors.push({
            ingredientId: ingredient.productId,
            ingredientName: ingredient.name,
            error: 'Product not found',
            requiredQuantity: ingredient.quantity * batchQuantity,
            availableQuantity: 0
          });
          continue;
        }
        
        if (!product.isActive) {
          errors.push({
            ingredientId: ingredient.productId,
            ingredientName: ingredient.name,
            error: 'Product is inactive',
            requiredQuantity: ingredient.quantity * batchQuantity,
            availableQuantity: product.currentStock || 0
          });
          continue;
        }
        
        const requiredQuantity = ingredient.quantity * batchQuantity;
        const availableQuantity = product.currentStock || 0;
        
        if (availableQuantity < requiredQuantity) {
          errors.push({
            ingredientId: ingredient.productId,
            ingredientName: ingredient.name,
            error: 'Insufficient stock',
            requiredQuantity,
            availableQuantity
          });
        } else if (availableQuantity < requiredQuantity * 2) {
          warnings.push({
            ingredientId: ingredient.productId,
            ingredientName: ingredient.name,
            warning: 'Low stock - consider reordering soon'
          });
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error: unknown) {
      console.error('Error validating ingredient availability:', error);
      throw new Error(`Failed to validate ingredients: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  
  // Helper method to validate and enrich ingredients with current pricing
  private async validateAndEnrichIngredients(ingredients: Omit<BlendIngredient, 'availableStock' | 'selectedContainers'>[]): Promise<BlendIngredient[]> {
    // Validating and enriching ingredients
    
    const enrichedIngredients = [];
    
    for (let i = 0; i < ingredients.length; i++) {
      const ingredient = ingredients[i];
      // Processing ingredient
      
      // Validate product exists
      // Looking for product
      const product = await Product.findById(ingredient.productId);
      if (!product) {
        console.error(`Product not found with ID: ${ingredient.productId}`);
        throw new Error(`Product not found: ${ingredient.name}`);
      }
      // Product found
      
      // Validate unit of measurement with fallback logic
      let uom = null;
      let unitId = ingredient.unitOfMeasurementId;
      
      // Looking for unit
      if (unitId) {
        uom = await UnitOfMeasurement.findById(unitId);
        if (!uom) {
          console.warn(`Unit not found with ID: ${unitId}`);
        }
      }
      
      // If no unit found, try to find a suitable default unit
      if (!uom) {
        console.warn(`Unit of measurement not found for ingredient: ${ingredient.name}, trying to find suitable default...`);
        
        // Try to find a default unit - prefer grams or milliliters
        const defaultUoms = await UnitOfMeasurement.find({
          isActive: true,
          $or: [
            { name: { $regex: /gram/i } },
            { name: { $regex: /milliliter/i } },
            { name: { $regex: /^ml$/i } },
            { name: { $regex: /^g$/i } },
            { type: 'weight' },
            { type: 'volume' }
          ]
        }).sort({ name: 1 }).limit(1);
        
        if (defaultUoms.length > 0) {
          uom = defaultUoms[0];
          unitId = uom._id.toString();
          console.warn(`Using default unit ${uom.name} for ingredient: ${ingredient.name}`);
        } else {
          console.error(`No suitable unit of measurement found for ingredient: ${ingredient.name}`);
          throw new Error(`No suitable unit of measurement found for ingredient: ${ingredient.name}. Please ensure the ingredient has a valid unit assigned.`);
        }
      }
      
      const enrichedIngredient = {
        ...ingredient,
        unitOfMeasurementId: unitId,
        name: product.name, // Use current product name
        unitName: uom.name, // Use current UOM name
        costPerUnit: ingredient.costPerUnit || product.sellingPrice || 0
      };
      
      enrichedIngredients.push(enrichedIngredient);
    }
    
    // Ingredient validation complete
    return enrichedIngredients;
  }
  
  // Get template categories
  async getCategories(): Promise<string[]> {
    await connectDB();
    
    try {
      const categories = await BlendTemplate.distinct('category', { 
        isActive: true, 
        category: { $exists: true, $ne: null, $not: { $eq: '' } } 
      });
      return categories.filter(cat => cat).sort();
    } catch (error: unknown) {
      console.error('Error fetching template categories:', error);
      throw new Error(`Failed to fetch categories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}