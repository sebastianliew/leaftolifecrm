import { describe, it, expect, beforeEach } from '@jest/globals';
import { clearCollections } from '../../setup/mongodb-memory-server.js';
import {
  createTestProductWithContainers,
  createTestUnit,
  resetCounter
} from '../../setup/test-fixtures.js';

describe('Product Model', () => {
  beforeEach(async () => {
    await clearCollections();
    resetCounter();
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
