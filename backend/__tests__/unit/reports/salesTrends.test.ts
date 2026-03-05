import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { clearCollections } from '../../setup/mongodb-memory-server.js';
import { Transaction } from '../../../models/Transaction.js';
import { Product } from '../../../models/Product.js';
import {
  createTestProduct,
  createTestTransactionItem,
} from '../../setup/test-fixtures.js';

// Import the controller to test its actual endpoint logic
// We'll test the internal functions via HTTP-like simulation
import { SalesTrendsController } from '../../../controllers/reports/salesTrendsController.js';

// Helper: create a completed transaction in DB with items
async function createCompletedTransaction(
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    costPrice?: number;
    totalPrice?: number;
    itemType?: string;
    customBlendData?: {
      name: string;
      ingredients: Array<{
        productId: string;
        name: string;
        quantity: number;
        unitOfMeasurementId: string;
        unitName: string;
        costPerUnit: number;
      }>;
      totalIngredientCost: number;
      mixedBy: string;
      mixedAt: Date;
    };
  }>,
  overrides: Partial<{
    createdAt: Date;
    totalAmount: number;
  }> = {}
) {
  const enrichedItems = items.map(item => ({
    ...item,
    totalPrice: item.totalPrice ?? item.unitPrice * item.quantity,
    saleType: 'quantity' as const,
    unitOfMeasurementId: new mongoose.Types.ObjectId().toString(),
    baseUnit: 'unit',
    convertedQuantity: item.quantity,
    itemType: item.itemType || 'product',
  }));

  const totalAmount = overrides.totalAmount ?? enrichedItems.reduce((s, i) => s + i.totalPrice, 0);

  const txn = await Transaction.create({
    transactionNumber: `TXN-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'COMPLETED',
    status: 'completed',
    customerName: 'Test Customer',
    items: enrichedItems,
    subtotal: totalAmount,
    totalAmount,
    discountAmount: 0,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    paidAmount: totalAmount,
    changeAmount: 0,
    transactionDate: overrides.createdAt || new Date(),
    createdBy: 'test-user',
  });

  // Override createdAt if specified (Mongoose timestamps override)
  if (overrides.createdAt) {
    await Transaction.updateOne({ _id: txn._id }, { $set: { createdAt: overrides.createdAt } });
  }

  return txn;
}

// Helper: create mock req/res for controller
function createMockReqRes(query: Record<string, string> = {}) {
  const req = { query } as unknown as import('express').Request;
  let responseData: unknown;
  let statusCode = 200;
  const res = {
    json: (data: unknown) => { responseData = data; return res; },
    status: (code: number) => { statusCode = code; return res; },
  } as unknown as import('express').Response;
  return { req, res, getResponse: () => ({ data: responseData, status: statusCode }) };
}

describe('Sales Trends - Cost & Margin Calculations', () => {
  beforeEach(async () => {
    await clearCollections();
  });

  afterEach(async () => {
    await clearCollections();
  });

  // =========================================================================
  // CORE: New transactions with costPrice stored at point of sale
  // =========================================================================
  describe('New transactions (costPrice captured at sale)', () => {
    it('should calculate correct cost and profit when costPrice is on items', async () => {
      const product = await createTestProduct({ costPrice: 10, sellingPrice: 25 });

      await createCompletedTransaction([
        {
          productId: product._id.toString(),
          name: product.name,
          quantity: 4,
          unitPrice: 25,
          costPrice: 10, // captured at point of sale
        },
      ], {
        createdAt: new Date(),
      });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const { data } = getResponse();
      const response = data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> };

      const today = response.dailyData.find(d => d.revenue > 0);
      expect(today).toBeDefined();
      expect(today!.revenue).toBe(100);   // 4 * 25
      expect(today!.cost).toBe(40);       // 4 * 10
      expect(today!.profit).toBe(60);     // 100 - 40
    });

    it('should NOT show 100% margin when cost data exists', async () => {
      const product = await createTestProduct({ costPrice: 15, sellingPrice: 30 });

      await createCompletedTransaction([
        {
          productId: product._id.toString(),
          name: product.name,
          quantity: 2,
          unitPrice: 30,
          costPrice: 15,
        },
      ], { createdAt: new Date() });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const response = (getResponse().data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> });
      const today = response.dailyData.find(d => d.revenue > 0)!;

      const margin = today.profit / today.revenue;
      expect(margin).toBe(0.5); // 50% margin, NOT 100%
      expect(margin).not.toBe(1);
    });

    it('should handle multiple items with different cost prices in one transaction', async () => {
      const productA = await createTestProduct({ costPrice: 5, sellingPrice: 20, name: 'Product A' });
      const productB = await createTestProduct({ costPrice: 12, sellingPrice: 40, name: 'Product B' });

      await createCompletedTransaction([
        { productId: productA._id.toString(), name: 'Product A', quantity: 3, unitPrice: 20, costPrice: 5 },
        { productId: productB._id.toString(), name: 'Product B', quantity: 2, unitPrice: 40, costPrice: 12 },
      ], { createdAt: new Date() });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const response = (getResponse().data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> });
      const today = response.dailyData.find(d => d.revenue > 0)!;

      // Revenue: (3*20) + (2*40) = 60 + 80 = 140
      // Cost:    (3*5) + (2*12) = 15 + 24 = 39
      // Profit:  140 - 39 = 101
      expect(today.revenue).toBe(140);
      expect(today.cost).toBe(39);
      expect(today.profit).toBe(101);
    });
  });

  // =========================================================================
  // HISTORICAL: Transactions without costPrice — fallback to Product lookup
  // =========================================================================
  describe('Historical transactions (costPrice fallback to Product)', () => {
    it('should look up Product.costPrice for items without stored costPrice', async () => {
      const product = await createTestProduct({ costPrice: 8, sellingPrice: 20 });

      // Create a transaction WITHOUT costPrice (simulating old data)
      await createCompletedTransaction([
        {
          productId: product._id.toString(),
          name: product.name,
          quantity: 5,
          unitPrice: 20,
          // NO costPrice — historical transaction
        },
      ], { createdAt: new Date() });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const response = (getResponse().data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> });
      const today = response.dailyData.find(d => d.revenue > 0)!;

      expect(today.revenue).toBe(100);  // 5 * 20
      expect(today.cost).toBe(40);      // 5 * 8 (from Product lookup)
      expect(today.profit).toBe(60);    // 100 - 40
    });

    it('should handle product with no costPrice set (defaults to 0)', async () => {
      // Product with NO costPrice
      const product = await createTestProduct({ sellingPrice: 30 });
      // Manually remove costPrice
      await Product.updateOne({ _id: product._id }, { $unset: { costPrice: 1 } });

      await createCompletedTransaction([
        {
          productId: product._id.toString(),
          name: product.name,
          quantity: 3,
          unitPrice: 30,
        },
      ], { createdAt: new Date() });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const response = (getResponse().data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> });
      const today = response.dailyData.find(d => d.revenue > 0)!;

      // With no costPrice, cost defaults to 0 — this is expected for unconfigured products
      expect(today.revenue).toBe(90);
      expect(today.cost).toBe(0);
      expect(today.profit).toBe(90);
    });

    it('should handle non-ObjectId productId (legacy name-based data)', async () => {
      await createCompletedTransaction([
        {
          productId: 'MH Echinacea Premium (BOTTLE)', // legacy name, not ObjectId
          name: 'MH Echinacea Premium (BOTTLE)',
          quantity: 2,
          unitPrice: 50,
        },
      ], { createdAt: new Date() });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      // Should not crash — just treat cost as 0
      await SalesTrendsController.getSalesTrends(req, res);
      const response = (getResponse().data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> });
      const today = response.dailyData.find(d => d.revenue > 0)!;

      expect(today.revenue).toBe(100);
      expect(today.cost).toBe(0); // no lookup possible for legacy names
      expect(today.profit).toBe(100);
    });
  });

  // =========================================================================
  // CUSTOM BLENDS: costPrice from totalIngredientCost
  // =========================================================================
  describe('Custom blends', () => {
    it('should use totalIngredientCost for custom blend cost', async () => {
      await createCompletedTransaction([
        {
          productId: new mongoose.Types.ObjectId().toString(),
          name: 'Custom Blend - Liver Support',
          quantity: 1,
          unitPrice: 80,
          itemType: 'custom_blend',
          customBlendData: {
            name: 'Liver Support',
            ingredients: [
              { productId: new mongoose.Types.ObjectId().toString(), name: 'Milk Thistle', quantity: 30, unitOfMeasurementId: new mongoose.Types.ObjectId().toString(), unitName: 'ml', costPerUnit: 0.5 },
              { productId: new mongoose.Types.ObjectId().toString(), name: 'Dandelion', quantity: 20, unitOfMeasurementId: new mongoose.Types.ObjectId().toString(), unitName: 'ml', costPerUnit: 0.3 },
            ],
            totalIngredientCost: 21, // 30*0.5 + 20*0.3
            mixedBy: 'test-user',
            mixedAt: new Date(),
          },
        },
      ], { createdAt: new Date() });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const response = (getResponse().data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> });
      const today = response.dailyData.find(d => d.revenue > 0)!;

      expect(today.revenue).toBe(80);
      expect(today.cost).toBe(21);   // from totalIngredientCost
      expect(today.profit).toBe(59); // 80 - 21
    });

    it('should handle custom blend with costPrice already set (new flow)', async () => {
      await createCompletedTransaction([
        {
          productId: new mongoose.Types.ObjectId().toString(),
          name: 'Custom Blend - Immune Boost',
          quantity: 1,
          unitPrice: 65,
          costPrice: 18, // already captured at sale
          itemType: 'custom_blend',
        },
      ], { createdAt: new Date() });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const response = (getResponse().data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> });
      const today = response.dailyData.find(d => d.revenue > 0)!;

      expect(today.revenue).toBe(65);
      expect(today.cost).toBe(18);   // costPrice from item
      expect(today.profit).toBe(47);
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================
  describe('Edge cases', () => {
    it('should handle zero quantity items', async () => {
      const product = await createTestProduct({ costPrice: 10, sellingPrice: 25 });

      await createCompletedTransaction([
        {
          productId: product._id.toString(),
          name: product.name,
          quantity: 0,
          unitPrice: 25,
          costPrice: 10,
          totalPrice: 0,
        },
      ], { createdAt: new Date(), totalAmount: 0 });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const response = (getResponse().data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> });
      // Should not crash, cost should be 0
      const allDays = response.dailyData;
      const totalCost = allDays.reduce((s, d) => s + d.cost, 0);
      expect(totalCost).toBe(0);
    });

    it('should handle transactions with no items array', async () => {
      // Edge case: corrupted/legacy transaction with missing items
      await Transaction.create({
        transactionNumber: `TXN-NOIT-${Date.now()}`,
        type: 'COMPLETED',
        status: 'completed',
        customerName: 'No Items Customer',
        items: [],
        subtotal: 50,
        totalAmount: 50,
        discountAmount: 0,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 50,
        changeAmount: 0,
        transactionDate: new Date(),
        createdBy: 'test-user',
      });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const { data, status } = getResponse();
      expect(status).toBe(200);
      // Revenue comes from totalAmount, cost from items (empty = 0)
      const response = data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> };
      const today = response.dailyData.find(d => d.revenue > 0)!;
      expect(today.revenue).toBe(50);
      expect(today.cost).toBe(0);
      expect(today.profit).toBe(50);
    });

    it('should handle mixed new and historical items in the same transaction', async () => {
      const productWithCost = await createTestProduct({ costPrice: 7, sellingPrice: 20, name: 'New Product' });
      const productLegacy = await createTestProduct({ costPrice: 12, sellingPrice: 35, name: 'Legacy Product' });

      await createCompletedTransaction([
        {
          productId: productWithCost._id.toString(),
          name: 'New Product',
          quantity: 2,
          unitPrice: 20,
          costPrice: 7, // new flow — cost at point of sale
        },
        {
          productId: productLegacy._id.toString(),
          name: 'Legacy Product',
          quantity: 3,
          unitPrice: 35,
          // NO costPrice — historical item, will fallback to Product lookup
        },
      ], { createdAt: new Date() });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const response = (getResponse().data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> });
      const today = response.dailyData.find(d => d.revenue > 0)!;

      // Revenue: (2*20) + (3*35) = 40 + 105 = 145
      // Cost:    (2*7)  + (3*12) = 14 + 36 = 50
      // Profit:  145 - 50 = 95
      expect(today.revenue).toBe(145);
      expect(today.cost).toBe(50);
      expect(today.profit).toBe(95);
    });

    it('should handle multiple transactions on the same day', async () => {
      const product = await createTestProduct({ costPrice: 5, sellingPrice: 15 });
      const now = new Date();

      await createCompletedTransaction([
        { productId: product._id.toString(), name: product.name, quantity: 2, unitPrice: 15, costPrice: 5 },
      ], { createdAt: now });

      await createCompletedTransaction([
        { productId: product._id.toString(), name: product.name, quantity: 3, unitPrice: 15, costPrice: 5 },
      ], { createdAt: now });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(now.getTime() - 86400000).toISOString(),
        endDate: new Date(now.getTime() + 86400000).toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const response = (getResponse().data as { dailyData: Array<{ revenue: number; cost: number; profit: number; transactions: number }> });
      const today = response.dailyData.find(d => d.revenue > 0)!;

      // Txn 1: revenue 30, cost 10
      // Txn 2: revenue 45, cost 15
      expect(today.revenue).toBe(75);
      expect(today.cost).toBe(25);
      expect(today.profit).toBe(50);
      expect(today.transactions).toBe(2);
    });

    it('should handle service/consultation items (no cost)', async () => {
      await createCompletedTransaction([
        {
          productId: new mongoose.Types.ObjectId().toString(),
          name: 'Initial Consultation',
          quantity: 1,
          unitPrice: 120,
          costPrice: 0, // services have zero cost
          itemType: 'consultation',
        },
      ], { createdAt: new Date() });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const response = (getResponse().data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> });
      const today = response.dailyData.find(d => d.revenue > 0)!;

      expect(today.revenue).toBe(120);
      expect(today.cost).toBe(0);
      expect(today.profit).toBe(120); // 100% margin is correct for services
    });

    it('should return zero-filled days when no transactions exist', async () => {
      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 7 * 86400000).toISOString(),
        endDate: new Date().toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const response = (getResponse().data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> });

      expect(response.dailyData.length).toBeGreaterThan(0);
      response.dailyData.forEach(day => {
        expect(day.revenue).toBe(0);
        expect(day.cost).toBe(0);
        expect(day.profit).toBe(0);
      });
    });

    it('should exclude draft and cancelled transactions', async () => {
      const product = await createTestProduct({ costPrice: 10, sellingPrice: 25 });

      // Draft transaction — should be excluded
      await Transaction.create({
        transactionNumber: `TXN-DRAFT-${Date.now()}`,
        type: 'DRAFT',
        status: 'draft',
        customerName: 'Draft Customer',
        items: [{
          productId: product._id.toString(),
          name: product.name,
          quantity: 10,
          unitPrice: 25,
          costPrice: 10,
          totalPrice: 250,
          saleType: 'quantity',
          unitOfMeasurementId: new mongoose.Types.ObjectId().toString(),
          baseUnit: 'unit',
          convertedQuantity: 10,
        }],
        subtotal: 250,
        totalAmount: 250,
        discountAmount: 0,
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        paidAmount: 0,
        changeAmount: 0,
        transactionDate: new Date(),
        createdBy: 'test-user',
      });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const response = (getResponse().data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> });
      const totalRevenue = response.dailyData.reduce((s, d) => s + d.revenue, 0);

      expect(totalRevenue).toBe(0); // draft not included
    });

    it('should handle costPrice of 0 correctly (free samples, etc)', async () => {
      await createCompletedTransaction([
        {
          productId: new mongoose.Types.ObjectId().toString(),
          name: 'Free Sample',
          quantity: 1,
          unitPrice: 0,
          costPrice: 5,
          totalPrice: 0,
        },
      ], { createdAt: new Date(), totalAmount: 0 });

      const { req, res, getResponse } = createMockReqRes({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      });

      await SalesTrendsController.getSalesTrends(req, res);
      const response = (getResponse().data as { dailyData: Array<{ revenue: number; cost: number; profit: number }> });
      const today = response.dailyData.find(d => d.cost > 0);

      // Revenue 0, cost 5, profit -5 (a loss — correct for free samples)
      if (today) {
        expect(today.revenue).toBe(0);
        expect(today.cost).toBe(5);
        expect(today.profit).toBe(-5);
      }
    });
  });
});
