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

export interface CreateBlendTemplateData {
  name: string;
  description?: string;
  category?: string;
  ingredients: Omit<BlendIngredient, 'availableStock' | 'selectedContainers'>[];
  batchSize?: number;
  unitOfMeasurementId: string;
  sellingPrice?: number;
  createdBy: string;
}

export interface UpdateBlendTemplateData {
  name?: string;
  description?: string;
  category?: string;
  ingredients?: BlendIngredient[];
  batchSize?: number;
  unitOfMeasurementId?: string;
  unitName?: string;
  sellingPrice?: number;
  isActive?: boolean;
}

export interface TemplateFilters {
  isActive?: boolean;
  search?: string;
  category?: string;
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
  breakdown: {
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }[];
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

export interface CustomBlendData {
  name: string;
  description?: string;
  ingredients: BlendIngredient[];
  totalCost: number;
  sellingPrice: number;
  mixedBy: string;
  notes?: string;
}