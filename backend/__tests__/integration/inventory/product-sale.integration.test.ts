import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { TransactionInventoryService } from '../../../services/TransactionInventoryService.js';
import { clearCollections } from '../../setup/mongodb-memory-server.js';
import {
  createTestProduct,
  createTestProductWithContainers,
  createTestUnit,
  createTestTransactionItem,
  createTestTransaction,
  Product,
  InventoryMovement,
  resetCounter
} from '../../setup/test-fixtures.js';

describe('Product Sale Integration', () => {
  let service: TransactionInventoryService;

  beforeEach(async () => {
    await clearCollections();
    resetCounter();
    service = new TransactionInventoryService();
  });

  describe('Full End-to-End Transaction Flow', () => {
    it('should complete full transaction cycle: create -> verify deduction -> cancel -> verify restoration', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProduct({
        name: 'Lavender Essential Oil',
        currentStock: 100,
        unitOfMeasurement: unit._id
      });

      const transactionNumber = 'TXN-E2E-001';
      const item = createTestTransactionItem({
        productId: product._id.toString(),
        name: product.name,
        quantity: 25,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'product',
        saleType: 'quantity',
        unitPrice: 30,
        totalPrice: 750
      });

      const transaction = createTestTransaction([item], { transactionNumber });

      // Act 1: Process transaction
      const saleResult = await service.processTransactionInventory(
        transaction as any,
        'cashier-001'
      );

      // Assert 1: Stock deducted
      expect(saleResult.success).toBe(true);
      let currentProduct = await Product.findById(product._id);
      expect(currentProduct!.currentStock).toBe(75);

      // Verify movement created
      const saleMovements = await InventoryMovement.find({
        reference: transactionNumber,
        movementType: 'sale'
      });
      expect(saleMovements).toHaveLength(1);
      expect(saleMovements[0].quantity).toBe(25);

      // Act 2: Cancel transaction (reverse)
      const cancelResult = await service.reverseTransactionInventory(
        transactionNumber,
        'manager-001'
      );

      // Assert 2: Stock restored
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.reversedCount).toBe(1);

      currentProduct = await Product.findById(product._id);
      expect(currentProduct!.currentStock).toBe(100); // Back to original

      // Verify return movement created
      const returnMovements = await InventoryMovement.find({
        reference: `CANCEL-${transactionNumber}`,
        movementType: 'return'
      });
      expect(returnMovements).toHaveLength(1);
    });

    it('should handle multiple products in single transaction', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product1 = await createTestProduct({
        name: 'Tea Tree Oil',
        currentStock: 50,
        unitOfMeasurement: unit._id
      });
      const product2 = await createTestProduct({
        name: 'Eucalyptus Oil',
        currentStock: 80,
        unitOfMeasurement: unit._id
      });
      const product3 = await createTestProduct({
        name: 'Peppermint Oil',
        currentStock: 30,
        unitOfMeasurement: unit._id
      });

      const items = [
        createTestTransactionItem({
          productId: product1._id.toString(),
          name: product1.name,
          quantity: 10,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'product',
          saleType: 'quantity'
        }),
        createTestTransactionItem({
          productId: product2._id.toString(),
          name: product2.name,
          quantity: 15,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'product',
          saleType: 'quantity'
        }),
        createTestTransactionItem({
          productId: product3._id.toString(),
          name: product3.name,
          quantity: 5,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'product',
          saleType: 'quantity'
        })
      ];

      const transaction = createTestTransaction(items);

      // Act
      const result = await service.processTransactionInventory(
        transaction as any,
        'test-user'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.movements).toHaveLength(3);

      const updatedProduct1 = await Product.findById(product1._id);
      const updatedProduct2 = await Product.findById(product2._id);
      const updatedProduct3 = await Product.findById(product3._id);

      expect(updatedProduct1!.currentStock).toBe(40); // 50 - 10
      expect(updatedProduct2!.currentStock).toBe(65); // 80 - 15
      expect(updatedProduct3!.currentStock).toBe(25); // 30 - 5
    });

    it('should track complete inventory movement history for a product', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProduct({
        name: 'Lemon Oil',
        currentStock: 100,
        unitOfMeasurement: unit._id
      });

      // Act: Multiple transactions
      for (let i = 1; i <= 3; i++) {
        const item = createTestTransactionItem({
          productId: product._id.toString(),
          name: product.name,
          quantity: 10 * i, // 10, 20, 30
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'product',
          saleType: 'quantity'
        });

        const transaction = createTestTransaction([item], {
          transactionNumber: `TXN-HISTORY-${i}`
        });

        await service.processTransactionInventory(transaction as any, `user-${i}`);
      }

      // Assert
      const movements = await InventoryMovement.find({
        productId: product._id
      }).sort({ createdAt: 1 });

      expect(movements).toHaveLength(3);
      expect(movements[0].quantity).toBe(10);
      expect(movements[1].quantity).toBe(20);
      expect(movements[2].quantity).toBe(30);

      const finalProduct = await Product.findById(product._id);
      expect(finalProduct!.currentStock).toBe(40); // 100 - 10 - 20 - 30
    });
  });

  describe('Container-Based Sales Integration', () => {
    it('should track bottle usage across multiple transactions', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        name: 'Premium Rose Oil',
        containerCapacity: 50, // 50ml bottles
        fullContainers: 5,
        partialContainers: [],
        unitOfMeasurement: unit._id
      });

      // Act 1: First sale opens a new bottle
      const item1 = createTestTransactionItem({
        productId: product._id.toString(),
        name: product.name,
        quantity: 10,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'product',
        saleType: 'volume'
      });

      const txn1 = createTestTransaction([item1], { transactionNumber: 'TXN-BOTTLE-1' });
      await service.processTransactionInventory(txn1 as any, 'user-1');

      // Assert 1
      let currentProduct = await Product.findById(product._id);
      expect(currentProduct!.containers.full).toBe(4); // One opened
      expect(currentProduct!.containers.partial).toHaveLength(1);
      expect(currentProduct!.containers.partial[0].remaining).toBe(40); // 50 - 10

      // Act 2: Second sale from same bottle
      const item2 = createTestTransactionItem({
        productId: product._id.toString(),
        name: product.name,
        quantity: 25,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'product',
        saleType: 'volume'
      });

      // Refetch product for fresh state
      currentProduct = await Product.findById(product._id);
      const txn2 = createTestTransaction([item2], { transactionNumber: 'TXN-BOTTLE-2' });
      await service.processTransactionInventory(txn2 as any, 'user-2');

      // Assert 2
      currentProduct = await Product.findById(product._id);
      expect(currentProduct!.containers.partial[0].remaining).toBe(15); // 40 - 25
      expect(currentProduct!.containers.partial[0].saleHistory).toHaveLength(2);

      // Act 3: Third sale continues from same bottle
      const item3 = createTestTransactionItem({
        productId: product._id.toString(),
        name: product.name,
        quantity: 10,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'product',
        saleType: 'volume'
      });

      const txn3 = createTestTransaction([item3], { transactionNumber: 'TXN-BOTTLE-3' });
      await service.processTransactionInventory(txn3 as any, 'user-3');

      // Assert 3: Bottle now has 5ml remaining
      currentProduct = await Product.findById(product._id);
      expect(currentProduct!.containers.partial[0].remaining).toBe(5); // 15 - 10
      expect(currentProduct!.containers.partial[0].saleHistory).toHaveLength(3);
      expect(currentProduct!.containers.full).toBe(4); // No new bottle opened
    });

    it('should preserve container history for audit purposes', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProductWithContainers({
        containerCapacity: 100,
        fullContainers: 1,
        partialContainers: [
          { id: 'AUDIT-BOTTLE-001', remaining: 75 }
        ],
        unitOfMeasurement: unit._id
      });

      // Act: Multiple sales with different users
      const sales = [
        { qty: 10, ref: 'TXN-AUDIT-1', user: 'alice' },
        { qty: 15, ref: 'TXN-AUDIT-2', user: 'bob' },
        { qty: 20, ref: 'TXN-AUDIT-3', user: 'charlie' }
      ];

      for (const sale of sales) {
        const item = createTestTransactionItem({
          productId: product._id.toString(),
          name: product.name,
          quantity: sale.qty,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'product',
          saleType: 'volume'
        });

        const txn = createTestTransaction([item], { transactionNumber: sale.ref });
        await service.processTransactionInventory(txn as any, sale.user);
      }

      // Assert: Check sale history
      const finalProduct = await Product.findById(product._id);
      const bottle = finalProduct!.containers.partial[0];

      expect(bottle.remaining).toBe(30); // 75 - 10 - 15 - 20
      expect(bottle.saleHistory).toHaveLength(3);

      // Verify each sale is recorded
      expect(bottle.saleHistory![0].transactionRef).toBe('TXN-AUDIT-1');
      expect(bottle.saleHistory![0].quantitySold).toBe(10);
      expect(bottle.saleHistory![0].soldBy).toBe('alice');

      expect(bottle.saleHistory![1].transactionRef).toBe('TXN-AUDIT-2');
      expect(bottle.saleHistory![1].quantitySold).toBe(15);
      expect(bottle.saleHistory![1].soldBy).toBe('bob');

      expect(bottle.saleHistory![2].transactionRef).toBe('TXN-AUDIT-3');
      expect(bottle.saleHistory![2].quantitySold).toBe(20);
      expect(bottle.saleHistory![2].soldBy).toBe('charlie');
    });
  });

  describe('Overselling Scenarios', () => {
    it('should allow overselling and track negative stock', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProduct({
        name: 'Limited Stock Oil',
        currentStock: 5,
        unitOfMeasurement: unit._id
      });

      const item = createTestTransactionItem({
        productId: product._id.toString(),
        name: product.name,
        quantity: 20, // More than available
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'product',
        saleType: 'quantity'
      });

      const transaction = createTestTransaction([item]);

      // Act
      const result = await service.processTransactionInventory(
        transaction as any,
        'test-user'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const finalProduct = await Product.findById(product._id);
      expect(finalProduct!.currentStock).toBe(-15); // Negative stock allowed
    });

    it('should properly restore oversold stock on cancellation', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProduct({
        name: 'Oversold Oil',
        currentStock: 3,
        unitOfMeasurement: unit._id
      });

      const transactionNumber = 'TXN-OVERSOLD-001';
      const item = createTestTransactionItem({
        productId: product._id.toString(),
        name: product.name,
        quantity: 10,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'product',
        saleType: 'quantity'
      });

      const transaction = createTestTransaction([item], { transactionNumber });

      // Act: Sell and then cancel
      await service.processTransactionInventory(transaction as any, 'test-user');

      let currentProduct = await Product.findById(product._id);
      expect(currentProduct!.currentStock).toBe(-7); // Oversold

      await service.reverseTransactionInventory(transactionNumber, 'test-user');

      // Assert
      currentProduct = await Product.findById(product._id);
      expect(currentProduct!.currentStock).toBe(3); // Restored to original
    });
  });
});
