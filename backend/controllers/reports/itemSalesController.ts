import { Request, Response } from 'express';
import { PipelineStage } from 'mongoose';
import { ItemSalesData, ItemSalesResponse, ItemSalesFilters } from '../../types/reports/item-sales.types.js';
import { Transaction } from '../../models/Transaction.js';
import { Product } from '../../models/Product.js';
import { Bundle } from '../../models/Bundle.js';

export class ItemSalesController {
  static async getItemSalesReport(
    req: Request<Record<string, never>, Record<string, never>, Record<string, never>, ItemSalesFilters>,
    res: Response<ItemSalesResponse>
  ): Promise<void> {
    try {
      
      const { startDate, endDate, productId, categoryId, minSales, sortBy = 'total_sales', sortOrder = 'desc' } = req.query;

      // Build match conditions with proper typing
      const matchConditions: Record<string, unknown> = {
        type: 'COMPLETED',
        status: 'completed'
      };


      // Add date filters if provided
      if (startDate || endDate) {
        matchConditions.createdAt = {} as Record<string, Date>;
        
        if (startDate) {
          const startDateObj = new Date(startDate);
          (matchConditions.createdAt as Record<string, Date>).$gte = startDateObj;
        }
        
        if (endDate) {
          const endDateObj = new Date(endDate);
          (matchConditions.createdAt as Record<string, Date>).$lte = endDateObj;
        }
      }


      // Build aggregation pipeline to get sales data first (without cost calculation)
      const pipeline: PipelineStage[] = [
        // Match only completed sales transactions
        {
          $match: matchConditions
        },
        // Unwind the items array to work with individual items
        {
          $unwind: '$items'
        }
      ];

      // Add product filter if specified
      if (productId) {
        pipeline.push({
          $match: {
            'items.productId': productId
          }
        });
      }

      // Add category filter if specified
      if (categoryId) {
        pipeline.push({
          $match: {
            'items.categoryId': categoryId
          }
        });
      }

      // Group by product to calculate metrics
      // Include costPrice from transaction items (stamped at point of sale)
      pipeline.push({
        $group: {
          _id: '$items.productId',
          item_name: { $first: '$items.name' },
          total_sales: { $sum: '$items.totalPrice' },
          total_discount: { $sum: { $ifNull: ['$items.discountAmount', 0] } },
          total_tax: {
            $sum: {
              $multiply: [
                '$items.totalPrice',
                { $divide: [{ $ifNull: ['$items.tax', 0] }, 100] }
              ]
            }
          },
          quantity_sold: { $sum: '$items.quantity' },
          base_unit: { $first: { $ifNull: ['$items.baseUnit', 'unit'] } },
          average_list_price: { $avg: '$items.unitPrice' },
          last_sale_date: { $max: '$createdAt' },
          item_type: { $first: { $ifNull: ['$items.itemType', 'product'] } },
          // Sum cost directly from transaction items that have costPrice stamped
          total_cost_from_items: {
            $sum: {
              $cond: [
                { $gt: [{ $ifNull: ['$items.costPrice', 0] }, 0] },
                { $multiply: [{ $ifNull: ['$items.costPrice', 0] }, '$items.quantity'] },
                0
              ]
            }
          },
          // Count how many items in this group have costPrice stamped
          items_with_cost: {
            $sum: {
              $cond: [{ $gt: [{ $ifNull: ['$items.costPrice', 0] }, 0] }, 1, 0]
            }
          },
          total_items_count: { $sum: 1 }
        }
      });

      // Get initial results without cost data
      const salesResults = await Transaction.aggregate(pipeline);

      // Normalize all product identifiers to strings
      // These could be ObjectIds (as objects or strings) or product names (legacy data)
      const normalizedIds: string[] = [];
      const validObjectIds: string[] = [];
      const productNames: string[] = [];

      for (const result of salesResults) {
        // Normalize ObjectId objects to strings
        let idStr: string;
        if (result._id && typeof result._id === 'object' && result._id.toString) {
          idStr = result._id.toString();
        } else {
          idStr = String(result._id || '');
        }
        normalizedIds.push(idStr);

        // Check if it's a valid ObjectId format (24 hex characters)
        if (idStr.length === 24 && /^[a-fA-F0-9]{24}$/.test(idStr)) {
          validObjectIds.push(idStr);
        } else if (idStr && idStr !== 'undefined' && idStr !== 'null') {
          // It's likely a product name (legacy transaction data)
          productNames.push(idStr);
        }
      }

      // Fetch products by ObjectId
      const productsByIdPromise = validObjectIds.length > 0
        ? Product.find({ _id: { $in: validObjectIds } }).select('_id name costPrice').lean()
        : Promise.resolve([] as Array<{ _id: unknown; name: string; costPrice?: number }>);

      // For name-based lookups, we need to handle legacy naming differences
      // Build regex patterns for case-insensitive matching and stripping suffixes like (BOTTLE), (GRAM), etc.

      // Brand prefix mappings (transaction name → database prefix)
      const brandMappings: Record<string, string> = {
        'MEDIHERB': 'MH',
        'MediHerb': 'MH',
        'PHYTO': 'Phyto',
      };

      // Generic/short names that should NOT be matched to products
      const genericNames = new Set([
        'herb', 'blend', 'oil', 'cream', 'spray', 'tincture', 'tinture',
        'body oil', 'skin cream', 'skin oil', 'herb cream', 'herbal oil',
        'herbal cream', 'herb oil', 'herb blend', 'herb spray', 'eye spray',
        'rose oil', 'limb oil', 'nasal wash', 'oil pull', 'mouth pulling',
        'lymph', 'cough', 'dry cough', 'dry throat', 'rhinitis', 'prostate',
        'adrenal', 'hormonal', 'ecm', 'ptsd', 'violet', 'yarrow', 'peony',
        'baptisa', 'sleep blend', 'mouth gargle',
      ]);

      const namePatterns = productNames.map(name => {
        // Remove ALL parenthetical suffixes like (BOTTLE), (GRAM), (ML), (60 TABLETS), (1x unit), etc.
        let baseName = name.replace(/\s*\([^)]+\)/g, '').trim();

        // Skip generic/short names that would false-match real products
        const lowerBase = baseName.toLowerCase().trim();
        if (genericNames.has(lowerBase) || baseName.length <= 4) {
          return { original: name, pattern: null };
        }

        // Apply brand prefix mappings
        for (const [from, to] of Object.entries(brandMappings)) {
          if (baseName.toUpperCase().startsWith(from.toUpperCase())) {
            baseName = to + baseName.slice(from.length);
            break;
          }
        }

        // Normalize apostrophes: "Johns" should match "John's"
        let escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        escaped = escaped.replace(/(\w)'(\w)/g, "$1'?$2");
        escaped = escaped.replace(/(\w)s\b/g, "$1'?s");

        // Anchor to full string match (not substring) — prevents "Herb" matching "MH Herb Complex"
        return { original: name, pattern: new RegExp(`^${escaped}$`, 'i') };
      });

      // Fetch all products once for name matching (more efficient than multiple queries)
      const allProductsForNameMatch = productNames.length > 0
        ? Product.find({}).select('_id name costPrice').lean()
        : Promise.resolve([] as Array<{ _id: unknown; name: string; costPrice?: number }>);

      const [productsById, allProducts] = await Promise.all([productsByIdPromise, allProductsForNameMatch]);

      // Match products by name using flexible matching
      const productsByName: Array<{ originalName: string; product: { _id: unknown; name: string; costPrice?: number } }> = [];
      for (const { original, pattern } of namePatterns) {
        if (!pattern) continue; // Skip generic/short names
        const match = (allProducts as Array<{ _id: unknown; name: string; costPrice?: number }>).find(p => pattern.test(p.name));
        if (match) {
          productsByName.push({ originalName: original, product: match });
        }
      }

      // Create a map of identifier -> costPrice
      // Keys will be either ObjectId strings or product names, matching what's in transactions
      // ONLY store entries with costPrice > 0 — zero/undefined means "no cost data"
      const costPriceMap = new Map<string, number>();

      // Add products found by ObjectId (only if they have a real cost)
      productsById.forEach(product => {
        if (product.costPrice && product.costPrice > 0) {
          costPriceMap.set(String(product._id), product.costPrice);
        }
      });

      // Add products found by name (only if they have a real cost)
      productsByName.forEach(({ originalName, product }) => {
        if (product.costPrice && product.costPrice > 0) {
          costPriceMap.set(originalName, product.costPrice);
        }
      });

      // ================================================================
      // Bundle cost lookup: for IDs not found in Product collection,
      // check Bundle collection and calculate cost from bundle products
      // ================================================================
      const unmatchedObjectIds = validObjectIds.filter(id => !costPriceMap.has(id));
      if (unmatchedObjectIds.length > 0) {
        const bundles = await Bundle.find(
          { _id: { $in: unmatchedObjectIds } }
        ).select('_id bundleProducts bundlePrice').lean();

        for (const bundle of bundles) {
          // Calculate bundle cost from its component products
          let bundleCost = 0;
          if (bundle.bundleProducts && Array.isArray(bundle.bundleProducts)) {
            for (const bp of bundle.bundleProducts) {
              const bpId = String(bp.productId || '');
              // Try from existing cost map first, then from products fetched by ID
              let componentCost = costPriceMap.get(bpId);
              if (componentCost === undefined) {
                const prod = await Product.findOne(
                  { _id: bpId },
                  { costPrice: 1 }
                ).lean();
                componentCost = (prod as { costPrice?: number } | null)?.costPrice || 0;
              }
              bundleCost += componentCost * (bp.quantity || 1);
            }
          }
          // Store the per-unit cost (bundle is sold as 1 unit) — only if we got real costs
          if (bundleCost > 0) {
            costPriceMap.set(String(bundle._id), bundleCost);
          }
        }
      }

      // Calculate final results with actual cost data
      // Priority: (1) costPrice from transaction items, (2) Product/Bundle lookup
      const results: ItemSalesData[] = salesResults.map((item, index) => {
        const productId = normalizedIds[index];
        const itemType = item.item_type || 'product';

        // Check if we have cost data from the transaction items themselves
        const hasItemLevelCost = item.items_with_cost > 0 && item.total_cost_from_items > 0;
        // Check if we have cost data from Product/Bundle lookup
        const hasLookupCost = costPriceMap.has(productId);

        let total_cost: number;
        let costPerUnit: number;
        let hasCostData: boolean;

        if (hasItemLevelCost) {
          // Best source: costPrice stamped on the transaction items at point of sale
          total_cost = item.total_cost_from_items;
          costPerUnit = item.quantity_sold > 0 ? total_cost / item.quantity_sold : 0;
          hasCostData = true;
        } else if (hasLookupCost) {
          // Fallback: Product/Bundle lookup
          costPerUnit = costPriceMap.get(productId) || 0;
          total_cost = item.quantity_sold * costPerUnit;
          hasCostData = costPerUnit > 0;
        } else {
          // No cost data available
          total_cost = 0;
          costPerUnit = 0;
          hasCostData = false;
        }

        // Calculate margin
        let margin: number;
        if (item.total_sales > 0) {
          if (hasCostData) {
            margin = (item.total_sales - total_cost) / item.total_sales;
          } else {
            margin = -1; // N/A — no cost data
          }
        } else {
          margin = 0;
        }

        return {
          item_name: item.item_name,
          total_sales: item.total_sales,
          total_cost: total_cost,
          total_discount: item.total_discount,
          total_tax: item.total_tax,
          quantity_sold: item.quantity_sold,
          base_unit: item.base_unit,
          average_list_price: item.average_list_price,
          average_cost_price: costPerUnit,
          last_sale_date: item.last_sale_date,
          margin: margin,
          has_cost_data: hasCostData,
          item_type: itemType
        };
      });

      // Filter out non-product entries (invoices, misc items, shipping, credits, etc.)
      const excludePatterns = [
        /^Invoice\s+dated/i,           // "Invoice dated 29/08/2025, posted 05/10/2025"
        /^Unknown\s+(Item|Product)$/i, // "Unknown Item", "Unknown Product"
        /^Shipping/i,                  // "Shipping", "Shipping Fees", "Shipping Cost", "Shipping Ninjavan"
        /^Shipment$/i,                 // "Shipment"
        /^Delivery$/i,                 // "Delivery"
        /^Postage/i,                   // "Postage"
        /^Credit/i,                    // "Credit: test", "Credit Card Fees"
        /^Pay\s*Now\s+fees?/i,         // "Pay Now fees"
        /^Misc(ellaneous)?[:]/i,       // "Misc:" entries
        /^CONSULTATION/i,              // "CONSULTATION 80", "CONSULTATION 180", etc.
        /^Consultation\s+Fee/i,        // "Consultation Fee"
        /EPIMAPPING/i,                 // "EPIMAPPING", "EPIMAPPINGFeb28"
        /^EPI-?MAP/i,                  // "EPI-MAP Mum day"
        /^Complete\s+microbiome/i,     // "Complete microbiome map"
        /^(Advanced|Essential)\s+(hormone|mineral)/i, // Lab tests
        /^Estrogen\s+elite/i,          // "Estrogen elite dried urine"
        /Retreat/i,                    // "Retreat2025earlybirdendmarch", "Retreat Nov 25 - 29"
        /^No\s+show\s+charge/i,        // "No show charge"
        /^Rental/i,                    // "rental dec 25", "Oct 25 Rental"
        /^Offset/i,                    // "offset" entries
        /^test\b/i,                    // "test", "test blend", "test bottle"
        /^aaa\b/i,                     // "aaa product test miko...", "aaaa CSA test produt 1"
        /^asd$/i,                      // "asd"
        /^xxx/i,                       // test entries
        /\btest\s+prod/i,             // "test product", "test produt"
        /^CR\d+\s+test/i,             // "CR08 test"
      ];

      let filteredResults = results.filter(item => {
        // Check if item name matches any exclude pattern
        const shouldExclude = excludePatterns.some(pattern => pattern.test(item.item_name));
        return !shouldExclude;
      });

      // Apply minimum sales filter if specified
      if (minSales && !isNaN(Number(minSales))) {
        filteredResults = filteredResults.filter(item => item.total_sales >= Number(minSales));
      }

      // Sort results
      filteredResults.sort((a, b) => {
        const aValue = a[sortBy as keyof ItemSalesData] as number;
        const bValue = b[sortBy as keyof ItemSalesData] as number;
        
        if (sortOrder === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });


      const response = {
        data: filteredResults,
        success: true,
        metadata: {
          totalItems: filteredResults.length,
          generatedAt: new Date().toISOString()
        }
      };


      res.json(response);
    } catch (error) {
      
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      res.status(500).json({
        data: [],
        success: false,
        error: `Failed to fetch item sales data: ${errorMessage}`
      });
    }
  }
}