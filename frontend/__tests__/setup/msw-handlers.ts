import { http, HttpResponse } from 'msw';

// Base URL for API requests
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Mock product data
export const mockProducts = [
  {
    _id: 'product-1',
    name: 'Lavender Essential Oil',
    sku: 'LAV-001',
    currentStock: 100,
    availableStock: 100,
    sellingPrice: 25.00,
    costPrice: 10.00,
    reorderPoint: 10,
    isActive: true,
    status: 'active',
    unitOfMeasurement: { _id: 'unit-1', name: 'ml', abbreviation: 'ml' },
    category: { _id: 'cat-1', name: 'Essential Oils' },
    containerCapacity: 50,
    containers: { full: 2, partial: [] }
  },
  {
    _id: 'product-2',
    name: 'Peppermint Essential Oil',
    sku: 'PEP-001',
    currentStock: 8, // Low stock
    availableStock: 8,
    sellingPrice: 30.00,
    costPrice: 12.00,
    reorderPoint: 10,
    isActive: true,
    status: 'active',
    unitOfMeasurement: { _id: 'unit-1', name: 'ml', abbreviation: 'ml' },
    category: { _id: 'cat-1', name: 'Essential Oils' },
    containerCapacity: 50,
    containers: { full: 0, partial: [{ id: 'BOTTLE-1', remaining: 8, capacity: 50, status: 'partial' }] }
  },
  {
    _id: 'product-3',
    name: 'Tea Tree Essential Oil',
    sku: 'TEA-001',
    currentStock: 0, // Out of stock
    availableStock: 0,
    sellingPrice: 22.00,
    costPrice: 9.00,
    reorderPoint: 10,
    isActive: true,
    status: 'active',
    unitOfMeasurement: { _id: 'unit-1', name: 'ml', abbreviation: 'ml' },
    category: { _id: 'cat-1', name: 'Essential Oils' },
    containerCapacity: 50,
    containers: { full: 0, partial: [] }
  }
];

// Mock transaction data
export const mockTransaction = {
  _id: 'txn-1',
  transactionNumber: 'TXN-20260108-0001',
  type: 'COMPLETED',
  status: 'completed',
  customerName: 'Test Customer',
  items: [
    {
      productId: 'product-1',
      name: 'Lavender Essential Oil',
      quantity: 5,
      unitPrice: 25,
      totalPrice: 125,
      itemType: 'product',
      saleType: 'quantity'
    }
  ],
  subtotal: 125,
  totalAmount: 125,
  discountAmount: 0,
  paymentMethod: 'cash',
  paymentStatus: 'paid',
  createdAt: new Date().toISOString()
};

// Request handlers
export const handlers = [
  // Get all inventory products
  http.get(`${API_BASE}/inventory/products`, ({ request }) => {
    const url = new URL(request.url);
    const alertsOnly = url.searchParams.get('alertsOnly');

    let products = [...mockProducts];

    if (alertsOnly === 'true') {
      products = products.filter(p => p.currentStock <= p.reorderPoint);
    }

    return HttpResponse.json({
      success: true,
      data: {
        products,
        pagination: {
          total: products.length,
          page: 1,
          limit: 50,
          pages: 1
        }
      }
    });
  }),

  // Get single product
  http.get(`${API_BASE}/inventory/products/:id`, ({ params }) => {
    const product = mockProducts.find(p => p._id === params.id);

    if (!product) {
      return HttpResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: product
    });
  }),

  // Create transaction
  http.post(`${API_BASE}/transactions`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;

    return HttpResponse.json({
      success: true,
      data: {
        _id: 'new-txn-id',
        transactionNumber: 'TXN-20260108-0002',
        ...body,
        createdAt: new Date().toISOString()
      }
    }, { status: 201 });
  }),

  // Get inventory stats
  http.get(`${API_BASE}/inventory/stats`, () => {
    const totalProducts = mockProducts.length;
    const lowStockProducts = mockProducts.filter(p => p.currentStock <= p.reorderPoint && p.currentStock > 0);
    const outOfStockProducts = mockProducts.filter(p => p.currentStock === 0);
    const optimalProducts = mockProducts.filter(p => p.currentStock > p.reorderPoint);

    return HttpResponse.json({
      success: true,
      data: {
        totalProducts,
        totalValue: mockProducts.reduce((sum, p) => sum + (p.currentStock * p.costPrice), 0),
        lowStock: {
          count: lowStockProducts.length,
          products: lowStockProducts
        },
        outOfStock: {
          count: outOfStockProducts.length,
          products: outOfStockProducts
        },
        optimal: {
          count: optimalProducts.length
        }
      }
    });
  }),

  // Get inventory movements
  http.get(`${API_BASE}/inventory/movements`, ({ request }) => {
    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');

    return HttpResponse.json({
      success: true,
      data: {
        movements: [
          {
            _id: 'mov-1',
            productId: productId || 'product-1',
            movementType: 'sale',
            quantity: 5,
            reference: 'TXN-20260108-0001',
            createdAt: new Date().toISOString()
          }
        ],
        pagination: { total: 1, page: 1, limit: 50, pages: 1 }
      }
    });
  })
];

// Function to update mock products (for testing stock updates)
export function updateMockProductStock(productId: string, newStock: number) {
  const product = mockProducts.find(p => p._id === productId);
  if (product) {
    product.currentStock = newStock;
    product.availableStock = newStock;
  }
}

// Function to reset mock products to default
export function resetMockProducts() {
  mockProducts[0].currentStock = 100;
  mockProducts[0].availableStock = 100;
  mockProducts[1].currentStock = 8;
  mockProducts[1].availableStock = 8;
  mockProducts[2].currentStock = 0;
  mockProducts[2].availableStock = 0;
}
