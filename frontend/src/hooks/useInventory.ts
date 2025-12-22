"use client"

import { useState, useCallback } from "react"
import { apiClient } from "@/lib/api-client"
import type {
  Product,
  InventoryMovement,
  StockAlert,
  ProductFormData,
  StockAdditionData,
} from "@/types/inventory"

export function useInventory() {
  const [products, setProducts] = useState<Product[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getProducts = useCallback(async (includeInactive = false) => {
    setLoading(true)
    try {
      // Fetch with a higher limit to get all products
      const params: Record<string, string> = { limit: '1000' };
      if (includeInactive) params.includeInactive = 'true';

      const response = await apiClient.get('/inventory/products', params);

      if (!response.ok) {
        console.error('Failed to fetch products:', response.status, response.error)
        throw new Error(`HTTP ${response.status}: ${response.error}`)
      }

      const data = response.data as Product[] | { products: Product[], pagination?: { totalCount: number } }
      // Handle both array and object with products property
      const productsArray = Array.isArray(data) ? data : (data.products || [])
      const totalCount = Array.isArray(data) ? data.length : (data.pagination?.totalCount || productsArray.length)
      
      // Filter out any non-product items (e.g., consultation services)
      const validProducts = productsArray.filter((product: Product) => {
        // Ensure we only include actual inventory products
        return product._id && 
               product._id !== 'consultation-fee' && 
               product.sku && 
               product.currentStock !== undefined
      })
      
      setProducts(validProducts)
      setTotalCount(totalCount)
      setError(null)
      return validProducts
    } catch (err) {
      console.error('getProducts error:', err)
      setError("Failed to fetch products")
      setProducts([]) // Ensure we always have an array
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const getProduct = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const response = await apiClient.get(`/inventory/products/${id}`);
      if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch product')
      }
      setError(null)
      return response.data as Product
    } catch (err) {
      setError("Failed to fetch product")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const createProduct = useCallback(async (data: ProductFormData) => {
    setLoading(true)
    try {
      console.log('useInventory: Sending data to API:', data);
      const response = await apiClient.post('/inventory/products', data);
      console.log('useInventory: API response status:', response.status);

      if (!response.ok) {
        const errorMessage = response.error || 'Failed to create product';
        console.error('useInventory: API error response:', response.error);
        throw new Error(errorMessage);
      }

      const newProduct = response.data as Product;
      console.log('useInventory: Product created successfully:', newProduct);
      setProducts((prev) => [...prev, newProduct])
      setError(null)
      return newProduct
    } catch (err) {
      console.error('useInventory: Create product error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create product';
      setError(errorMessage);
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateProduct = useCallback(async (id: string, data: Partial<ProductFormData>) => {
    setLoading(true)
    try {
      const response = await apiClient.put(`/inventory/products/${id}`, data);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to update product')
      }

      const updatedProduct = response.data as Product;
      setProducts((prev) =>
        prev.map((product) => (product._id === id ? updatedProduct : product))
      )
      setError(null)
      return updatedProduct
    } catch (err) {
      setError("Failed to update product")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteProduct = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const response = await apiClient.delete(`/inventory/products/${id}`);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to delete product')
      }

      setProducts((prev) => prev.filter((product) => product._id !== id))
      setError(null)
    } catch (err) {
      setError("Failed to delete product")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const adjustStock = useCallback(async (productId: string, quantity: number, _reason: string) => {
    setLoading(true)
    try {
      const product = await getProduct(productId)
      const newCurrentStock = Math.max(0, product.currentStock + quantity)
      const updatedProduct = await updateProduct(productId, {
        currentStock: newCurrentStock,
      })
      setError(null)
      return updatedProduct
    } catch (err) {
      setError("Failed to adjust stock")
      throw err
    } finally {
      setLoading(false)
    }
  }, [getProduct, updateProduct])

  const getProductTemplates = useCallback(async (search?: string, page?: number, limit?: number) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (page) params.page = page.toString();
      if (limit) params.limit = limit.toString();

      const response = await apiClient.get('/inventory/products/templates', params);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch product templates')
      }

      setError(null)
      return response.data as Product[]
    } catch (err) {
      setError("Failed to fetch product templates")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const addStockToProduct = useCallback(async (data: StockAdditionData) => {
    setLoading(true)
    try {
      const response = await apiClient.post('/inventory/products/add-stock', data);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to add stock')
      }

      const result = response.data as { product: Product };

      // Update the products state with the updated product
      setProducts((prev) =>
        prev.map((product) =>
          product._id === data.productId ? result.product : product
        )
      )

      setError(null)
      return result
    } catch (err) {
      setError("Failed to add stock")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    products,
    totalCount,
    loading,
    error,
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    getProductTemplates,
    addStockToProduct,
  }
}

export function useInventoryMovements() {
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(false)

  const addMovement = useCallback(async (movement: Omit<InventoryMovement, "id" | "createdAt">) => {
    setLoading(true)
    try {
      const response = await apiClient.post('/inventory/movements', movement);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to add movement')
      }

      const newMovement = response.data as InventoryMovement;
      setMovements((prev) => [newMovement, ...prev])
      return newMovement
    } finally {
      setLoading(false)
    }
  }, [])

  const getMovements = useCallback(async (productId?: string) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {};
      if (productId) params.productId = productId;

      const response = await apiClient.get('/inventory/movements', params);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch movements')
      }

      const data = response.data as InventoryMovement[];
      setMovements(data)
      return data
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    movements,
    loading,
    addMovement,
    getMovements,
  }
}

export function useStockAlerts() {
  const [alerts, setAlerts] = useState<StockAlert[]>([])

  const generateAlerts = useCallback((products: Product[]) => {
    const newAlerts: StockAlert[] = []

    products.forEach((product) => {
      // Low stock alert
      if (product.currentStock <= product.reorderPoint && product.currentStock > 0) {
        newAlerts.push({
          id: `alert_${product._id}_low`,
          productId: product._id,
          alertType: "low_stock",
          currentLevel: product.currentStock,
          threshold: product.reorderPoint,
          message: `${product.name} is running low (${product.currentStock} remaining)`,
          priority: "medium",
          isActive: true,
          createdAt: new Date().toISOString(),
        })
      }

      // Out of stock alert
      if (product.currentStock === 0) {
        newAlerts.push({
          id: `alert_${product._id}_out`,
          productId: product._id,
          alertType: "out_of_stock",
          currentLevel: 0,
          threshold: 0,
          message: `${product.name} is out of stock`,
          priority: "high",
          isActive: true,
          createdAt: new Date().toISOString(),
        })
      }

      // Expired stock alert (only for already expired products)
      if (product.expiryDate) {
        const expiryDate = new Date(product.expiryDate)
        const today = new Date()
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysUntilExpiry < 0) {
          // Product is expired - this needs immediate attention
          newAlerts.push({
            id: `alert_${product._id}_expired`,
            productId: product._id,
            alertType: "expired",
            currentLevel: product.currentStock,
            threshold: 0,
            message: `${product.name} has expired (${Math.abs(daysUntilExpiry)} days ago)`,
            priority: "critical",
            isActive: true,
            createdAt: new Date().toISOString(),
          })
        }
        // Note: "expiring soon" alerts removed from individual alerts list
        // They are now shown as summary count in dashboard cards
      }

    })

    setAlerts(newAlerts)
    return newAlerts
  }, [])

  return {
    alerts,
    generateAlerts,
  }
}
