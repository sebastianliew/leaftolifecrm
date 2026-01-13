import React from 'react';
import { render, screen } from '../../setup/test-utils';

// Mock product data directly in tests (instead of MSW)
const mockProducts = [
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
    containerCapacity: 50,
    containers: { full: 2, partial: [] as Array<{ id: string; remaining: number; capacity: number; status: string }> }
  },
  {
    _id: 'product-2',
    name: 'Peppermint Essential Oil',
    sku: 'PEP-001',
    currentStock: 8,
    availableStock: 8,
    sellingPrice: 30.00,
    costPrice: 12.00,
    reorderPoint: 10,
    isActive: true,
    status: 'active',
    containerCapacity: 50,
    containers: { full: 0, partial: [{ id: 'BOTTLE-1', remaining: 8, capacity: 50, status: 'partial' }] }
  },
  {
    _id: 'product-3',
    name: 'Tea Tree Essential Oil',
    sku: 'TEA-001',
    currentStock: 0,
    availableStock: 0,
    sellingPrice: 22.00,
    costPrice: 9.00,
    reorderPoint: 10,
    isActive: true,
    status: 'active',
    containerCapacity: 50,
    containers: { full: 0, partial: [] as Array<{ id: string; remaining: number; capacity: number; status: string }> }
  }
];

// Helper function to update mock product stock
function updateMockProductStock(productId: string, newStock: number) {
  const product = mockProducts.find(p => p._id === productId);
  if (product) {
    product.currentStock = newStock;
    product.availableStock = newStock;
  }
}

// Helper function to reset mock products
function resetMockProducts() {
  mockProducts[0].currentStock = 100;
  mockProducts[0].availableStock = 100;
  mockProducts[1].currentStock = 8;
  mockProducts[1].availableStock = 8;
  mockProducts[2].currentStock = 0;
  mockProducts[2].availableStock = 0;
}

// Simple component for testing inventory data display
function InventoryStockDisplay({ products }: { products: typeof mockProducts }) {
  return (
    <div data-testid="inventory-list">
      {products.map((product) => (
        <div key={product._id} data-testid={`product-${product._id}`} className="product-row">
          <span data-testid={`product-name-${product._id}`}>{product.name}</span>
          <span data-testid={`product-stock-${product._id}`}>{product.currentStock}</span>
          {product.currentStock === 0 && (
            <span data-testid={`out-of-stock-${product._id}`} className="out-of-stock">
              Out of Stock
            </span>
          )}
          {product.currentStock > 0 && product.currentStock <= product.reorderPoint && (
            <span data-testid={`low-stock-${product._id}`} className="low-stock">
              Low Stock
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

describe('Inventory Display', () => {
  afterEach(() => {
    resetMockProducts();
  });

  describe('Stock Level Display', () => {
    it('should display products with correct stock levels', () => {
      render(<InventoryStockDisplay products={mockProducts} />);

      // Check each product displays correct stock
      expect(screen.getByTestId('product-stock-product-1')).toHaveTextContent('100');
      expect(screen.getByTestId('product-stock-product-2')).toHaveTextContent('8');
      expect(screen.getByTestId('product-stock-product-3')).toHaveTextContent('0');
    });

    it('should show low stock warning for products below reorder point', () => {
      render(<InventoryStockDisplay products={mockProducts} />);

      // Peppermint has 8 stock with reorderPoint of 10 - should show low stock
      expect(screen.getByTestId('low-stock-product-2')).toBeInTheDocument();

      // Lavender has 100 stock - should NOT show low stock
      expect(screen.queryByTestId('low-stock-product-1')).not.toBeInTheDocument();
    });

    it('should show out of stock indicator for zero stock products', () => {
      render(<InventoryStockDisplay products={mockProducts} />);

      // Tea Tree has 0 stock - should show out of stock
      expect(screen.getByTestId('out-of-stock-product-3')).toBeInTheDocument();

      // Lavender has stock - should NOT show out of stock
      expect(screen.queryByTestId('out-of-stock-product-1')).not.toBeInTheDocument();
    });
  });

  describe('Stock Updates After Transaction', () => {
    it('should reflect updated stock values after sale', () => {
      // Initial render
      const { rerender } = render(<InventoryStockDisplay products={mockProducts} />);

      // Verify initial stock
      expect(screen.getByTestId('product-stock-product-1')).toHaveTextContent('100');

      // Simulate stock update (like after a transaction)
      updateMockProductStock('product-1', 90);

      // Re-render with updated data
      rerender(<InventoryStockDisplay products={mockProducts} />);

      // Verify updated stock
      expect(screen.getByTestId('product-stock-product-1')).toHaveTextContent('90');
    });

    it('should show low stock warning when stock drops below reorder point', () => {
      const { rerender } = render(<InventoryStockDisplay products={mockProducts} />);

      // Lavender initially has 100 stock - no warning
      expect(screen.queryByTestId('low-stock-product-1')).not.toBeInTheDocument();

      // Simulate stock dropping to 5 (below reorderPoint of 10)
      updateMockProductStock('product-1', 5);
      rerender(<InventoryStockDisplay products={mockProducts} />);

      // Should now show low stock warning
      expect(screen.getByTestId('low-stock-product-1')).toBeInTheDocument();
    });

    it('should show out of stock when stock reaches zero', () => {
      const { rerender } = render(<InventoryStockDisplay products={mockProducts} />);

      // Initially has stock
      expect(screen.queryByTestId('out-of-stock-product-1')).not.toBeInTheDocument();

      // Simulate stock reaching zero
      updateMockProductStock('product-1', 0);
      rerender(<InventoryStockDisplay products={mockProducts} />);

      // Should now show out of stock
      expect(screen.getByTestId('out-of-stock-product-1')).toBeInTheDocument();
    });
  });

  describe('Product Filtering by Stock Status', () => {
    it('should filter to show only low stock items', () => {
      const lowStockProducts = mockProducts.filter(
        p => p.currentStock > 0 && p.currentStock <= p.reorderPoint
      );

      render(<InventoryStockDisplay products={lowStockProducts} />);

      // Should only show Peppermint (low stock)
      expect(screen.getByTestId('product-product-2')).toBeInTheDocument();
      expect(screen.queryByTestId('product-product-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('product-product-3')).not.toBeInTheDocument();
    });

    it('should filter to show only out of stock items', () => {
      const outOfStockProducts = mockProducts.filter(p => p.currentStock === 0);

      render(<InventoryStockDisplay products={outOfStockProducts} />);

      // Should only show Tea Tree (out of stock)
      expect(screen.getByTestId('product-product-3')).toBeInTheDocument();
      expect(screen.queryByTestId('product-product-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('product-product-2')).not.toBeInTheDocument();
    });

    it('should filter to show only optimal stock items', () => {
      const optimalProducts = mockProducts.filter(p => p.currentStock > p.reorderPoint);

      render(<InventoryStockDisplay products={optimalProducts} />);

      // Should only show Lavender (optimal stock)
      expect(screen.getByTestId('product-product-1')).toBeInTheDocument();
      expect(screen.queryByTestId('product-product-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('product-product-3')).not.toBeInTheDocument();
    });
  });

  describe('Inventory Statistics', () => {
    it('should calculate correct stock status counts', () => {
      const stats = {
        total: mockProducts.length,
        lowStock: mockProducts.filter(p => p.currentStock > 0 && p.currentStock <= p.reorderPoint).length,
        outOfStock: mockProducts.filter(p => p.currentStock === 0).length,
        optimal: mockProducts.filter(p => p.currentStock > p.reorderPoint).length
      };

      expect(stats.total).toBe(3);
      expect(stats.lowStock).toBe(1); // Peppermint
      expect(stats.outOfStock).toBe(1); // Tea Tree
      expect(stats.optimal).toBe(1); // Lavender
    });

    it('should calculate total inventory value', () => {
      const totalValue = mockProducts.reduce(
        (sum, p) => sum + (p.currentStock * p.costPrice),
        0
      );

      // Lavender: 100 * 10 = 1000
      // Peppermint: 8 * 12 = 96
      // Tea Tree: 0 * 9 = 0
      expect(totalValue).toBe(1096);
    });

    it('should update statistics after stock change', () => {
      // Initial stats
      let lowStockCount = mockProducts.filter(
        p => p.currentStock > 0 && p.currentStock <= p.reorderPoint
      ).length;
      expect(lowStockCount).toBe(1);

      // Simulate Lavender stock dropping
      updateMockProductStock('product-1', 8);

      // Recalculate
      lowStockCount = mockProducts.filter(
        p => p.currentStock > 0 && p.currentStock <= p.reorderPoint
      ).length;

      // Now both Lavender and Peppermint are low stock
      expect(lowStockCount).toBe(2);
    });
  });

  describe('Container-Based Stock Display', () => {
    it('should display container information for products with bottles', () => {
      const product = mockProducts[0];

      // Lavender has 2 full bottles of 50ml capacity
      expect(product.containerCapacity).toBe(50);
      expect(product.containers.full).toBe(2);
      expect(product.containers.partial).toHaveLength(0);
    });

    it('should show partial bottle remaining quantity', () => {
      const product = mockProducts[1];

      // Peppermint has 1 partial bottle with 8ml remaining
      expect(product.containers.partial).toHaveLength(1);
      expect(product.containers.partial[0].remaining).toBe(8);
      expect(product.containers.partial[0].status).toBe('partial');
    });

    it('should calculate total stock from containers', () => {
      const product = mockProducts[0];

      // 2 full bottles * 50ml = 100ml
      const calculatedStock = (product.containers.full * product.containerCapacity) +
        product.containers.partial.reduce((sum, p) => sum + p.remaining, 0);

      expect(calculatedStock).toBe(100);
    });
  });
});
