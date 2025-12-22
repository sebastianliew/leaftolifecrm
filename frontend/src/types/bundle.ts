// Existing blend types
export interface BlendIngredient {
  productId: string;
  name: string;
  quantity: number;
  unitOfMeasurementId: string;
  unitName: string;
  costPerUnit: number;
  availableStock?: number;
  notes?: string;
}

// BlendTemplate interface is now defined in types/blend.ts to avoid conflicts

export interface CustomBlendData {
  name: string;
  ingredients: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitOfMeasurementId: string;
    unitName: string;
    costPerUnit: number;
    selectedContainers?: Array<{
      containerId: string;
      containerCode: string;
      quantityToConsume: number;
      batchNumber?: string;
      expiryDate?: Date;
    }>;
  }>;
  totalIngredientCost: number;
  preparationNotes?: string;
  mixedBy: string;
  mixedAt: Date;
}

export interface BlendFormData {
  name: string;
  description: string;
  category: string;
  ingredients: BlendIngredient[];
  batchSize: number;
  unitOfMeasurementId: string;
  unitName: string;
  standardSellingPrice: number;
  minimumSellingPrice: number;
  preparationInstructions: string;
  storageInstructions: string;
  shelfLife: number;
}

export interface CostCalculation {
  totalCost: number;
  breakdown: Array<{
    productId: string;
    name: string;
    quantity: number;
    costPerUnit: number;
    totalCost: number;
  }>;
  pricing: {
    suggestedPrice: number;
    minimumPrice: number;
    profitMargin: number;
  };
}

// New Bundle Types
export interface BundleProduct {
  productId: string;
  name: string;
  quantity: number;
  productType: 'product' | 'fixed_blend';
  blendTemplateId?: string;
  unitOfMeasurementId?: string; // Made optional to handle cases where UOM might not be available
  unitName: string;
  individualPrice: number;
  notes?: string;
}

export interface Bundle {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  bundleProducts: BundleProduct[];
  bundlePrice: number;
  individualTotalPrice: number;
  savings: number;
  savingsPercentage: number;
  isActive: boolean;
  isPromoted: boolean;
  promotionText?: string;
  totalSold: number;
  lastSoldDate?: Date;
  createdBy: string;
  lastModifiedBy?: string;
  validFrom?: Date;
  validUntil?: Date;
  tags: string[];
  internalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BundleFormData {
  name: string;
  description: string;
  category?: string;
  bundleProducts: BundleProduct[];
  bundlePrice: number;
  isActive: boolean;
  isPromoted: boolean;
  promotionText: string;
  validFrom: string;
  validUntil: string;
  tags: string[];
  internalNotes: string;
}

export interface BundleAvailabilityResult {
  productId: string;
  name: string;
  available: boolean;
  availableStock?: number;
  requiredStock?: number;
  reason?: string;
}

export interface BundleAvailability {
  allAvailable: boolean;
  results: BundleAvailabilityResult[];
}

export interface BundlePricingCalculation {
  individualTotal: number;
  bundlePrice: number;
  savings: number;
  savingsPercentage: number;
  breakdown: Array<{
    productId: string;
    name: string;
    quantity: number;
    individualPrice: number;
    totalPrice: number;
  }>;
}

export interface BundleTransactionItem {
  id: string;
  bundleId: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discountAmount: number;
  isService: boolean;
  saleType: 'bundle';
  unitOfMeasurementId: string;
  baseUnit: string;
  convertedQuantity: number;
  itemType: 'bundle';
  bundleData: {
    bundleId: string;
    bundleName: string;
    bundleProducts: Array<{
      productId: string;
      name: string;
      quantity: number;
      productType: 'product' | 'fixed_blend';
      blendTemplateId?: string;
      individualPrice: number;
      // Container selection for products
      selectedContainers?: Array<{
        containerId: string;
        containerCode: string;
        quantityToConsume: number;
        batchNumber?: string;
        expiryDate?: Date;
      }>;
    }>;
    individualTotalPrice: number;
    savings: number;
    savingsPercentage: number;
  };
}

export interface BundleStats {
  totalBundles: number;
  activeBundles: number;
  promotedBundles: number;
  totalSales: number;
  totalRevenue: number;
  averageSavings: number;
  topSellingBundles: Array<{
    bundleId: string;
    name: string;
    totalSold: number;
    revenue: number;
  }>;
  recentSales: Array<{
    bundleId: string;
    name: string;
    quantity: number;
    totalPrice: number;
    soldAt: Date;
  }>;
}

export interface BundleFilters {
  category?: string;
  isActive?: boolean;
  isPromoted?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minSavings?: number;
  tags?: string[];
  search?: string;
  sortBy?: 'name' | 'price' | 'savings' | 'totalSold' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface BundleValidationError {
  field: string;
  message: string;
  code: string;
}

export interface BundleValidationResult {
  isValid: boolean;
  errors: BundleValidationError[];
  warnings?: string[];
}