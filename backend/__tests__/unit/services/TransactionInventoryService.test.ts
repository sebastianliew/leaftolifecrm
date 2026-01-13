import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { TransactionInventoryService } from '../../../services/TransactionInventoryService.js';
import { clearCollections } from '../../setup/mongodb-memory-server.js';
import {
  createTestProduct,
  createTestProductWithContainers,
  createTestBlendTemplate,
  createTestBundle,
  createTestUnit,
  createTestTransactionItem,
  createTestTransaction,
  Product,
  BlendTemplate,
  InventoryMovement,
  resetCounter
} from '../../setup/test-fixtures.js';

describe('TransactionInventoryService', () => {
  let service: TransactionInventoryService;

  beforeAll(() => {
    service = new TransactionInventoryService();
  });

  beforeEach(async () => {
    await clearCollections();
    resetCounter();
  });

  describe('processTransactionInventory', () => {
    describe('Product Sales (saleType: quantity)', () => {
      it('should deduct stock correctly for quantity-based product sale', async () => {
        // Arrange
        const unit = await createTestUnit();
        const product = await createTestProduct({
          currentStock: 100,
          availableStock: 100,
          unitOfMeasurement: unit._id
        });

        const item = createTestTransactionItem({
          productId: product._id.toString(),
          name: product.name,
          quantity: 5,
          unitOfMeasurementId: unit._id.toString(),
          baseUnit: 'unit',
          convertedQuantity: 5,
          itemType: 'product',
          saleType: 'quantity',
          unitPrice: 25,
          totalPrice: 125
        });

        const transaction = createTestTransaction([item]);

        // Act
        const result = await service.processTransactionInventory(
          transaction as any,
          'test-user'
        );

        // Assert
        expect(result.success).toBe(true);
        expect(result.movements).toHaveLength(1);
        expect(result.movements[0].movementType).toBe('sale');
        expect(result.movements[0].quantity).toBe(5);

        const updatedProduct = await Product.findById(product._id);
        expect(updatedProduct!.currentStock).toBe(95);
      });

      it('should allow negative stock for out-of-stock sales', async () => {
        // Arrange
        const unit = await createTestUnit();
        const product = await createTestProduct({
          currentStock: 2,
          availableStock: 2,
          unitOfMeasurement: unit._id
        });

        const item = createTestTransactionItem({
          productId: product._id.toString(),
          name: product.name,
          quantity: 10,
          unitOfMeasurementId: unit._id.toString(),
          baseUnit: 'unit',
          convertedQuantity: 10,
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
        const updatedProduct = await Product.findById(product._id);
        expect(updatedProduct!.currentStock).toBe(-8); // Negative stock allowed
      });

      it('should create multiple movements for multiple products', async () => {
        // Arrange
        const unit = await createTestUnit();
        const product1 = await createTestProduct({
          name: 'Product 1',
          currentStock: 50,
          unitOfMeasurement: unit._id
        });
        const product2 = await createTestProduct({
          name: 'Product 2',
          currentStock: 30,
          unitOfMeasurement: unit._id
        });

        const items = [
          createTestTransactionItem({
            productId: product1._id.toString(),
            name: product1.name,
            quantity: 5,
            unitOfMeasurementId: unit._id.toString(),
            itemType: 'product',
            saleType: 'quantity'
          }),
          createTestTransactionItem({
            productId: product2._id.toString(),
            name: product2.name,
            quantity: 10,
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
        expect(result.movements).toHaveLength(2);

        const updatedProduct1 = await Product.findById(product1._id);
        const updatedProduct2 = await Product.findById(product2._id);
        expect(updatedProduct1!.currentStock).toBe(45);
        expect(updatedProduct2!.currentStock).toBe(20);
      });
    });

    describe('Product Sales (saleType: volume) - Partial Bottle Sales', () => {
      it('should deduct from existing partial container using FIFO', async () => {
        // Arrange
        const unit = await createTestUnit();
        const product = await createTestProductWithContainers({
          containerCapacity: 100,
          fullContainers: 1,
          partialContainers: [
            { id: 'BOTTLE_001', remaining: 50 },
            { id: 'BOTTLE_002', remaining: 80 }
          ],
          unitOfMeasurement: unit._id
        });

        const item = createTestTransactionItem({
          productId: product._id.toString(),
          name: product.name,
          quantity: 10,
          unitOfMeasurementId: unit._id.toString(),
          baseUnit: 'ml',
          convertedQuantity: 10,
          itemType: 'product',
          saleType: 'volume'
        });

        const transaction = createTestTransaction([item]);

        // Act
        const result = await service.processTransactionInventory(
          transaction as any,
          'test-user'
        );

        // Assert
        expect(result.success).toBe(true);

        const updatedProduct = await Product.findById(product._id);
        // FIFO: should deduct from BOTTLE_001 (first partial)
        expect(updatedProduct!.containers.partial[0].remaining).toBe(40);
        expect(updatedProduct!.containers.partial[0].saleHistory).toHaveLength(1);
        // BOTTLE_002 should be unchanged
        expect(updatedProduct!.containers.partial[1].remaining).toBe(80);
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

        const item = createTestTransactionItem({
          productId: product._id.toString(),
          name: product.name,
          quantity: 25,
          unitOfMeasurementId: unit._id.toString(),
          baseUnit: 'ml',
          convertedQuantity: 25,
          itemType: 'product',
          saleType: 'volume'
        });

        const transaction = createTestTransaction([item]);

        // Act
        const result = await service.processTransactionInventory(
          transaction as any,
          'test-user'
        );

        // Assert
        expect(result.success).toBe(true);

        const updatedProduct = await Product.findById(product._id);
        expect(updatedProduct!.containers.full).toBe(2); // One bottle opened
        expect(updatedProduct!.containers.partial).toHaveLength(1);
        expect(updatedProduct!.containers.partial[0].remaining).toBe(75); // 100 - 25
        expect(updatedProduct!.containers.partial[0].status).toBe('partial');
      });

      it('should use targeted container when containerId is provided', async () => {
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

        const item = createTestTransactionItem({
          productId: product._id.toString(),
          name: product.name,
          quantity: 20,
          unitOfMeasurementId: unit._id.toString(),
          baseUnit: 'ml',
          convertedQuantity: 20,
          itemType: 'product',
          saleType: 'volume',
          containerId: 'BOTTLE_B'
        });

        const transaction = createTestTransaction([item]);

        // Act
        const result = await service.processTransactionInventory(
          transaction as any,
          'test-user'
        );

        // Assert
        expect(result.success).toBe(true);

        const updatedProduct = await Product.findById(product._id);
        // BOTTLE_A should be unchanged
        expect(updatedProduct!.containers.partial[0].remaining).toBe(50);
        // BOTTLE_B should be deducted
        expect(updatedProduct!.containers.partial[1].remaining).toBe(50);
      });

      it('should mark container as empty when fully consumed', async () => {
        // Arrange
        const unit = await createTestUnit();
        const product = await createTestProductWithContainers({
          containerCapacity: 100,
          fullContainers: 1,
          partialContainers: [
            { id: 'BOTTLE_001', remaining: 15 }
          ],
          unitOfMeasurement: unit._id
        });

        const item = createTestTransactionItem({
          productId: product._id.toString(),
          name: product.name,
          quantity: 15,
          unitOfMeasurementId: unit._id.toString(),
          baseUnit: 'ml',
          convertedQuantity: 15,
          itemType: 'product',
          saleType: 'volume'
        });

        const transaction = createTestTransaction([item]);

        // Act
        const result = await service.processTransactionInventory(
          transaction as any,
          'test-user'
        );

        // Assert
        expect(result.success).toBe(true);

        const updatedProduct = await Product.findById(product._id);
        expect(updatedProduct!.containers.partial[0].remaining).toBe(0);
        expect(updatedProduct!.containers.partial[0].status).toBe('empty');
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

        const item = createTestTransactionItem({
          productId: product._id.toString(),
          name: product.name,
          quantity: 30,
          unitOfMeasurementId: unit._id.toString(),
          baseUnit: 'ml',
          convertedQuantity: 30,
          itemType: 'product',
          saleType: 'volume'
        });

        const transaction = createTestTransaction([item]);

        // Act
        const result = await service.processTransactionInventory(
          transaction as any,
          'test-user'
        );

        // Assert
        expect(result.success).toBe(true);

        const updatedProduct = await Product.findById(product._id);
        expect(updatedProduct!.containers.partial).toHaveLength(1);
        expect(updatedProduct!.containers.partial[0].status).toBe('oversold');
        expect(updatedProduct!.containers.partial[0].remaining).toBe(-30);
      });
    });

    describe('Fixed Blend Sales', () => {
      it('should deduct all ingredients scaled by transaction quantity', async () => {
        // Arrange
        const unit = await createTestUnit();
        const ingredient1 = await createTestProduct({
          name: 'Lavender Oil',
          currentStock: 100,
          unitOfMeasurement: unit._id
        });
        const ingredient2 = await createTestProduct({
          name: 'Peppermint Oil',
          currentStock: 100,
          unitOfMeasurement: unit._id
        });

        const blendTemplate = await createTestBlendTemplate([
          {
            productId: ingredient1._id,
            name: 'Lavender Oil',
            quantity: 5,
            unitOfMeasurementId: unit._id,
            unitName: 'ml'
          },
          {
            productId: ingredient2._id,
            name: 'Peppermint Oil',
            quantity: 3,
            unitOfMeasurementId: unit._id,
            unitName: 'ml'
          }
        ], { unitOfMeasurementId: unit._id });

        const item = createTestTransactionItem({
          productId: blendTemplate._id.toString(),
          name: blendTemplate.name,
          quantity: 2, // Buying 2 of the blend
          unitOfMeasurementId: unit._id.toString(),
          baseUnit: 'unit',
          convertedQuantity: 2,
          itemType: 'fixed_blend',
          saleType: 'quantity',
          unitPrice: 35,
          totalPrice: 70
        });

        const transaction = createTestTransaction([item]);

        // Act
        const result = await service.processTransactionInventory(
          transaction as any,
          'test-user'
        );

        // Assert
        expect(result.success).toBe(true);
        expect(result.movements).toHaveLength(2); // One for each ingredient

        const updatedIngredient1 = await Product.findById(ingredient1._id);
        const updatedIngredient2 = await Product.findById(ingredient2._id);

        // Lavender: 100 - (5 * 2) = 90
        expect(updatedIngredient1!.currentStock).toBe(90);
        // Peppermint: 100 - (3 * 2) = 94
        expect(updatedIngredient2!.currentStock).toBe(94);
      });

      it('should update blend template usage statistics', async () => {
        // Arrange
        const unit = await createTestUnit();
        const ingredient = await createTestProduct({
          currentStock: 100,
          unitOfMeasurement: unit._id
        });

        const blendTemplate = await createTestBlendTemplate([
          {
            productId: ingredient._id,
            name: ingredient.name,
            quantity: 10,
            unitOfMeasurementId: unit._id,
            unitName: 'ml'
          }
        ], {
          unitOfMeasurementId: unit._id,
          usageCount: 5
        });

        const item = createTestTransactionItem({
          productId: blendTemplate._id.toString(),
          name: blendTemplate.name,
          quantity: 3,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'fixed_blend',
          saleType: 'quantity'
        });

        const transaction = createTestTransaction([item]);

        // Act
        await service.processTransactionInventory(transaction as any, 'test-user');

        // Assert
        const updatedTemplate = await BlendTemplate.findById(blendTemplate._id);
        expect(updatedTemplate!.usageCount).toBe(8); // 5 + 3
        expect(updatedTemplate!.lastUsed).toBeDefined();
      });

      it('should create fixed_blend movement records', async () => {
        // Arrange
        const unit = await createTestUnit();
        const ingredient = await createTestProduct({
          currentStock: 50,
          unitOfMeasurement: unit._id
        });

        const blendTemplate = await createTestBlendTemplate([
          {
            productId: ingredient._id,
            name: ingredient.name,
            quantity: 8,
            unitOfMeasurementId: unit._id,
            unitName: 'ml'
          }
        ], { unitOfMeasurementId: unit._id });

        const item = createTestTransactionItem({
          productId: blendTemplate._id.toString(),
          name: blendTemplate.name,
          quantity: 1,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'fixed_blend',
          saleType: 'quantity'
        });

        const transaction = createTestTransaction([item]);

        // Act
        const result = await service.processTransactionInventory(
          transaction as any,
          'test-user'
        );

        // Assert
        expect(result.movements[0].movementType).toBe('fixed_blend');
        expect(result.movements[0].quantity).toBe(8);

        const movements = await InventoryMovement.find({
          reference: transaction.transactionNumber,
          movementType: 'fixed_blend'
        });
        expect(movements).toHaveLength(1);
      });
    });

    describe('Bundle Sales', () => {
      it('should deduct all bundle products scaled by quantity', async () => {
        // Arrange
        const unit = await createTestUnit();
        const product1 = await createTestProduct({
          name: 'Oil A',
          currentStock: 50,
          unitOfMeasurement: unit._id
        });
        const product2 = await createTestProduct({
          name: 'Oil B',
          currentStock: 50,
          unitOfMeasurement: unit._id
        });

        const bundle = await createTestBundle([
          {
            productId: product1._id,
            name: 'Oil A',
            quantity: 2,
            productType: 'product',
            unitOfMeasurementId: unit._id,
            unitName: 'unit',
            individualPrice: 20
          },
          {
            productId: product2._id,
            name: 'Oil B',
            quantity: 1,
            productType: 'product',
            unitOfMeasurementId: unit._id,
            unitName: 'unit',
            individualPrice: 25
          }
        ]);

        const item = createTestTransactionItem({
          productId: bundle._id.toString(),
          name: bundle.name,
          quantity: 3, // Buying 3 bundles
          unitOfMeasurementId: unit._id.toString(),
          baseUnit: 'unit',
          convertedQuantity: 3,
          itemType: 'bundle',
          saleType: 'quantity',
          unitPrice: 50,
          totalPrice: 150
        });

        const transaction = createTestTransaction([item]);

        // Act
        const result = await service.processTransactionInventory(
          transaction as any,
          'test-user'
        );

        // Assert
        expect(result.success).toBe(true);
        expect(result.movements).toHaveLength(2);

        const updatedProduct1 = await Product.findById(product1._id);
        const updatedProduct2 = await Product.findById(product2._id);

        // Oil A: 50 - (2 * 3) = 44
        expect(updatedProduct1!.currentStock).toBe(44);
        // Oil B: 50 - (1 * 3) = 47
        expect(updatedProduct2!.currentStock).toBe(47);
      });

      it('should deduct blend ingredients when bundle contains fixed blends', async () => {
        // Arrange
        const unit = await createTestUnit();
        const ingredient = await createTestProduct({
          name: 'Eucalyptus',
          currentStock: 100,
          unitOfMeasurement: unit._id
        });

        const blendTemplate = await createTestBlendTemplate([
          {
            productId: ingredient._id,
            name: 'Eucalyptus',
            quantity: 10,
            unitOfMeasurementId: unit._id,
            unitName: 'ml'
          }
        ], { unitOfMeasurementId: unit._id });

        const bundle = await createTestBundle([
          {
            productId: new mongoose.Types.ObjectId(), // Dummy product ID
            blendTemplateId: blendTemplate._id,
            name: 'Relaxation Blend',
            quantity: 2,
            productType: 'fixed_blend',
            unitOfMeasurementId: unit._id,
            unitName: 'unit',
            individualPrice: 35
          }
        ]);

        const item = createTestTransactionItem({
          productId: bundle._id.toString(),
          name: bundle.name,
          quantity: 2, // Buying 2 bundles
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'bundle',
          saleType: 'quantity',
          unitPrice: 60,
          totalPrice: 120
        });

        const transaction = createTestTransaction([item]);

        // Act
        const result = await service.processTransactionInventory(
          transaction as any,
          'test-user'
        );

        // Assert
        expect(result.success).toBe(true);

        const updatedIngredient = await Product.findById(ingredient._id);
        // 2 bundles * 2 blends per bundle * 10ml per blend = 40ml deducted
        expect(updatedIngredient!.currentStock).toBe(60);
      });

      it('should create bundle_sale movement records', async () => {
        // Arrange
        const unit = await createTestUnit();
        const product = await createTestProduct({
          currentStock: 100,
          unitOfMeasurement: unit._id
        });

        const bundle = await createTestBundle([
          {
            productId: product._id,
            name: product.name,
            quantity: 1,
            productType: 'product',
            unitOfMeasurementId: unit._id,
            individualPrice: 25
          }
        ]);

        const item = createTestTransactionItem({
          productId: bundle._id.toString(),
          name: bundle.name,
          quantity: 1,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'bundle',
          saleType: 'quantity'
        });

        const transaction = createTestTransaction([item]);

        // Act
        const result = await service.processTransactionInventory(
          transaction as any,
          'test-user'
        );

        // Assert
        expect(result.movements[0].movementType).toBe('bundle_sale');
      });
    });

    describe('Item Type Routing', () => {
      it('should skip custom_blend items (handled separately)', async () => {
        // Arrange
        const unit = await createTestUnit();

        const item = createTestTransactionItem({
          productId: new mongoose.Types.ObjectId().toString(),
          name: 'Custom Blend',
          quantity: 1,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'custom_blend',
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
        expect(result.movements).toHaveLength(0);
      });

      it('should skip service items (no inventory impact)', async () => {
        // Arrange
        const unit = await createTestUnit();

        const item = createTestTransactionItem({
          productId: new mongoose.Types.ObjectId().toString(),
          name: 'Consultation Service',
          quantity: 1,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'service',
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
        expect(result.movements).toHaveLength(0);
      });

      it('should skip consultation items (no inventory impact)', async () => {
        // Arrange
        const unit = await createTestUnit();

        const item = createTestTransactionItem({
          productId: new mongoose.Types.ObjectId().toString(),
          name: 'Health Consultation',
          quantity: 1,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'consultation',
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
        expect(result.movements).toHaveLength(0);
      });

      it('should skip miscellaneous items (no inventory impact)', async () => {
        // Arrange
        const unit = await createTestUnit();

        const item = createTestTransactionItem({
          productId: new mongoose.Types.ObjectId().toString(),
          name: 'Gift Wrapping',
          quantity: 1,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'miscellaneous',
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
        expect(result.movements).toHaveLength(0);
      });
    });

    describe('Error Handling', () => {
      it('should continue processing other items when one fails', async () => {
        // Arrange
        const unit = await createTestUnit();
        const validProduct = await createTestProduct({
          currentStock: 100,
          unitOfMeasurement: unit._id
        });

        const items = [
          createTestTransactionItem({
            productId: new mongoose.Types.ObjectId().toString(), // Non-existent product
            name: 'Non-existent Product',
            quantity: 5,
            unitOfMeasurementId: unit._id.toString(),
            itemType: 'product',
            saleType: 'quantity'
          }),
          createTestTransactionItem({
            productId: validProduct._id.toString(),
            name: validProduct.name,
            quantity: 10,
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
        expect(result.success).toBe(true); // Still succeeds overall
        expect(result.errors).toHaveLength(1);
        expect(result.movements).toHaveLength(1); // Only valid product processed

        const updatedProduct = await Product.findById(validProduct._id);
        expect(updatedProduct!.currentStock).toBe(90);
      });
    });
  });

  describe('reverseTransactionInventory', () => {
    it('should restore stock for all deducted items', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProduct({
        currentStock: 100,
        unitOfMeasurement: unit._id
      });
      const transactionNumber = 'TXN-REVERSE-001';

      const item = createTestTransactionItem({
        productId: product._id.toString(),
        name: product.name,
        quantity: 10,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'product',
        saleType: 'quantity'
      });

      const transaction = createTestTransaction([item], { transactionNumber });

      // First, process the transaction
      await service.processTransactionInventory(transaction as any, 'test-user');

      // Verify deduction
      let updatedProduct = await Product.findById(product._id);
      expect(updatedProduct!.currentStock).toBe(90);

      // Act - Reverse the transaction
      const result = await service.reverseTransactionInventory(
        transactionNumber,
        'test-user'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.reversedCount).toBe(1);
      expect(result.originalMovementCount).toBe(1);

      updatedProduct = await Product.findById(product._id);
      expect(updatedProduct!.currentStock).toBe(100); // Restored
    });

    it('should prevent double-reversal', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProduct({
        currentStock: 100,
        unitOfMeasurement: unit._id
      });
      const transactionNumber = 'TXN-DOUBLE-001';

      const item = createTestTransactionItem({
        productId: product._id.toString(),
        name: product.name,
        quantity: 20,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'product',
        saleType: 'quantity'
      });

      const transaction = createTestTransaction([item], { transactionNumber });

      await service.processTransactionInventory(transaction as any, 'test-user');

      // First reversal
      await service.reverseTransactionInventory(transactionNumber, 'test-user');

      // Act - Second reversal attempt
      const result = await service.reverseTransactionInventory(
        transactionNumber,
        'test-user'
      );

      // Assert
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('already has');
      expect(result.reversedCount).toBe(0);

      // Stock should still be 100 (not 120)
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct!.currentStock).toBe(100);
    });

    it('should create return movements with CANCEL- prefix', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProduct({
        currentStock: 50,
        unitOfMeasurement: unit._id
      });
      const transactionNumber = 'TXN-CANCEL-001';

      const item = createTestTransactionItem({
        productId: product._id.toString(),
        name: product.name,
        quantity: 15,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'product',
        saleType: 'quantity'
      });

      const transaction = createTestTransaction([item], { transactionNumber });

      await service.processTransactionInventory(transaction as any, 'test-user');

      // Act
      await service.reverseTransactionInventory(transactionNumber, 'test-user');

      // Assert
      const returnMovements = await InventoryMovement.find({
        reference: `CANCEL-${transactionNumber}`
      });

      expect(returnMovements).toHaveLength(1);
      expect(returnMovements[0].movementType).toBe('return');
    });

    it('should reverse all movement types correctly', async () => {
      // Arrange
      const unit = await createTestUnit();
      const ingredient = await createTestProduct({
        name: 'Blend Ingredient',
        currentStock: 100,
        unitOfMeasurement: unit._id
      });

      const blendTemplate = await createTestBlendTemplate([
        {
          productId: ingredient._id,
          name: ingredient.name,
          quantity: 10,
          unitOfMeasurementId: unit._id,
          unitName: 'ml'
        }
      ], { unitOfMeasurementId: unit._id });

      const transactionNumber = 'TXN-BLEND-CANCEL-001';

      const item = createTestTransactionItem({
        productId: blendTemplate._id.toString(),
        name: blendTemplate.name,
        quantity: 2,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'fixed_blend',
        saleType: 'quantity'
      });

      const transaction = createTestTransaction([item], { transactionNumber });

      await service.processTransactionInventory(transaction as any, 'test-user');

      // Verify deduction
      let updatedIngredient = await Product.findById(ingredient._id);
      expect(updatedIngredient!.currentStock).toBe(80); // 100 - (10 * 2)

      // Act
      const result = await service.reverseTransactionInventory(
        transactionNumber,
        'test-user'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.reversedCount).toBe(1);

      updatedIngredient = await Product.findById(ingredient._id);
      expect(updatedIngredient!.currentStock).toBe(100); // Restored
    });

    it('should warn when no movements found to reverse', async () => {
      // Act
      const result = await service.reverseTransactionInventory(
        'NON-EXISTENT-TXN',
        'test-user'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('No inventory movements found');
      expect(result.reversedCount).toBe(0);
    });
  });
});
