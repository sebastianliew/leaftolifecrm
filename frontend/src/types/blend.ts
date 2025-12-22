import type { ContainerType } from "./container"

export interface BlendTemplate {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  
  // Recipe/Formula
  ingredients: BlendIngredient[];
  
  // Batch information - made optional for recipe-only templates
  batchSize?: number;
  unitOfMeasurementId: string | { _id?: string; id?: string };
  unitName: string;
  
  // Cost information
  totalCost: number;
  costPerUnit: number;
  
  // Pricing and profit
  sellingPrice: number;
  profit: number;
  profitMargin: number;
  
  // Metadata
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastUsed?: string;
  usageCount: number;
}

export interface BlendIngredient {
  productId: string;
  name: string;
  quantity: number;
  unitOfMeasurementId: string | { _id?: string; id?: string };
  unitName: string;
  costPerUnit?: number;
  notes?: string;
  availableStock?: number;
  selectedContainers?: SelectedContainer[];
}

export interface SelectedContainer {
  containerId: string;
  containerCode: string;
  quantityToConsume: number;
  batchNumber?: string;
  expiryDate?: Date;
}

export interface CustomBlendData {
  name: string;
  ingredients: BlendIngredient[];
  totalIngredientCost: number;
  preparationNotes?: string;
  mixedBy: string;
  mixedAt: Date;
  marginPercent?: number;
  containerType?: string | ContainerType | { id: string; _id?: string; name?: string };
}

export interface CreateBlendTemplateData {
  name: string;
  description?: string;
  category?: string;
  ingredients: Omit<BlendIngredient, 'availableStock' | 'selectedContainers'>[];
  batchSize?: number; // Made optional - defaults to 1 for backward compatibility
  unitOfMeasurementId: string;
  unitName?: string; // Include unitName to avoid lookup in service
  createdBy: string;
  sellingPrice?: number;
}

export interface UpdateBlendTemplateData extends Partial<CreateBlendTemplateData> {
  isActive?: boolean;
}

export interface TemplateFilters {
  isActive?: boolean;
  search?: string;
  category?: string;
  hasIngredients?: boolean;
  minCost?: number;
  maxCost?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  ingredientId: string;
  ingredientName: string;
  error: string;
  requiredQuantity: number;
  availableQuantity: number;
}

export interface ValidationWarning {
  ingredientId: string;
  ingredientName: string;
  warning: string;
}

export interface CostCalculation {
  totalCost: number;
  breakdown: Array<{
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
}

export interface PricingSuggestion {
  suggestedPrice: number;
  minimumPrice: number;
  profitMargin: number;
  breakdown: {
    cost: number;
    markup: number;
    suggestedMarkupPercent: number;
  };
}

 