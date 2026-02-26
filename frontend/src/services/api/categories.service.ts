import { fetchAPI } from "@/lib/query-client";
import type { 
  ProductCategory, 
  CreateCategoryRequest, 
  UpdateCategoryRequest,
  CategoriesResponse,
  CategoryFilters,
  CategorySort 
} from "@/types/inventory/category.types";

class CategoriesService {
  private readonly baseEndpoint = "/inventory/categories";

  /**
   * Fetch all categories with optional filters and sorting
   */
  async getCategories(
    filters?: CategoryFilters, 
    sort?: CategorySort
  ): Promise<ProductCategory[]> {
    const params = new URLSearchParams();
    
    // Fetch all categories — frontend handles filtering/sorting/pagination client-side
    params.append('limit', '5000');
    
    if (filters?.search) {
      params.append('search', filters.search);
    }
    if (filters?.level !== undefined) {
      params.append('level', filters.level.toString());
    }
    if (filters?.isActive !== undefined) {
      params.append('isActive', filters.isActive.toString());
    }
    if (filters?.parent) {
      params.append('parent', filters.parent);
    }
    if (sort) {
      params.append('sortBy', sort.field);
      params.append('order', sort.order);
    }

    const queryString = params.toString();
    const endpoint = queryString ? `${this.baseEndpoint}?${queryString}` : this.baseEndpoint;
    
    try {
      const response = await fetchAPI<ProductCategory[] | CategoriesResponse>(endpoint);
      
      // Handle both array response and object response with categories property
      const categories = Array.isArray(response) ? response : response.categories || [];
      
      // Transform MongoDB _id to id for frontend consistency
      return categories.map(category => ({
        ...category,
        id: category._id || category.id
      }));
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      throw new Error('Failed to fetch categories');
    }
  }

  /**
   * Get a single category by ID
   */
  async getCategoryById(id: string): Promise<ProductCategory> {
    try {
      return await fetchAPI<ProductCategory>(`${this.baseEndpoint}/${id}`);
    } catch (error) {
      console.error(`Failed to fetch category ${id}:`, error);
      throw new Error(`Failed to fetch category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new category
   */
  async createCategory(data: CreateCategoryRequest): Promise<ProductCategory> {
    return await fetchAPI<ProductCategory>(this.baseEndpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing category
   */
  async updateCategory({ id, ...data }: UpdateCategoryRequest): Promise<ProductCategory> {
    return await fetchAPI<ProductCategory>(`${this.baseEndpoint}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<void> {
    await fetchAPI<{ message: string }>(`${this.baseEndpoint}/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get categories by parent (for hierarchical categories)
   */
  async getCategoriesByParent(parentId: string): Promise<ProductCategory[]> {
    return this.getCategories({ parent: parentId });
  }

  /**
   * Get root categories (no parent)
   */
  async getRootCategories(): Promise<ProductCategory[]> {
    return this.getCategories({ level: 1 });
  }
}

// Export singleton instance
export const categoriesService = new CategoriesService();
export default categoriesService;