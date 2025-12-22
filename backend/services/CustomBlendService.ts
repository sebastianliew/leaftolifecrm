import { Product } from '../models/Product.js';
import { UnitOfMeasurement } from '../models/UnitOfMeasurement.js';
import { InventoryMovement } from '../models/inventory/InventoryMovement.js';
import { connectDB } from '../lib/mongoose.js';
import mongoose from 'mongoose';
import type { 
  BlendIngredient,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  CostCalculation,
  PricingSuggestion,
  CustomBlendData,
  SelectedContainer
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

      // Use container selection if provided
      if (ingredient.selectedContainers && ingredient.selectedContainers.length > 0) {
        await this.processContainerBasedIngredientDeduction(
          ingredient.selectedContainers,
          ingredient.quantity,
          product,
          transactionReference,
          userId
        );
      } else {
        // Create general inventory movement for the ingredient
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
  }

  /**
   * Process container-based ingredient deduction for custom blends with flexible quantity tracking
   */
  private async processContainerBasedIngredientDeduction(
    selectedContainers: SelectedContainer[],
    totalRequired: number,
    product: InstanceType<typeof Product>,
    transactionReference: string,
    userId: string
  ): Promise<void> {
    // Processing container-based deduction
    
    for (const containerData of selectedContainers) {
      const quantityToConsume = containerData.quantityToConsume;
      const containerCapacity = product.containerCapacity || product.quantity || 1;
      
      // Container deduction details calculated

      // Determine if this is a full or partial container consumption
      const isFullContainerConsumption = quantityToConsume >= containerCapacity;
      
      if (isFullContainerConsumption) {
        // Processing as full container consumption
        await product.handleFullContainerSale();
      } else {
        // Processing as partial container consumption
        await product.handlePartialContainerSale(quantityToConsume);
      }

      // Create detailed inventory movement record
      const movement = new InventoryMovement({
        productId: product._id,
        movementType: 'blend_ingredient',
        quantity: quantityToConsume,
        convertedQuantity: quantityToConsume,
        unitOfMeasurementId: product.unitOfMeasurement,
        baseUnit: product.unitOfMeasurement?.name || 'unit',
        reference: transactionReference,
        notes: `Custom blend ingredient - ${quantityToConsume} from ${containerData.containerCode}`,
        createdBy: userId,
        // Enhanced container tracking
        containerStatus: isFullContainerConsumption ? 'full' : 'partial',
        containerId: containerData.containerId,
        remainingQuantity: isFullContainerConsumption ? 0 : (containerCapacity - quantityToConsume)
      });

      await movement.save();
      
      // Container deduction completed
    }
  }

  // Real-time validation for ingredients
  async validateIngredients(ingredients: BlendIngredient[], multiplier: number = 1): Promise<ValidationResult> {
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
            requiredQuantity: ingredient.quantity * multiplier,
            availableQuantity: 0
          });
          continue;
        }
        
        if (!product.isActive) {
          errors.push({
            ingredientId: ingredient.productId,
            ingredientName: ingredient.name,
            error: 'Product is inactive',
            requiredQuantity: ingredient.quantity * multiplier,
            availableQuantity: product.currentStock || 0
          });
          continue;
        }
        
        const requiredQuantity = ingredient.quantity * multiplier;
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
        
        // Check if products are near expiry (if expiry date exists)
        if (product.expiryDate) {
          const daysUntilExpiry = Math.ceil(
            (new Date(product.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );
          
          if (daysUntilExpiry <= 7) {
            warnings.push({
              ingredientId: ingredient.productId,
              ingredientName: ingredient.name,
              warning: `Product expires in ${daysUntilExpiry} days`
            });
          }
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      console.error('Error validating ingredients:', error);
      throw new Error(`Failed to validate ingredients: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
        
        // Handle container-based deduction if containers are selected
        // Note: Container functionality has been removed, falling back to standard deduction
        if (ingredient.selectedContainers && ingredient.selectedContainers.length > 0) {
          // Calculate total quantity from selected containers
          const totalQuantity = ingredient.selectedContainers.reduce(
            (sum: number, container) => sum + container.quantityToConsume, 
            0
          );
          
          // Create single inventory movement for the total quantity
          const movement = new InventoryMovement({
            productId: new mongoose.Types.ObjectId(ingredient.productId),
            movementType: 'custom_blend',
            quantity: totalQuantity,
            unitOfMeasurementId: new mongoose.Types.ObjectId(
            typeof ingredient.unitOfMeasurementId === 'string' 
              ? ingredient.unitOfMeasurementId 
              : ingredient.unitOfMeasurementId._id || ingredient.unitOfMeasurementId.id
          ),
            baseUnit: ingredient.unitName || 'unit',
            convertedQuantity: totalQuantity,
            reference: transactionNumber,
            notes: `Custom blend ingredient: ${ingredient.name} (Container functionality disabled)`,
            createdBy: mixedBy
          });
          
          await movement.save();
          await movement.updateProductStock();
          movements.push(movement);
        } else {
          // Standard quantity-based deduction
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
  
  // Get enriched ingredient data with current prices and availability
  async enrichIngredientData(ingredients: Omit<BlendIngredient, 'availableStock' | 'costPerUnit'>[]): Promise<BlendIngredient[]> {
    await connectDB();
    
    const enrichedIngredients: BlendIngredient[] = [];
    
    try {
      for (const ingredient of ingredients) {
        const product = await Product.findById(ingredient.productId)
          .populate('unitOfMeasurement');
        
        if (!product) {
          throw new Error(`Product not found: ${ingredient.name}`);
        }
        
        const uom = await UnitOfMeasurement.findById(ingredient.unitOfMeasurementId);
        
        enrichedIngredients.push({
          ...ingredient,
          name: product.name,
          unitName: uom?.name || ingredient.unitName,
          costPerUnit: product.costPrice || 0,
          availableStock: product.currentStock || 0
        });
      }
      
      return enrichedIngredients;
    } catch (error) {
      console.error('Error enriching ingredient data:', error);
      throw new Error(`Failed to enrich ingredient data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Check if ingredients are available for container selection
  // Note: Container functionality has been removed
  async getAvailableContainers(_productId: string): Promise<never[]> {
    await connectDB();
    
    try {
      // Container functionality has been removed, return empty array
      // Container functionality disabled for product
      return [];
    } catch (error) {
      console.error('Error in getAvailableContainers:', error);
      throw new Error(`Failed to fetch available containers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Validate container selection for custom blend
  // Note: Container functionality has been removed
  async validateContainerSelection(
    productId: string, 
    selectedContainers: SelectedContainer[],
    requiredQuantity: number
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    try {
      // Container functionality has been removed
      // Simply validate that total selected quantities match required quantity
      const totalSelectedQuantity = selectedContainers.reduce(
        (sum: number, container) => sum + container.quantityToConsume, 
        0
      );
      
      if (Math.abs(totalSelectedQuantity - requiredQuantity) > 0.01) {
        errors.push({
          ingredientId: productId,
          ingredientName: 'Product',
          error: 'Selected container quantities do not match required quantity',
          requiredQuantity,
          availableQuantity: totalSelectedQuantity
        });
      }
      
      // Add warning that container functionality is disabled
      if (selectedContainers.length > 0) {
        warnings.push({
          ingredientId: productId,
          ingredientName: 'Product',
          warning: 'Container functionality has been disabled - using standard inventory deduction'
        });
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      console.error('Error validating container selection:', error);
      throw new Error(`Failed to validate container selection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}