/**
 * TransactionCalculationService — Server-side transaction price/discount/total calculation.
 *
 * Extracted from transactions.controller.ts to be reusable for:
 * 1. Preview/calculate endpoint (frontend calls before submission)
 * 2. Create transaction (server recalculates before saving)
 * 3. Update transaction (server recalculates before saving)
 *
 * This is the single source of truth for all transaction pricing.
 */

import { Product } from '../models/Product.js';
import { computeUnitPrice, safeContainerCapacity, perUnitCost } from '../utils/pricingUtils.js';
import {
  assertDiscountOverrideMetadata,
  isManualDiscountSource,
  normalizeManualItemDiscount,
  normalizeManualItemDiscounts,
  roundCurrency,
  type DiscountSource,
} from './discountOverridePolicy.js';

// Item types eligible for membership discounts
const DISCOUNT_ELIGIBLE_ITEM_TYPES = new Set(['product', 'fixed_blend']);

export interface CalculationItem {
  productId?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  discountAmount?: number;
  discountSource?: DiscountSource | string;
  discountReason?: string;
  itemType?: string;
  isService?: boolean;
  miscellaneousCategory?: string;
  saleType?: 'quantity' | 'volume';
  convertedQuantity?: number;
  containerCapacityAtSale?: number;
  displaySku?: string;
  customBlendData?: {
    ingredients: Array<{ productId: string; quantity: number; costPerUnit?: number }>;
    totalIngredientCost?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CalculationInput {
  items: CalculationItem[];
  customerId?: string | null;
  discountAmount?: number; // bill-level discount
  allowDiscountOverride?: boolean;
  mode?: 'preview' | 'commit';
}

export interface CalculatedItem extends CalculationItem {
  unitPrice: number;
  totalPrice: number;
  discountAmount: number;
  convertedQuantity?: number;
  containerCapacityAtSale?: number;
  displaySku?: string;
}

export interface CalculationResult {
  items: CalculatedItem[];
  subtotal: number;
  totalItemDiscounts: number;
  totalAmount: number;
  warnings: string[];
  memberDiscount?: {
    percentage: number;
    tier?: string;
  };
}

class TransactionCalculationService {
  /**
   * Calculate/recalculate all transaction prices, discounts, and totals from server-side data.
   * Never trusts frontend-supplied prices.
   */
  async calculateTransaction(input: CalculationInput): Promise<CalculationResult> {
    const warnings: string[] = [];
    const items: CalculatedItem[] = input.items.map(item => ({
      ...item,
      discountAmount: item.discountAmount ?? 0,
      totalPrice: item.totalPrice ?? 0,
    }));

    // ── STEP 1: Recalculate unit prices from product data ──
    await this.recalculateUnitPrices(items, warnings);

    // ── STEP 2: Recalculate custom blend prices from ingredients ──
    await this.recalculateCustomBlendPrices(items, warnings);

    assertDiscountOverrideMetadata(items, {
      allowDiscountOverride: input.allowDiscountOverride,
    });

    // ── STEP 3: Preserve gift/manual line discounts after price changes ──
    normalizeManualItemDiscounts(items);

    // ── STEP 4: Recalculate membership discounts ──
    const memberDiscount = await this.recalculateMemberDiscounts(items, input.customerId);

    // ── STEP 5: Ensure every line has a verified net total ──
    this.finalizeLineTotals(items);

    // ── STEP 6: Recalculate totals ──
    const subtotal = items.reduce(
      (sum, item) => sum + ((item.unitPrice ?? 0) * (item.quantity ?? 0)),
      0
    );
    const totalItemDiscounts = items.reduce(
      (sum, item) => sum + (item.discountAmount ?? 0),
      0
    );
    const billDiscount = input.discountAmount ?? 0;
    const totalAmount = subtotal - totalItemDiscounts - billDiscount;

    return {
      items,
      subtotal: roundCurrency(subtotal),
      totalItemDiscounts: roundCurrency(totalItemDiscounts),
      totalAmount: roundCurrency(totalAmount),
      warnings,
      memberDiscount: memberDiscount || undefined,
    };
  }

  /**
   * Recalculate unit prices from server-side product data.
   * Validates canSellLoose and containerCapacity for volume sales.
   */
  private async recalculateUnitPrices(items: CalculatedItem[], warnings: string[]): Promise<void> {
    const productIds = items
      .filter(item => item.productId && /^[a-fA-F0-9]{24}$/.test(item.productId) && item.itemType !== 'custom_blend')
      .map(item => item.productId as string);

    if (productIds.length === 0) return;

    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map(p => [String(p._id), p]));

    for (const item of items) {
      if (item.itemType === 'custom_blend') continue;
      const product = productMap.get(item.productId as string) as {
        _id: unknown;
        name?: string;
        sellingPrice?: number;
        costPrice?: number;
        containerCapacity?: number;
        canSellLoose?: boolean;
        looseStock?: number;
        sku?: string;
      } | undefined;
      if (!product) continue;

      const serverSellingPrice = product.sellingPrice ?? 0;
      const serverContainerCapacity = safeContainerCapacity(product.containerCapacity);

      if (item.saleType === 'volume') {
        if (!product.canSellLoose) {
          warnings.push(`${product.name} cannot be sold loose. Only whole container sales allowed.`);
          continue;
        }
        if (serverContainerCapacity <= 1) {
          warnings.push(`${product.name} has container capacity of 1 — cannot sell loose.`);
          continue;
        }
        const looseStock = product.looseStock ?? 0;
        if (looseStock <= 0) {
          warnings.push(`${product.name} has no loose stock available. Open a container first.`);
        }
        item.convertedQuantity = item.quantity;
        item.unitPrice = computeUnitPrice(serverSellingPrice, serverContainerCapacity, 'volume');
      } else {
        item.convertedQuantity = item.quantity * serverContainerCapacity;
        item.unitPrice = computeUnitPrice(serverSellingPrice, serverContainerCapacity, 'quantity');
      }

      item.containerCapacityAtSale = serverContainerCapacity;

      const baseSku = product.sku || '';
      item.displaySku = item.saleType === 'volume' ? baseSku + '-T' : baseSku;
    }
  }

  /**
   * Recalculate custom blend prices from ingredient product data.
   */
  private async recalculateCustomBlendPrices(items: CalculatedItem[], warnings: string[]): Promise<void> {
    for (const item of items) {
      if (item.itemType !== 'custom_blend' || !item.customBlendData) continue;

      const ingredientProductIds = item.customBlendData.ingredients
        .map(ing => ing.productId)
        .filter(id => /^[a-fA-F0-9]{24}$/.test(id));

      if (ingredientProductIds.length === 0) continue;

      const ingredientProducts = await Product.find({ _id: { $in: ingredientProductIds } }).lean();
      const ingredientMap = new Map(ingredientProducts.map(p => [String(p._id), p]));

      let totalIngredientCost = 0;
      for (const ing of item.customBlendData.ingredients) {
        const product = ingredientMap.get(ing.productId) as { costPrice?: number; containerCapacity?: number } | undefined;
        if (product) {
          ing.costPerUnit = perUnitCost(product) ?? 0;
          totalIngredientCost += ing.quantity * ing.costPerUnit;
        }
      }

      item.customBlendData.totalIngredientCost = totalIngredientCost;

      if (item.unitPrice < totalIngredientCost) {
        warnings.push(`Custom blend "${item.name}" priced below ingredient cost: $${item.unitPrice} < $${totalIngredientCost}`);
      }
    }
  }

  /**
   * Recalculate membership discounts based on customer tier.
   * Returns member discount info if applicable.
   */
  private async recalculateMemberDiscounts(
    items: CalculatedItem[],
    customerId?: string | null
  ): Promise<{ percentage: number; tier?: string } | null> {
    if (!customerId || !/^[a-fA-F0-9]{24}$/.test(customerId)) return null;

    const { default: mongoose } = await import('mongoose');
    const Patient = mongoose.model('Patient');
    const customer = await Patient.findById(customerId)
      .select('memberBenefits')
      .lean() as { memberBenefits?: { discountPercentage?: number; membershipTier?: string } } | null;

    if (!customer?.memberBenefits?.discountPercentage) return null;

    const discountRate = customer.memberBenefits.discountPercentage;

    // Batch-fetch discount flags for eligible products
    const eligibleProductIds = items
      .filter(item =>
        DISCOUNT_ELIGIBLE_ITEM_TYPES.has(item.itemType || '') &&
        item.productId &&
        /^[a-fA-F0-9]{24}$/.test(item.productId)
      )
      .map(item => item.productId as string);

    const discountFlagsMap = new Map<string, boolean>();
    if (eligibleProductIds.length > 0) {
      const products = await Product.find(
        { _id: { $in: eligibleProductIds } },
        { discountFlags: 1 }
      ).lean() as Array<{ _id: unknown; discountFlags?: { discountableForAll?: boolean; discountableForMembers?: boolean } }>;

      for (const p of products) {
        const discountableForAll = p.discountFlags?.discountableForAll !== false;
        const discountableForMembers = p.discountFlags?.discountableForMembers !== false;
        discountFlagsMap.set(String(p._id), discountableForAll && discountableForMembers);
      }
    }

    for (const item of items) {
      const itemSubtotal = item.unitPrice * item.quantity;

      if (normalizeManualItemDiscount(item)) {
        continue;
      }

      if (!DISCOUNT_ELIGIBLE_ITEM_TYPES.has(item.itemType || '')) {
        // Non-eligible items get no member discount
        item.discountAmount = 0;
        item.totalPrice = itemSubtotal;
        continue;
      }

      // Check product-level discount flag
      if (item.productId && /^[a-fA-F0-9]{24}$/.test(item.productId)) {
        const isDiscountable = discountFlagsMap.get(item.productId);
        if (isDiscountable === false) {
          item.discountAmount = 0;
          item.totalPrice = itemSubtotal;
          continue;
        }
      }

      const discount = itemSubtotal * (discountRate / 100);
      item.discountAmount = roundCurrency(discount);
      item.discountSource = item.discountAmount > 0 ? 'membership' : undefined;
      item.totalPrice = roundCurrency(itemSubtotal - item.discountAmount);
    }

    return {
      percentage: discountRate,
      tier: customer.memberBenefits.membershipTier,
    };
  }

  private finalizeLineTotals(items: CalculatedItem[]): void {
    for (const item of items) {
      if (isManualDiscountSource(item.discountSource)) {
        normalizeManualItemDiscount(item);
        continue;
      }

      const itemSubtotal = roundCurrency((item.unitPrice ?? 0) * (item.quantity ?? 0));
      const discountAmount = roundCurrency(
        Math.min(Math.max(item.discountAmount ?? 0, 0), Math.max(itemSubtotal, 0))
      );

      item.discountAmount = discountAmount;
      item.totalPrice = roundCurrency(itemSubtotal - discountAmount);

      if (discountAmount <= 0 && item.discountSource === 'membership') {
        delete item.discountSource;
      }
    }
  }
}

export const transactionCalculationService = new TransactionCalculationService();
