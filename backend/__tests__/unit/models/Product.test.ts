import { describe, it, expect, beforeEach } from '@jest/globals';
import { clearCollections } from '../../setup/mongodb-memory-server.js';
import {
  createTestProductWithContainers,
  createTestUnit,
  Product,
  resetCounter
} from '../../setup/test-fixtures.js';

describe('Product Model', () => {
  beforeEach(async () => {
    await clearCollections();
    resetCounter();
  });

  describe('handlePartialContainerSale', () => {
    it('should deduct from first non-empty partial container (FIFO)', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 1,
        partialContainers: [
          { id: 'BOTTLE_001', remaining: 30 },
          { id: 'BOTTLE_002', remaining: 80 }
        ],
        unitOfMeasurement: unit._id
      });

      // Act
      await product.handlePartialContainerSale(10);

      // Assert
      const updated = await Product.findById(product._id);
      expect(updated!.containers.partial[0].remaining).toBe(20); // BOTTLE_001 deducted
      expect(updated!.containers.partial[1].remaining).toBe(80); // BOTTLE_002 unchanged
    });

    it('should record sale history with transaction details', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 0,
        partialContainers: [
          { id: 'BOTTLE_001', remaining: 50 }
        ],
        unitOfMeasurement: unit._id
      });

      // Act
      await product.handlePartialContainerSale(15, {
        transactionRef: 'TXN-123',
        userId: 'user-456'
      });

      // Assert
      const updated = await Product.findById(product._id);
      const saleHistory = updated!.containers.partial[0].saleHistory;

      expect(saleHistory).toHaveLength(1);
      expect(saleHistory![0].transactionRef).toBe('TXN-123');
      expect(saleHistory![0].quantitySold).toBe(15);
      expect(saleHistory![0].soldBy).toBe('user-456');
      expect(saleHistory![0].soldAt).toBeDefined();
    });

    it('should open new bottle when no partial containers available', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 3,
        partialContainers: [],
        unitOfMeasurement: unit._id
      });

      // Act
      await product.handlePartialContainerSale(25);

      // Assert
      const updated = await Product.findById(product._id);
      expect(updated!.containers.full).toBe(2); // One bottle opened
      expect(updated!.containers.partial).toHaveLength(1);
      expect(updated!.containers.partial[0].remaining).toBe(75); // 100 - 25
      expect(updated!.containers.partial[0].status).toBe('partial');
      expect(updated!.containers.partial[0].openedAt).toBeDefined();
    });

    it('should create oversold container when no stock available', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 0,
        partialContainers: [],
        unitOfMeasurement: unit._id
      });

      // Act
      await product.handlePartialContainerSale(30);

      // Assert
      const updated = await Product.findById(product._id);
      expect(updated!.containers.partial).toHaveLength(1);
      expect(updated!.containers.partial[0].status).toBe('oversold');
      expect(updated!.containers.partial[0].remaining).toBe(-30);
    });

    it('should use targeted container when containerId is specified', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 0,
        partialContainers: [
          { id: 'BOTTLE_A', remaining: 50 },
          { id: 'BOTTLE_B', remaining: 70 }
        ],
        unitOfMeasurement: unit._id
      });

      // Act
      await product.handlePartialContainerSale(20, { containerId: 'BOTTLE_B' });

      // Assert
      const updated = await Product.findById(product._id);
      expect(updated!.containers.partial[0].remaining).toBe(50); // BOTTLE_A unchanged
      expect(updated!.containers.partial[1].remaining).toBe(50); // BOTTLE_B deducted
    });

    it('should skip empty containers when using FIFO', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 0,
        partialContainers: [
          { id: 'BOTTLE_EMPTY', remaining: 0, status: 'empty' },
          { id: 'BOTTLE_PARTIAL', remaining: 50 }
        ],
        unitOfMeasurement: unit._id
      });

      // Act
      await product.handlePartialContainerSale(10);

      // Assert
      const updated = await Product.findById(product._id);
      expect(updated!.containers.partial[0].remaining).toBe(0); // Empty unchanged
      expect(updated!.containers.partial[1].remaining).toBe(40); // Partial deducted
    });

    it('should mark container as empty when fully consumed', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 0,
        partialContainers: [
          { id: 'BOTTLE_001', remaining: 20 }
        ],
        unitOfMeasurement: unit._id
      });

      // Act
      await product.handlePartialContainerSale(20);

      // Assert
      const updated = await Product.findById(product._id);
      expect(updated!.containers.partial[0].remaining).toBe(0);
      expect(updated!.containers.partial[0].status).toBe('empty');
    });

    it('should update currentStock after partial sale', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 2, // 200ml
        partialContainers: [
          { id: 'BOTTLE_001', remaining: 50 } // 50ml
        ],
        unitOfMeasurement: unit._id
      });

      const initialStock = product.currentStock;
      expect(initialStock).toBe(250); // 200 + 50

      // Act
      await product.handlePartialContainerSale(30);

      // Assert
      const updated = await Product.findById(product._id);
      expect(updated!.currentStock).toBe(220); // 250 - 30
    });

    it('should handle multiple consecutive sales from same bottle', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 0,
        partialContainers: [
          { id: 'BOTTLE_001', remaining: 80 }
        ],
        unitOfMeasurement: unit._id
      });

      // Act - Multiple sales
      await product.handlePartialContainerSale(20, { transactionRef: 'TXN-1' });

      // Refetch product
      const updatedProduct = await Product.findById(product._id);
      await updatedProduct!.handlePartialContainerSale(30, { transactionRef: 'TXN-2' });

      const finalProduct = await Product.findById(product._id);
      await finalProduct!.handlePartialContainerSale(15, { transactionRef: 'TXN-3' });

      // Assert
      const result = await Product.findById(product._id);
      expect(result!.containers.partial[0].remaining).toBe(15); // 80 - 20 - 30 - 15
      expect(result!.containers.partial[0].saleHistory).toHaveLength(3);
    });
  });

  describe('handleFullContainerSale', () => {
    it('should decrement full container count', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 5,
        partialContainers: [],
        unitOfMeasurement: unit._id
      });

      // Act
      await product.handleFullContainerSale();

      // Assert
      const updated = await Product.findById(product._id);
      expect(updated!.containers.full).toBe(4);
    });

    it('should allow negative container count for overselling', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 0,
        partialContainers: [],
        unitOfMeasurement: unit._id
      });

      // Act
      await product.handleFullContainerSale();

      // Assert
      const updated = await Product.findById(product._id);
      expect(updated!.containers.full).toBe(-1);
    });

    it('should update currentStock after full container sale', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 3,
        partialContainers: [],
        unitOfMeasurement: unit._id
      });

      const initialStock = product.currentStock;
      expect(initialStock).toBe(300);

      // Act
      await product.handleFullContainerSale();

      // Assert
      const updated = await Product.findById(product._id);
      expect(updated!.currentStock).toBe(200); // 300 - 100
    });
  });

  describe('totalStock virtual property', () => {
    it('should calculate total stock from full and partial containers', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 3, // 300ml
        partialContainers: [
          { id: 'BOTTLE_1', remaining: 45 },
          { id: 'BOTTLE_2', remaining: 30 }
        ],
        unitOfMeasurement: unit._id
      });

      // Assert
      expect(product.currentStock).toBe(375); // 300 + 45 + 30
    });

    it('should handle empty partial containers in calculation', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 2,
        partialContainers: [
          { id: 'BOTTLE_1', remaining: 0, status: 'empty' },
          { id: 'BOTTLE_2', remaining: 25 }
        ],
        unitOfMeasurement: unit._id
      });

      // Assert - should only count non-negative remaining
      expect(product.currentStock).toBe(225); // 200 + 0 + 25
    });

    it('should handle negative stock (oversold)', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 0,
        partialContainers: [
          { id: 'OVERSOLD', remaining: -50, status: 'oversold' }
        ],
        unitOfMeasurement: unit._id
      });

      // Assert - negative remaining counts as 0 in total
      expect(product.currentStock).toBe(0);
    });
  });

  describe('needsRestock', () => {
    it('should return true when currentStock is below reorderPoint', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 0,
        partialContainers: [{ id: 'LOW', remaining: 5 }],
        unitOfMeasurement: unit._id
      });
      // Manually set reorderPoint since fixture sets it to 10
      product.reorderPoint = 10;
      await product.save();

      // Assert
      expect(product.needsRestock()).toBe(true);
    });

    it('should return false when currentStock is above reorderPoint', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 1,
        partialContainers: [],
        unitOfMeasurement: unit._id
      });
      product.reorderPoint = 10;
      await product.save();

      // Assert
      expect(product.needsRestock()).toBe(false);
    });
  });

  describe('needsUrgentRestock', () => {
    it('should return true when stock is zero', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 0,
        partialContainers: [],
        unitOfMeasurement: unit._id
      });

      // Assert
      expect(product.needsUrgentRestock()).toBe(true);
    });

    it('should return true when stock is below half reorderPoint', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 0,
        partialContainers: [{ id: 'LOW', remaining: 4 }],
        unitOfMeasurement: unit._id
      });
      product.reorderPoint = 10;
      await product.save();

      // Assert
      expect(product.needsUrgentRestock()).toBe(true);
    });
  });
});
