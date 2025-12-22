import apiClient from '@/lib/api-client'
import type { Product, ProductCategory, StockAlert } from '@/types/inventory'

export interface InventoryAnalysisResponse {
  inventoryData: Product[]
  categoryData: ProductCategory[]
  stockStatus: StockAlert[]
}

export const inventoryService = {
  async getInventoryAnalysis(): Promise<InventoryAnalysisResponse> {
    const response = await apiClient.get<InventoryAnalysisResponse>('/reports/inventory-analysis')
    if (!response.ok) {
      throw new Error(response.error || 'Failed to fetch inventory analysis')
    }
    return response.data!
  },

  async getInventoryItem(id: string): Promise<Product> {
    const response = await apiClient.get<Product>(`/inventory/products/${id}`)
    if (!response.ok) {
      throw new Error(response.error || 'Failed to fetch inventory item')
    }
    return response.data!
  },

  async updateInventoryStock(id: string, quantity: number): Promise<Product> {
    const response = await apiClient.post<Product>('/inventory/products/add-stock', {
      productId: id,
      quantity
    })
    if (!response.ok) {
      throw new Error(response.error || 'Failed to update inventory stock')
    }
    return response.data!
  }
}