import { connectDB } from '../../lib/mongoose.js';
import { Product, IProduct } from '../../models/Product.js';
import { UnitOfMeasurement } from '../../models/UnitOfMeasurement.js';
import type { 
  ValidationResult,
  ValidationError,
  ValidationWarning,
  BlendIngredient
} from '../../types/blend.js';

/**
 * Validates and enriches blend ingredients
 * Single Responsibility: Ingredient validation and enrichment
 */
export class BlendIngredientValidator {
  
  async validateIngredientAvailability(
    ingredients: BlendIngredient[], 
    batchQuantity: number = 1
  ): Promise<ValidationResult> {
    await connectDB();
    
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    for (const ingredient of ingredients) {
      const validation = await this.validateSingleIngredient(ingredient, batchQuantity);
      
      if (validation.error) {
        errors.push(validation.error);
      }
      
      if (validation.warning) {
        warnings.push(validation.warning);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  async validateAndEnrichIngredients(
    ingredients: Omit<BlendIngredient, 'availableStock' | 'selectedContainers'>[]
  ): Promise<BlendIngredient[]> {
    await connectDB();
    
    const enrichedIngredients: BlendIngredient[] = [];
    
    for (const ingredient of ingredients) {
      const enriched = await this.enrichSingleIngredient(ingredient);
      enrichedIngredients.push(enriched);
    }
    
    return enrichedIngredients;
  }
  
  private async validateSingleIngredient(
    ingredient: BlendIngredient, 
    batchQuantity: number
  ): Promise<{ error?: ValidationError; warning?: ValidationWarning }> {
    const product = await Product.findById(ingredient.productId);
    
    if (!product) {
      return {
        error: {
          ingredientId: ingredient.productId,
          ingredientName: ingredient.name,
          error: 'Product not found',
          requiredQuantity: ingredient.quantity * batchQuantity,
          availableQuantity: 0
        }
      };
    }
    
    if (!product.isActive) {
      return {
        error: {
          ingredientId: ingredient.productId,
          ingredientName: ingredient.name,
          error: 'Product is inactive',
          requiredQuantity: ingredient.quantity * batchQuantity,
          availableQuantity: product.currentStock || 0
        }
      };
    }
    
    const requiredQuantity = ingredient.quantity * batchQuantity;
    const availableQuantity = product.currentStock || 0;
    
    if (availableQuantity < requiredQuantity) {
      return {
        error: {
          ingredientId: ingredient.productId,
          ingredientName: ingredient.name,
          error: 'Insufficient stock',
          requiredQuantity,
          availableQuantity
        }
      };
    }
    
    if (availableQuantity < requiredQuantity * 2) {
      return {
        warning: {
          ingredientId: ingredient.productId,
          ingredientName: ingredient.name,
          warning: 'Low stock - consider reordering soon'
        }
      };
    }
    
    return {};
  }
  
  private async enrichSingleIngredient(
    ingredient: Omit<BlendIngredient, 'availableStock' | 'selectedContainers'>
  ): Promise<BlendIngredient> {
    // Validate product exists
    const product = await Product.findById(ingredient.productId);
    if (!product) {
      throw new Error(`Product not found: ${ingredient.name}`);
    }

    // Check for data consistency issues and auto-correct
    this.validateDataConsistency(ingredient, product);

    // Validate and find suitable unit of measurement
    const uom = await this.findSuitableUOM(ingredient);

    return {
      ...ingredient,
      productId: ingredient.productId,
      name: product.name, // Use current product name
      unitOfMeasurementId: uom._id.toString(),
      unitName: uom.name,
      costPerUnit: this.getCorrectCostPrice(ingredient, product),
      availableStock: product.currentStock || 0
    };
  }

  /**
   * Validates data consistency and warns about common issues
   */
  private validateDataConsistency(
    ingredient: Omit<BlendIngredient, 'availableStock' | 'selectedContainers'>,
    product: {
      _id: string;
      name: string;
      costPrice?: number;
      sellingPrice?: number;
      currentStock?: number;
      containerCapacity?: number;
      containers?: {
        full?: number;
        partial?: Array<{
          remaining: number;
          capacity: number;
        }>;
      };
    }
  ): void {
    // Check if ingredient is using cost price instead of selling price (THE MAIN ISSUE!)
    if (ingredient.costPerUnit === product.costPrice && product.sellingPrice) {
      console.warn(`🚨 PRICING ISSUE: Ingredient "${ingredient.name}" is using cost price (${ingredient.costPerUnit}) instead of selling price (${product.sellingPrice})`);
      console.warn(`💡 Should use SELLING PRICE for all transactions - cost price is only for reference!`);
    }

    // Check if ingredient price doesn't match selling price
    if (ingredient.costPerUnit !== product.sellingPrice && product.sellingPrice) {
      console.warn(`🚨 PRICING ISSUE: Ingredient "${ingredient.name}" price (${ingredient.costPerUnit}) doesn't match product selling price (${product.sellingPrice})`);
    }

    // Check name consistency
    if (ingredient.name !== product.name) {
      console.warn(`📝 NAME MISMATCH: Ingredient name "${ingredient.name}" differs from product name "${product.name}"`);
    }

    // Check unit consistency
    if ((product as IProduct).unitName && ingredient.unitName !== (product as IProduct).unitName) {
      console.warn(`📏 UNIT MISMATCH: Ingredient unit "${ingredient.unitName}" differs from product unit "${(product as IProduct).unitName}"`);
    }

    // Check for missing price
    if (!ingredient.costPerUnit && !product.sellingPrice) {
      console.warn(`💰 MISSING PRICE: Ingredient "${ingredient.name}" has no price set`);
    }
  }

  /**
   * Gets the correct price - should ALWAYS be selling price for all transactions
   */
  private getCorrectCostPrice(
    ingredient: Omit<BlendIngredient, 'availableStock' | 'selectedContainers'>,
    product: {
      costPrice?: number;
      sellingPrice?: number;
      name: string;
    }
  ): number {
    // ALWAYS use selling price for all transactions - cost price is only for reference
    if (ingredient.costPerUnit === product.costPrice && product.sellingPrice) {
      console.log(`🔧 AUTO-CORRECTING: Using product selling price (${product.sellingPrice}) instead of cost price (${ingredient.costPerUnit}) for ingredient "${ingredient.name}"`);
      return product.sellingPrice;
    }

    // If ingredient price doesn't match selling price, use selling price
    if (ingredient.costPerUnit !== product.sellingPrice && product.sellingPrice) {
      console.log(`🔧 AUTO-CORRECTING: Setting ingredient "${ingredient.name}" to use selling price (${product.sellingPrice})`);
      return product.sellingPrice;
    }

    // Use ingredient cost if it matches selling price, otherwise use product selling price
    return ingredient.costPerUnit || product.sellingPrice || 0;
  }

  /**
   * Checks for ingredient data inconsistencies across a blend template
   */
  async checkIngredientConsistency(
    ingredients: Omit<BlendIngredient, 'availableStock' | 'selectedContainers'>[]
  ): Promise<{
    hasInconsistencies: boolean;
    issues: string[];
    autoFixSuggestions: Array<{
      ingredientIndex: number;
      field: string;
      currentValue: unknown;
      suggestedValue: unknown;
      reason: string;
    }>;
  }> {
    await connectDB();

    const issues: string[] = [];
    const autoFixSuggestions: Array<{
      ingredientIndex: number;
      field: string;
      currentValue: unknown;
      suggestedValue: unknown;
      reason: string;
    }> = [];

    for (let i = 0; i < ingredients.length; i++) {
      const ingredient = ingredients[i];

      try {
        const product = await Product.findById(ingredient.productId);

        if (!product) {
          issues.push(`Ingredient "${ingredient.name}" product not found in database`);
          continue;
        }

        // Check for selling price vs cost price issue
        if (ingredient.costPerUnit === product.sellingPrice && product.costPrice && product.costPrice !== product.sellingPrice) {
          issues.push(`Ingredient "${ingredient.name}" is using selling price (${ingredient.costPerUnit}) instead of cost price (${product.costPrice})`);
          autoFixSuggestions.push({
            ingredientIndex: i,
            field: 'costPerUnit',
            currentValue: ingredient.costPerUnit,
            suggestedValue: product.costPrice,
            reason: 'Should use cost price instead of selling price for accurate costing'
          });
        }

        // Check for name inconsistency
        if (ingredient.name !== product.name) {
          issues.push(`Ingredient name "${ingredient.name}" differs from current product name "${product.name}"`);
          autoFixSuggestions.push({
            ingredientIndex: i,
            field: 'name',
            currentValue: ingredient.name,
            suggestedValue: product.name,
            reason: 'Product name has been updated in the database'
          });
        }

        // Check for unit inconsistency
        if ((product as IProduct).unitName && ingredient.unitName !== (product as IProduct).unitName) {
          issues.push(`Ingredient unit "${ingredient.unitName}" differs from product unit "${(product as IProduct).unitName}"`);
          autoFixSuggestions.push({
            ingredientIndex: i,
            field: 'unitName',
            currentValue: ingredient.unitName,
            suggestedValue: (product as IProduct).unitName,
            reason: 'Product unit has been updated in the database'
          });
        }

        // Check for missing cost price
        if (!ingredient.costPerUnit && !product.costPrice) {
          issues.push(`Ingredient "${ingredient.name}" has no cost price set`);
        } else if (!ingredient.costPerUnit && product.costPrice) {
          autoFixSuggestions.push({
            ingredientIndex: i,
            field: 'costPerUnit',
            currentValue: ingredient.costPerUnit,
            suggestedValue: product.costPrice,
            reason: 'Missing cost price - can be populated from product data'
          });
        }

      } catch (error) {
        issues.push(`Error validating ingredient "${ingredient.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      hasInconsistencies: issues.length > 0,
      issues,
      autoFixSuggestions
    };
  }
  
  private async findSuitableUOM(
    ingredient: Omit<BlendIngredient, 'availableStock' | 'selectedContainers'>
  ): Promise<{ _id: string; name: string; isActive: boolean; type?: string }> {
    let uom = null;
    
    // Try to find by ID
    if (ingredient.unitOfMeasurementId) {
      uom = await UnitOfMeasurement.findById(ingredient.unitOfMeasurementId);
    }
    
    // If not found, try to find a suitable default
    if (!uom) {
      console.warn(`Unit of measurement not found for ingredient: ${ingredient.name}, finding suitable default...`);
      
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
        console.warn(`Using default unit ${uom.name} for ingredient: ${ingredient.name}`);
      } else {
        throw new Error(`No suitable unit of measurement found for ingredient: ${ingredient.name}`);
      }
    }
    
    return uom;
  }
}