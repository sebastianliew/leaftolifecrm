import { Request, Response } from 'express';
import { PipelineStage } from 'mongoose';
import { ItemSalesData, ItemSalesResponse, ItemSalesFilters } from '../../types/reports/item-sales.types.js';
import { Transaction } from '../../models/Transaction.js';
import { Product } from '../../models/Product.js';

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

      // Group by product to calculate metrics (without cost for now)
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
          item_type: { $first: { $ifNull: ['$items.itemType', 'product'] } }
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

      const namePatterns = productNames.map(name => {
        // Remove ALL parenthetical suffixes like (BOTTLE), (GRAM), (ML), (60 TABLETS), (1x unit), etc.
        let baseName = name.replace(/\s*\([^)]+\)/g, '').trim();

        // Apply brand prefix mappings
        for (const [from, to] of Object.entries(brandMappings)) {
          if (baseName.toUpperCase().startsWith(from.toUpperCase())) {
            baseName = to + baseName.slice(from.length);
            break;
          }
        }

        // Normalize apostrophes: "Johns" should match "John's"
        // Create pattern that matches with or without apostrophe
        let escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Make apostrophes optional and handle missing apostrophes
        escaped = escaped.replace(/(\w)'(\w)/g, "$1'?$2"); // "John's" matches "Johns"
        escaped = escaped.replace(/(\w)s\b/g, "$1'?s"); // "Johns" matches "John's"

        return { original: name, pattern: new RegExp(escaped, 'i') };
      });

      // Fetch all products once for name matching (more efficient than multiple queries)
      const allProductsForNameMatch = productNames.length > 0
        ? Product.find({}).select('_id name costPrice').lean()
        : Promise.resolve([] as Array<{ _id: unknown; name: string; costPrice?: number }>);

      const [productsById, allProducts] = await Promise.all([productsByIdPromise, allProductsForNameMatch]);

      // Match products by name using flexible matching
      const productsByName: Array<{ originalName: string; product: { _id: unknown; name: string; costPrice?: number } }> = [];
      for (const { original, pattern } of namePatterns) {
        const match = (allProducts as Array<{ _id: unknown; name: string; costPrice?: number }>).find(p => pattern.test(p.name));
        if (match) {
          productsByName.push({ originalName: original, product: match });
        }
      }

      // Create a map of identifier -> costPrice
      // Keys will be either ObjectId strings or product names, matching what's in transactions
      const costPriceMap = new Map<string, number>();

      // Add products found by ObjectId
      productsById.forEach(product => {
        costPriceMap.set(String(product._id), product.costPrice || 0);
      });

      // Add products found by name (use original transaction name as key)
      productsByName.forEach(({ originalName, product }) => {
        costPriceMap.set(originalName, product.costPrice || 0);
      });

      // Calculate final results with actual cost data
      const results: ItemSalesData[] = salesResults.map((item, index) => {
        // Use the normalized ID we already computed
        const productId = normalizedIds[index];
        const hasCostData = costPriceMap.has(productId);
        const costPrice = costPriceMap.get(productId) || 0;
        const total_cost = item.quantity_sold * costPrice;
        
        // Special handling for non-product items
        const itemType = item.item_type || 'product';
        const isSpecialItem = ['consultation', 'service', 'custom_blend'].includes(itemType);
        
        // Calculate margin - set to null if cost data is missing for products
        let margin: number;
        if (item.total_sales > 0) {
          if (hasCostData || isSpecialItem) {
            margin = (item.total_sales - total_cost) / item.total_sales;
          } else {
            // For products without cost data, we'll indicate this in the UI
            margin = -1; // Special value to indicate missing data
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
          average_cost_price: costPrice,
          last_sale_date: item.last_sale_date,
          margin: margin,
          has_cost_data: hasCostData || isSpecialItem,
          item_type: itemType
        };
      });

      // Filter out non-product entries (invoices, misc items, shipping, credits, etc.)
      const excludePatterns = [
        /^Invoice\s+dated/i,           // "Invoice dated 29/08/2025, posted 05/10/2025"
        /^Unknown\s+Item$/i,           // "Unknown Item"
        /^Shipping\s+(Fees?|Cost)/i,   // "Shipping Fees", "Shipping Cost"
        /^Credit[:]/i,                 // "Credit: test"
        /^Pay\s*Now\s+fees?/i,         // "Pay Now fees"
        /^Misc(ellaneous)?[:]/i,       // "Misc:" entries
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