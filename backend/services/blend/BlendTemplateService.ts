import { BlendTemplateRepository } from './BlendTemplateRepository.js';
import { BlendIngredientValidator } from './BlendIngredientValidator.js';
import { BlendUsageTracker } from './BlendUsageTracker.js';
import type { 
  BlendTemplate as IBlendTemplate,
  CreateBlendTemplateData, 
  UpdateBlendTemplateData, 
  TemplateFilters,
  ValidationResult,
  BlendIngredient
} from '../../types/blend.js';

/**
 * Main service for blend template operations
 * Orchestrates the specialized services following Single Responsibility Principle
 */
export class BlendTemplateService {
  private repository: BlendTemplateRepository;
  private validator: BlendIngredientValidator;
  private usageTracker: BlendUsageTracker;
  
  constructor() {
    this.repository = new BlendTemplateRepository();
    this.validator = new BlendIngredientValidator();
    this.usageTracker = new BlendUsageTracker();
  }
  
  // Template Management
  async createTemplate(templateData: CreateBlendTemplateData): Promise<IBlendTemplate> {
    try {
      // Validate template unit of measurement
      const templateUom = await this.repository.getUnitOfMeasurement(templateData.unitOfMeasurementId);
      
      // Validate and enrich ingredients
      const enrichedIngredients = await this.validator.validateAndEnrichIngredients(templateData.ingredients);
      
      // Prepare final template data
      const finalTemplateData = {
        ...templateData,
        unitName: templateUom.name,
        ingredients: enrichedIngredients,
        sellingPrice: templateData.sellingPrice ?? 0
      };
      
      // Create template
      return await this.repository.create(finalTemplateData);
    } catch (error: unknown) {
      console.error('Error creating blend template:', error);
      throw new Error(`Failed to create blend template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  async getTemplates(filters: TemplateFilters = {}): Promise<IBlendTemplate[]> {
    try {
      return await this.repository.findAll(filters);
    } catch (error: unknown) {
      console.error('Error fetching blend templates:', error);
      throw new Error(`Failed to fetch blend templates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  async getTemplate(id: string): Promise<IBlendTemplate> {
    try {
      return await this.repository.findByIdWithPopulation(id);
    } catch (error: unknown) {
      console.error('Error fetching blend template:', error);
      throw new Error(`Failed to fetch blend template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  async updateTemplate(id: string, data: UpdateBlendTemplateData): Promise<IBlendTemplate> {
    try {
      // If ingredients are being updated, validate them
      if (data.ingredients) {
        data.ingredients = await this.validator.validateAndEnrichIngredients(data.ingredients);
      }
      
      // If unit is being updated, get the name
      if (data.unitOfMeasurementId) {
        const uom = await this.repository.getUnitOfMeasurement(data.unitOfMeasurementId);
        data.unitName = uom.name;
      }
      
      return await this.repository.update(id, data);
    } catch (error: unknown) {
      console.error('Error updating blend template:', error);
      throw new Error(`Failed to update blend template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  async deleteTemplate(id: string): Promise<void> {
    try {
      await this.repository.delete(id);
    } catch (error: unknown) {
      console.error('Error deleting blend template:', error);
      throw new Error(`Failed to delete blend template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Usage Tracking
  async recordTemplateUsage(id: string): Promise<void> {
    await this.usageTracker.recordUsage(id);
  }
  
  async getPopularTemplates(limit: number = 10): Promise<IBlendTemplate[]> {
    try {
      return await this.repository.findPopular(limit);
    } catch (error: unknown) {
      console.error('Error fetching popular templates:', error);
      throw new Error(`Failed to fetch popular templates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Validation
  async validateIngredientAvailability(
    ingredients: BlendIngredient[], 
    batchQuantity: number = 1
  ): Promise<ValidationResult> {
    try {
      return await this.validator.validateIngredientAvailability(ingredients, batchQuantity);
    } catch (error: unknown) {
      console.error('Error validating ingredient availability:', error);
      throw new Error(`Failed to validate ingredients: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Categories
  async getCategories(): Promise<string[]> {
    try {
      return await this.repository.getCategories();
    } catch (error: unknown) {
      console.error('Error fetching template categories:', error);
      throw new Error(`Failed to fetch categories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}