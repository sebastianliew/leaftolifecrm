export interface ProductCategory {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  level: number;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface UnitOfMeasurement {
  id: string;
  _id?: string;
  name: string;
  abbreviation: string;
  type: 'weight' | 'volume' | 'count' | 'length' | 'area' | 'temperature';
  description?: string;
  isActive: boolean;
  baseUnit?: string;
  conversionRate?: number;
}

export interface Brand {
  id: string;
  _id?: string;
  name: string;
  code?: string;
  description?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  status: 'active' | 'inactive' | 'discontinued' | 'pending_approval';
  isActive: boolean;
  isExclusive: boolean;
}

export interface Product {
  _id: string;
  name: string;
  sku: string;
  description?: string;
  category: ProductCategory;
  brand?: Brand;
  unitOfMeasurement: UnitOfMeasurement;
  containerType?: ContainerType;
  quantity: number;
  reorderPoint: number;
  currentStock: number;
  totalQuantity?: number;
  availableStock: number;
  reservedStock: number;
  costPrice: number;
  sellingPrice: number;
  status: 'active' | 'inactive';
  isActive: boolean;
  expiryDate?: string | Date;
  containerCapacity: number;
  containers?: {
    full: number;
    partial: number;
    partialQuantity: number;
  };
  bundleInfo?: BundleInfo;
  createdAt: string | Date;
  updatedAt: string | Date;
  // Additional properties from Mongoose schema
  supplierId?: string | { _id: string; [key: string]: unknown };
  unitName?: string; // Direct text entry for CSV imports and legacy data
  discountFlags?: {
    discountableForAll?: boolean;
    discountableForMembers?: boolean;
    discountableInBlends?: boolean;
  };
  averageRestockQuantity?: number;
  restockCount?: number;
  restockFrequency?: number;
  // Methods that may exist on Mongoose document
  updateRestockAnalytics?: (quantity: number) => Promise<void>;
  getSuggestedRestockQuantity?: () => number;
}

export interface ContainerType {
  id: string;
  _id?: string;
  name: string;
  description: string;
  isActive: boolean;
  allowedUoms: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DosageForm {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface BundleInfo {
  hasBundle: boolean;
  bundlePrice?: number;
  bundleItems?: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface ProductFormData {
  name: string;
  description?: string;
  category: ProductCategory;
  brand?: Brand;
  unitOfMeasurement: UnitOfMeasurement;
  containerType?: ContainerType;
  quantity: number;
  reorderPoint: number;
  currentStock: number;
  totalQuantity?: number;
  costPrice: number;
  sellingPrice: number;
  status: 'active' | 'inactive';
  expiryDate?: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  notes?: string;
  createdAt: string | Date;
}

export interface StockAlert {
  id: string;
  productId: string;
  alertType: 'low_stock' | 'out_of_stock' | 'expired' | 'expiring_soon';
  currentLevel: number;
  threshold: number;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  createdAt: string;
}

export interface StockAdditionData {
  productId: string;
  quantity: number;
  batchNumber?: string;
  notes?: string;
}

export interface ProductTemplate {
  _id: string;
  name: string;
  sku: string;
  category: {
    _id: string;
    name: string;
  };
  brand?: {
    _id: string;
    name: string;
  };
  currentStock: number;
  unitOfMeasurement: {
    _id: string;
    name: string;
    abbreviation: string;
  };
  sellingPrice: number;
  costPrice: number;
}

export type ProductAdditionMethod = 'template' | 'new';

export interface StockMovement {
  productId: string;
  quantity: number;
  type: 'addition' | 'removal';
  reason: string;
  userId?: string;
  timestamp: Date;
  batchNumber?: string;
  notes?: string;
}