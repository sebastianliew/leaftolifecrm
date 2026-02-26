import { Product } from '../models/Product.js';
import { InventoryMovement } from '../models/inventory/InventoryMovement.js';
import { connectDB } from '../lib/mongoose.js';
import mongoose from 'mongoose';
import { BlendIngredientValidator } from './blend/BlendIngredientValidator.js';
import type { 
  BlendIngredient,
  ValidationResult,
  CostCalculation,
  PricingSuggestion,
  CustomBlendData
} from '../types/blend.js';

export class CustomBlendService {
  
  /**
   * Process blend inventory deduction for transaction items
   */
  async processBlendInventoryDeduction(
    customBlendData: CustomBlendData,
    transactionReference: string,
    userId: string
  ): Promise<void> {
    await connectDB();

    for (const ingredient of customBlendData.ingredients) {
      const product = await Product.findById(ingredient.productId);
      if (!product) {
        throw new Error(`Ingredient product not found: ${ingredient.productId}`);
      }

      const movement = new InventoryMovement({
        productId: new mongoose.Types.ObjectId(ingredient.productId),
        movementType: 'blend_ingredient',
        quantity: ingredient.quantity,
        unitOfMeasurementId: new mongoose.Types.ObjectId(
          typeof ingredient.unitOfMeasurementId === 'string' 
            ? ingredient.unitOfMeasurementId 
            : ingredient.unitOfMeasurementId._id || ingredient.unitOfMeasurementId.id
        ),
        baseUnit: ingredient.unitName || 'unit',
        convertedQuantity: ingredient.quantity,
        reference: transactionReference,
        notes: `Custom blend ingredient: ${customBlendData.name} (${transactionReference})`,
        createdBy: userId
      });

      await movement.save();
      await movement.updateProductStock();
    }
  }

  // Validation — delegates to BlendIngredientValidator (single source of truth)
  async validateIngredients(ingredients: BlendIngredient[], multiplier: number = 1): Promise<ValidationResult> {
    await connectDB();
    return this.ingredientValidator.validateIngredientAvailability(ingredients, multiplier);
  }
  
  // Calculate blend cost with detailed breakdown
  async calculateBlendCost(ingredients: BlendIngredient[]): Promise<CostCalculation> {
    await connectDB();
    
    try {
      const breakdown: CostCalculation['breakdown'] = [];
      let totalCost = 0;
      
      for (const ingredient of ingredients) {
        const product = await Product.findById(ingredient.productId);
        
        if (!product) {
          throw new Error(`Product not found: ${ingredient.name}`);
        }
        
        const unitCost = ingredient.costPerUnit || product.sellingPrice || 0;
        const ingredientTotalCost = ingredient.quantity * unitCost;
        
        totalCost += ingredientTotalCost;
        
        breakdown.push({
          ingredientId: ingredient.productId,
          ingredientName: ingredient.name,
          quantity: ingredient.quantity,
          unitCost,
          totalCost: Math.round(ingredientTotalCost * 100) / 100
        });
      }
      
      return {
        totalCost: Math.round(totalCost * 100) / 100,
        breakdown
      };
    } catch (error) {
      console.error('Error calculating blend cost:', error);
      throw new Error(`Failed to calculate blend cost: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Suggest pricing for custom blend
  async suggestPricing(cost: number, marginPercent: number = 100): Promise<PricingSuggestion> {
    const markup = cost * (marginPercent / 100);
    const suggestedPrice = cost + markup;
    const minimumPrice = cost * 1.2; // Minimum 20% profit margin
    
    return {
      suggestedPrice: Math.round(suggestedPrice * 100) / 100,
      minimumPrice: Math.round(minimumPrice * 100) / 100,
      profitMargin: marginPercent,
      breakdown: {
        cost: Math.round(cost * 100) / 100,
        markup: Math.round(markup * 100) / 100,
        suggestedMarkupPercent: marginPercent
      }
    };
  }
  
  // Process custom blend sale and deduct inventory
  async processCustomBlendSale(
    blendData: CustomBlendData, 
    transactionId: string,
    transactionNumber: string
  ): Promise<void> {
    await connectDB();
    
    try {
      await this.deductCustomBlendIngredients(
        blendData.ingredients,
        transactionId,
        transactionNumber,
        blendData.mixedBy
      );
      
      // Log successful processing
      // Custom blend processed successfully
    } catch (error) {
      console.error('Error processing custom blend sale:', error);
      throw new Error(`Failed to process custom blend sale: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Deduct ingredients from inventory
  async deductCustomBlendIngredients(
    ingredients: BlendIngredient[],
    transactionId: string,
    transactionNumber: string,
    mixedBy: string
  ): Promise<InstanceType<typeof InventoryMovement>[]> {
    await connectDB();
    
    const movements = [];
    
    try {
      for (const ingredient of ingredients) {
        const product = await Product.findById(ingredient.productId);
        
        if (!product) {
          throw new Error(`Product not found: ${ingredient.name}`);
        }
        
        const movement = new InventoryMovement({
          productId: new mongoose.Types.ObjectId(ingredient.productId),
          movementType: 'custom_blend',
          quantity: ingredient.quantity,
          unitOfMeasurementId: new mongoose.Types.ObjectId(
            typeof ingredient.unitOfMeasurementId === 'string' 
              ? ingredient.unitOfMeasurementId 
              : ingredient.unitOfMeasurementId._id || ingredient.unitOfMeasurementId.id
          ),
          baseUnit: ingredient.unitName || 'unit',
          convertedQuantity: ingredient.quantity,
          reference: transactionNumber,
          notes: `Custom blend ingredient: ${ingredient.name}`,
          createdBy: mixedBy
        });
        
        await movement.save();
        await movement.updateProductStock();
        movements.push(movement);
      }
      
      return movements;
    } catch (error) {
      console.error('Error deducting custom blend ingredients:', error);
      // Clean up any successful movements if an error occurs
      for (const movement of movements) {
        try {
          await InventoryMovement.findByIdAndDelete(movement._id);
        } catch (cleanupError) {
          console.error('Error cleaning up inventory movement:', cleanupError);
        }
      }
      throw error;
    }
  }
  
  // Delegates to BlendIngredientValidator — single source of truth for ingredient enrichment
  private ingredientValidator = new BlendIngredientValidator();

  async enrichIngredientData(ingredients: Omit<BlendIngredient, 'availableStock' | 'costPerUnit'>[]): Promise<BlendIngredient[]> {
    await connectDB();
    return this.ingredientValidator.validateAndEnrichIngredients(ingredients as Omit<BlendIngredient, 'availableStock'>[]);
  }
  
}