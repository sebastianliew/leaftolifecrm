// Shared types for consistent frontend/backend communication
export interface CategoryBase {
  name: string;
  description?: string;
  level: number;
}

// Frontend representation of a category
export interface ProductCategory extends CategoryBase {
  id: string;
  _id?: string;
  isActive: boolean;
  parent?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

// API request/response types
export interface CreateCategoryRequest {
  name: string;
  description?: string;
  parent?: string;
}

export interface UpdateCategoryRequest {
  id: string;
  name?: string;
  description?: string;
  parent?: string;
}

export type CategoryResponse = ProductCategory;

export interface CategoriesResponse {
  categories: ProductCategory[];
  total?: number;
  page?: number;
  limit?: number;
}

// Filter and sort types
export interface CategoryFilters {
  search?: string;
  level?: number;
  isActive?: boolean;
  parent?: string;
}

export interface CategorySort {
  field: 'name' | 'description' | 'level' | 'createdAt' | 'updatedAt';
  order: 'asc' | 'desc';
}