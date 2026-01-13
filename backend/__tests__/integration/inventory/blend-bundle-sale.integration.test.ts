import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { TransactionInventoryService } from '../../../services/TransactionInventoryService.js';
import { clearCollections } from '../../setup/mongodb-memory-server.js';
import {
  createTestProduct,
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

describe('Blend and Bundle Sale Integration', () => {
  let service: TransactionInventoryService;

  beforeEach(async () => {
    await clearCollections();
    resetCounter();
    service = new TransactionInventoryService();
  });

  describe('Fixed Blend Sales', () => {
    it('should deduct all blend ingredients proportionally', async () => {
      // Arrange: Create a wellness blend with 3 ingredients
      const unit = await createTestUnit();
      const lavender = await createTestProduct({
        name: 'Lavender Oil',
        currentStock: 500,
        unitOfMeasurement: unit._id
      });
      const chamomile = await createTestProduct({
        name: 'Chamomile Oil',
        currentStock: 300,
        unitOfMeasurement: unit._id
      });
      const bergamot = await createTestProduct({
        name: 'Bergamot Oil',
        currentStock: 200,
        unitOfMeasurement: unit._id
      });

      const wellnessBlend = await createTestBlendTemplate([
        { productId: lavender._id, name: 'Lavender', quantity: 10, unitOfMeasurementId: unit._id, unitName: 'ml' },
        { productId: chamomile._id, name: 'Chamomile', quantity: 5, unitOfMeasurementId: unit._id, unitName: 'ml' },
        { productId: bergamot._id, name: 'Bergamot', quantity: 3, unitOfMeasurementId: unit._id, unitName: 'ml' }
      ], {
        name: 'Wellness Blend',
        sellingPrice: 45,
        unitOfMeasurementId: unit._id
      });

      // Act: Sell 4 units of the blend
      const item = createTestTransactionItem({
        productId: wellnessBlend._id.toString(),
        name: wellnessBlend.name,
        quantity: 4,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'fixed_blend',
        saleType: 'quantity',
        unitPrice: 45,
        totalPrice: 180
      });

      const transaction = createTestTransaction([item]);
      const result = await service.processTransactionInventory(transaction as any, 'test-user');

      // Assert
      expect(result.success).toBe(true);
      expect(result.movements).toHaveLength(3); // One per ingredient

      const updatedLavender = await Product.findById(lavender._id);
      const updatedChamomile = await Product.findById(chamomile._id);
      const updatedBergamot = await Product.findById(bergamot._id);

      // Each ingredient deducted by quantity * 4
      expect(updatedLavender!.currentStock).toBe(460); // 500 - (10 * 4)
      expect(updatedChamomile!.currentStock).toBe(280); // 300 - (5 * 4)
      expect(updatedBergamot!.currentStock).toBe(188); // 200 - (3 * 4)
    });

    it('should track blend usage statistics', async () => {
      // Arrange
      const unit = await createTestUnit();
      const ingredient = await createTestProduct({
        currentStock: 1000,
        unitOfMeasurement: unit._id
      });

      const blend = await createTestBlendTemplate([
        { productId: ingredient._id, name: ingredient.name, quantity: 5, unitOfMeasurementId: unit._id, unitName: 'ml' }
      ], {
        name: 'Popular Blend',
        usageCount: 10, // Already used 10 times
        unitOfMeasurementId: unit._id
      });

      // Act: Multiple sales
      for (let i = 0; i < 3; i++) {
        const item = createTestTransactionItem({
          productId: blend._id.toString(),
          name: blend.name,
          quantity: 2,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'fixed_blend',
          saleType: 'quantity'
        });

        const txn = createTestTransaction([item], {
          transactionNumber: `TXN-BLEND-STATS-${i}`
        });
        await service.processTransactionInventory(txn as any, 'test-user');
      }

      // Assert
      const updatedBlend = await BlendTemplate.findById(blend._id);
      expect(updatedBlend!.usageCount).toBe(16); // 10 + (2 * 3)
      expect(updatedBlend!.lastUsed).toBeDefined();
    });

    it('should reverse blend ingredient deductions on cancellation', async () => {
      // Arrange
      const unit = await createTestUnit();
      const oil1 = await createTestProduct({
        name: 'Oil 1',
        currentStock: 100,
        unitOfMeasurement: unit._id
      });
      const oil2 = await createTestProduct({
        name: 'Oil 2',
        currentStock: 100,
        unitOfMeasurement: unit._id
      });

      const blend = await createTestBlendTemplate([
        { productId: oil1._id, name: 'Oil 1', quantity: 8, unitOfMeasurementId: unit._id, unitName: 'ml' },
        { productId: oil2._id, name: 'Oil 2', quantity: 12, unitOfMeasurementId: unit._id, unitName: 'ml' }
      ], { unitOfMeasurementId: unit._id });

      const transactionNumber = 'TXN-BLEND-CANCEL-001';
      const item = createTestTransactionItem({
        productId: blend._id.toString(),
        name: blend.name,
        quantity: 3,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'fixed_blend',
        saleType: 'quantity'
      });

      const transaction = createTestTransaction([item], { transactionNumber });

      // Act: Sell then cancel
      await service.processTransactionInventory(transaction as any, 'test-user');

      // Verify deduction
      let updatedOil1 = await Product.findById(oil1._id);
      let updatedOil2 = await Product.findById(oil2._id);
      expect(updatedOil1!.currentStock).toBe(76); // 100 - (8 * 3)
      expect(updatedOil2!.currentStock).toBe(64); // 100 - (12 * 3)

      // Cancel
      await service.reverseTransactionInventory(transactionNumber, 'test-user');

      // Assert: Restored
      updatedOil1 = await Product.findById(oil1._id);
      updatedOil2 = await Product.findById(oil2._id);
      expect(updatedOil1!.currentStock).toBe(100);
      expect(updatedOil2!.currentStock).toBe(100);
    });
  });

  describe('Bundle Sales', () => {
    it('should deduct all bundle products proportionally', async () => {
      // Arrange: Create a starter kit bundle
      const unit = await createTestUnit();
      const product1 = await createTestProduct({
        name: 'Diffuser Oil Set',
        currentStock: 50,
        unitOfMeasurement: unit._id,
        sellingPrice: 30
      });
      const product2 = await createTestProduct({
        name: 'Carrier Oil',
        currentStock: 40,
        unitOfMeasurement: unit._id,
        sellingPrice: 20
      });
      const product3 = await createTestProduct({
        name: 'Storage Case',
        currentStock: 30,
        unitOfMeasurement: unit._id,
        sellingPrice: 15
      });

      const starterKit = await createTestBundle([
        { productId: product1._id, name: product1.name, quantity: 2, productType: 'product', individualPrice: 30, unitOfMeasurementId: unit._id, unitName: 'unit' },
        { productId: product2._id, name: product2.name, quantity: 3, productType: 'product', individualPrice: 20, unitOfMeasurementId: unit._id, unitName: 'unit' },
        { productId: product3._id, name: product3.name, quantity: 1, productType: 'product', individualPrice: 15, unitOfMeasurementId: unit._id, unitName: 'unit' }
      ], {
        name: 'Essential Oils Starter Kit',
        bundlePrice: 85
      });

      // Act: Sell 5 bundles
      const item = createTestTransactionItem({
        productId: starterKit._id.toString(),
        name: starterKit.name,
        quantity: 5,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'bundle',
        saleType: 'quantity',
        unitPrice: 85,
        totalPrice: 425
      });

      const transaction = createTestTransaction([item]);
      const result = await service.processTransactionInventory(transaction as any, 'test-user');

      // Assert
      expect(result.success).toBe(true);
      expect(result.movements).toHaveLength(3);

      const updatedProduct1 = await Product.findById(product1._id);
      const updatedProduct2 = await Product.findById(product2._id);
      const updatedProduct3 = await Product.findById(product3._id);

      expect(updatedProduct1!.currentStock).toBe(40); // 50 - (2 * 5)
      expect(updatedProduct2!.currentStock).toBe(25); // 40 - (3 * 5)
      expect(updatedProduct3!.currentStock).toBe(25); // 30 - (1 * 5)
    });

    it('should deduct blend ingredients when bundle contains fixed blends', async () => {
      // Arrange: Bundle with a product and a blend
      const unit = await createTestUnit();
      const regularProduct = await createTestProduct({
        name: 'Essential Oil Book',
        currentStock: 100,
        unitOfMeasurement: unit._id
      });
      const blendIngredient1 = await createTestProduct({
        name: 'Frankincense',
        currentStock: 200,
        unitOfMeasurement: unit._id
      });
      const blendIngredient2 = await createTestProduct({
        name: 'Myrrh',
        currentStock: 200,
        unitOfMeasurement: unit._id
      });

      // Create a fixed blend
      const relaxBlend = await createTestBlendTemplate([
        { productId: blendIngredient1._id, name: 'Frankincense', quantity: 15, unitOfMeasurementId: unit._id, unitName: 'ml' },
        { productId: blendIngredient2._id, name: 'Myrrh', quantity: 10, unitOfMeasurementId: unit._id, unitName: 'ml' }
      ], {
        name: 'Relaxation Blend',
        unitOfMeasurementId: unit._id
      });

      // Create bundle with regular product + fixed blend
      const giftBundle = await createTestBundle([
        { productId: regularProduct._id, name: regularProduct.name, quantity: 1, productType: 'product', individualPrice: 25, unitOfMeasurementId: unit._id, unitName: 'unit' },
        { productId: new mongoose.Types.ObjectId(), blendTemplateId: relaxBlend._id, name: relaxBlend.name, quantity: 2, productType: 'fixed_blend', individualPrice: 40, unitOfMeasurementId: unit._id, unitName: 'unit' }
      ], {
        name: 'Aromatherapy Gift Set',
        bundlePrice: 90
      });

      // Act: Sell 3 gift bundles
      const item = createTestTransactionItem({
        productId: giftBundle._id.toString(),
        name: giftBundle.name,
        quantity: 3,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'bundle',
        saleType: 'quantity'
      });

      const transaction = createTestTransaction([item]);
      const result = await service.processTransactionInventory(transaction as any, 'test-user');

      // Assert
      expect(result.success).toBe(true);

      const updatedRegularProduct = await Product.findById(regularProduct._id);
      const updatedIngredient1 = await Product.findById(blendIngredient1._id);
      const updatedIngredient2 = await Product.findById(blendIngredient2._id);

      // Regular product: 100 - (1 * 3) = 97
      expect(updatedRegularProduct!.currentStock).toBe(97);

      // Blend ingredients: 2 blends per bundle * 3 bundles = 6 blends worth
      // Frankincense: 200 - (15 * 6) = 110
      expect(updatedIngredient1!.currentStock).toBe(110);
      // Myrrh: 200 - (10 * 6) = 140
      expect(updatedIngredient2!.currentStock).toBe(140);
    });

    it('should create appropriate movement types for bundle sales', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product = await createTestProduct({
        currentStock: 100,
        unitOfMeasurement: unit._id
      });

      const bundle = await createTestBundle([
        { productId: product._id, name: product.name, quantity: 1, productType: 'product', individualPrice: 25, unitOfMeasurementId: unit._id }
      ]);

      const transactionNumber = 'TXN-BUNDLE-MOVE-001';
      const item = createTestTransactionItem({
        productId: bundle._id.toString(),
        name: bundle.name,
        quantity: 2,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'bundle',
        saleType: 'quantity'
      });

      const transaction = createTestTransaction([item], { transactionNumber });

      // Act
      await service.processTransactionInventory(transaction as any, 'test-user');

      // Assert: Check movement type
      const movements = await InventoryMovement.find({ reference: transactionNumber });
      expect(movements).toHaveLength(1);
      expect(movements[0].movementType).toBe('bundle_sale');
    });

    it('should reverse all bundle product deductions on cancellation', async () => {
      // Arrange
      const unit = await createTestUnit();
      const product1 = await createTestProduct({
        name: 'Bundle Item 1',
        currentStock: 50,
        unitOfMeasurement: unit._id
      });
      const product2 = await createTestProduct({
        name: 'Bundle Item 2',
        currentStock: 40,
        unitOfMeasurement: unit._id
      });

      const bundle = await createTestBundle([
        { productId: product1._id, name: product1.name, quantity: 3, productType: 'product', individualPrice: 20, unitOfMeasurementId: unit._id },
        { productId: product2._id, name: product2.name, quantity: 2, productType: 'product', individualPrice: 15, unitOfMeasurementId: unit._id }
      ]);

      const transactionNumber = 'TXN-BUNDLE-CANCEL-001';
      const item = createTestTransactionItem({
        productId: bundle._id.toString(),
        name: bundle.name,
        quantity: 4,
        unitOfMeasurementId: unit._id.toString(),
        itemType: 'bundle',
        saleType: 'quantity'
      });

      const transaction = createTestTransaction([item], { transactionNumber });

      // Act: Sell then cancel
      await service.processTransactionInventory(transaction as any, 'test-user');

      // Verify deduction
      let updated1 = await Product.findById(product1._id);
      let updated2 = await Product.findById(product2._id);
      expect(updated1!.currentStock).toBe(38); // 50 - (3 * 4)
      expect(updated2!.currentStock).toBe(32); // 40 - (2 * 4)

      // Cancel
      await service.reverseTransactionInventory(transactionNumber, 'test-user');

      // Assert: Restored
      updated1 = await Product.findById(product1._id);
      updated2 = await Product.findById(product2._id);
      expect(updated1!.currentStock).toBe(50);
      expect(updated2!.currentStock).toBe(40);
    });
  });

  describe('Mixed Transaction Types', () => {
    it('should handle transaction with products, blends, and bundles together', async () => {
      // Arrange
      const unit = await createTestUnit();

      // Regular product
      const singleProduct = await createTestProduct({
        name: 'Single Essential Oil',
        currentStock: 100,
        unitOfMeasurement: unit._id
      });

      // Blend ingredients
      const blendIngredient = await createTestProduct({
        name: 'Blend Ingredient',
        currentStock: 200,
        unitOfMeasurement: unit._id
      });

      // Bundle products
      const bundleProduct = await createTestProduct({
        name: 'Bundle Product',
        currentStock: 150,
        unitOfMeasurement: unit._id
      });

      // Create blend
      const blend = await createTestBlendTemplate([
        { productId: blendIngredient._id, name: blendIngredient.name, quantity: 8, unitOfMeasurementId: unit._id, unitName: 'ml' }
      ], { unitOfMeasurementId: unit._id });

      // Create bundle
      const bundle = await createTestBundle([
        { productId: bundleProduct._id, name: bundleProduct.name, quantity: 2, productType: 'product', individualPrice: 30, unitOfMeasurementId: unit._id }
      ]);

      // Create mixed transaction
      const items = [
        createTestTransactionItem({
          productId: singleProduct._id.toString(),
          name: singleProduct.name,
          quantity: 5,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'product',
          saleType: 'quantity'
        }),
        createTestTransactionItem({
          productId: blend._id.toString(),
          name: blend.name,
          quantity: 3,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'fixed_blend',
          saleType: 'quantity'
        }),
        createTestTransactionItem({
          productId: bundle._id.toString(),
          name: bundle.name,
          quantity: 4,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'bundle',
          saleType: 'quantity'
        }),
        createTestTransactionItem({
          productId: new mongoose.Types.ObjectId().toString(),
          name: 'Consultation Fee',
          quantity: 1,
          unitOfMeasurementId: unit._id.toString(),
          itemType: 'service',
          saleType: 'quantity'
        })
      ];

      const transaction = createTestTransaction(items);

      // Act
      const result = await service.processTransactionInventory(transaction as any, 'test-user');

      // Assert
      expect(result.success).toBe(true);
      expect(result.movements).toHaveLength(3); // Product + blend ingredient + bundle product (service skipped)

      const updatedSingle = await Product.findById(singleProduct._id);
      const updatedBlendIngredient = await Product.findById(blendIngredient._id);
      const updatedBundleProduct = await Product.findById(bundleProduct._id);

      expect(updatedSingle!.currentStock).toBe(95); // 100 - 5
      expect(updatedBlendIngredient!.currentStock).toBe(176); // 200 - (8 * 3)
      expect(updatedBundleProduct!.currentStock).toBe(142); // 150 - (2 * 4)
    });
  });
});
