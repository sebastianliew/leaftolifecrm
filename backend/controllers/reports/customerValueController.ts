import { Request, Response } from 'express';
import { PipelineStage } from 'mongoose';
import { 
  CustomerValueData, 
  CustomerValueResponse, 
  CustomerValueFilters,
  CustomerValueAggregation 
} from '../../types/reports/customer-value.types.js';
import { Transaction } from '../../models/Transaction.js';
import { Product } from '../../models/Product.js';
import { Patient } from '../../models/Patient.js';

export class CustomerValueController {
  static async getCustomerValueReport(
    req: Request<Record<string, never>, Record<string, never>, Record<string, never>, CustomerValueFilters>,
    res: Response<CustomerValueResponse>
  ): Promise<void> {
    try {
      const { 
        startDate, 
        endDate, 
        minRevenue, 
        limit = '20', 
        sortBy = 'revenue', 
        sortOrder = 'desc',
        includeInactive,
        searchQuery
      } = req.query;

      // Build match conditions
      const matchConditions: Record<string, unknown> = {
        type: 'COMPLETED',
        status: 'completed'
      };

      // Add date filters if provided
      if (startDate || endDate) {
        matchConditions.createdAt = {} as Record<string, Date>;
        
        if (startDate) {
          (matchConditions.createdAt as Record<string, Date>).$gte = new Date(startDate);
        }
        
        if (endDate) {
          (matchConditions.createdAt as Record<string, Date>).$lte = new Date(endDate);
        }
      }

      // Add search filter if provided
      if (searchQuery) {
        matchConditions.$or = [
          { customerName: { $regex: searchQuery, $options: 'i' } },
          { customerEmail: { $regex: searchQuery, $options: 'i' } },
          { customerPhone: { $regex: searchQuery, $options: 'i' } }
        ];
      }

      // Build aggregation pipeline
      const pipeline: PipelineStage[] = [
        // Match completed sales transactions
        {
          $match: matchConditions
        },
        // Group by customer to calculate metrics
        {
          $group: {
            _id: {
              $cond: [
                { $and: [{ $ne: ['$customerEmail', null] }, { $ne: ['$customerEmail', ''] }] },
                '$customerEmail',
                '$customerName'
              ]
            },
            customerName: { $first: '$customerName' },
            customerEmail: { $first: '$customerEmail' },
            customerPhone: { $first: '$customerPhone' },
            customerAddress: { $first: '$customerAddress' },
            totalRevenue: { $sum: '$totalAmount' },
            totalOrders: { $sum: 1 },
            totalDiscount: { $sum: { $ifNull: ['$discountAmount', 0] } },
            firstPurchase: { $min: '$createdAt' },
            lastPurchase: { $max: '$createdAt' },
            transactionIds: { $push: '$_id' },
            // Collect all items for later analysis
            allItems: { $push: '$items' },
            // Collect payment methods
            paymentMethods: { $push: '$paymentMethod' },
            // Count custom blends and bundles
            customBlendsCount: {
              $sum: {
                $cond: [
                  { $eq: ['$transactionType', 'customBlend'] },
                  1,
                  0
                ]
              }
            },
            bundlesCount: {
              $sum: {
                $cond: [
                  { $eq: ['$transactionType', 'bundle'] },
                  1,
                  0
                ]
              }
            }
          }
        },
        // Calculate additional metrics
        {
          $project: {
            customerName: 1,
            customerEmail: 1,
            customerPhone: 1,
            customerAddress: 1,
            totalRevenue: 1,
            totalOrders: 1,
            totalDiscount: 1,
            firstPurchase: 1,
            lastPurchase: 1,
            transactionIds: 1,
            customBlendsCount: 1,
            bundlesCount: 1,
            // Flatten items array
            items: {
              $reduce: {
                input: '$allItems',
                initialValue: [],
                in: { $concatArrays: ['$$value', '$$this'] }
              }
            },
            // Count payment methods
            paymentMethods: {
              $map: {
                input: { $setUnion: '$paymentMethods' },
                as: 'method',
                in: {
                  method: '$$method',
                  count: {
                    $size: {
                      $filter: {
                        input: '$paymentMethods',
                        cond: { $eq: ['$$this', '$$method'] }
                      }
                    }
                  }
                }
              }
            },
            // Calculate days since last order
            daysSinceLastOrder: {
              $cond: [
                { $ne: ['$lastPurchase', null] },
                {
                  $divide: [
                    { $subtract: [new Date(), '$lastPurchase'] },
                    1000 * 60 * 60 * 24 // Convert to days
                  ]
                },
                0
              ]
            }
          }
        }
      ];

      // Apply minimum revenue filter if specified
      if (minRevenue && !isNaN(Number(minRevenue))) {
        pipeline.push({
          $match: {
            totalRevenue: { $gte: Number(minRevenue) }
          }
        });
      }

      // Get initial results
      const customerResults: CustomerValueAggregation[] = await Transaction.aggregate(pipeline);

      // Get all unique product IDs from all customer purchases
      const allProductIds = new Set<string>();
      customerResults.forEach(customer => {
        customer.items?.forEach(item => {
          if (item.productId && typeof item.productId === 'string') {
            allProductIds.add(item.productId);
          }
        });
      });

      // Filter out non-ObjectId values (custom blends, bundles, etc.)
      const validProductIds = Array.from(allProductIds).filter(id => {
        // Check if it's a valid 24-character hex string (MongoDB ObjectId format)
        return /^[a-fA-F0-9]{24}$/.test(id);
      });

      // Fetch actual cost prices for valid products
      const products = await Product.find(
        { _id: { $in: validProductIds } },
        { _id: 1, costPrice: 1 }
      ).lean();

      // Create a map of productId -> costPrice
      const costPriceMap = new Map<string, number>();
      products.forEach(product => {
        costPriceMap.set(String(product._id), product.costPrice || 0);
      });

      // Look up patient data for membership information
      const customerEmails = customerResults
        .map(c => c.customerEmail)
        .filter(email => email);

      const patients = await Patient.find(
        { email: { $in: customerEmails } },
        { 
          email: 1, 
          'memberBenefits.membershipTier': 1,
          'memberBenefits.discountPercentage': 1
        }
      ).lean();

      // Create a map of email -> patient data
      const patientMap = new Map();
      patients.forEach(patient => {
        patientMap.set(patient.email, patient);
      });

      // Process results and calculate detailed metrics
      const processedResults: CustomerValueData[] = customerResults.map((customer, index) => {
        // Calculate total cost based on actual product costs
        let totalCost = 0;
        const productAnalysis = new Map<string, { name: string; quantity: number; revenue: number }>();

        customer.items?.forEach(item => {
          let itemCost = 0;
          
          // Convert productId to string if it exists
          const productIdStr = item.productId ? String(item.productId) : '';
          
          // Check if it's a custom blend or bundle
          if (productIdStr.startsWith('custom_blend_')) {
            // For custom blends, assume a 35% margin (65% cost)
            itemCost = (item.totalPrice || item.revenue || 0) * 0.65;
          } else if (productIdStr.startsWith('bundle_')) {
            // For bundles, assume a 30% margin (70% cost)
            itemCost = (item.totalPrice || item.revenue || 0) * 0.70;
          } else if (productIdStr) {
            // For regular products, use the actual cost price
            const costPrice = costPriceMap.get(productIdStr) || 0;
            itemCost = item.quantity * costPrice;
          }
          
          totalCost += itemCost;

          // Aggregate product analysis
          const existing = productAnalysis.get(item.name);
          if (existing) {
            existing.quantity += item.quantity;
            existing.revenue += item.revenue || item.totalPrice || 0;
          } else {
            productAnalysis.set(item.name, {
              name: item.name,
              quantity: item.quantity,
              revenue: item.revenue || item.totalPrice || 0
            });
          }
        });

        // Get top products by revenue
        const topProducts = Array.from(productAnalysis.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5); // Top 5 products

        // Calculate margin
        const totalMargin = customer.totalRevenue - totalCost;
        const marginPercentage = customer.totalRevenue > 0 
          ? (totalMargin / customer.totalRevenue) * 100 
          : 0;

        // Calculate purchase frequency (days between orders)
        const daysBetweenFirstAndLast = customer.firstPurchase && customer.lastPurchase
          ? Math.max(
              1,
              (customer.lastPurchase.getTime() - customer.firstPurchase.getTime()) / (1000 * 60 * 60 * 24)
            )
          : 0;
        const purchaseFrequency = customer.totalOrders > 1 && daysBetweenFirstAndLast > 0
          ? Math.round(daysBetweenFirstAndLast / (customer.totalOrders - 1))
          : 0;

        // Get preferred payment method
        const preferredPayment = customer.paymentMethods
          .sort((a, b) => b.count - a.count)[0]?.method || 'Unknown';

        // Get membership data
        const patientData = customer.customerEmail 
          ? patientMap.get(customer.customerEmail) 
          : null;

        return {
          rank: index + 1, // Will be recalculated after sorting
          customerName: customer.customerName,
          customerEmail: customer.customerEmail,
          customerPhone: customer.customerPhone,
          customerAddress: customer.customerAddress,
          metrics: {
            totalRevenue: customer.totalRevenue,
            totalOrders: customer.totalOrders,
            averageOrderValue: customer.totalRevenue / customer.totalOrders,
            totalCost: totalCost,
            totalMargin: totalMargin,
            marginPercentage: marginPercentage
          },
          timeline: {
            firstPurchase: customer.firstPurchase || new Date(),
            lastPurchase: customer.lastPurchase || new Date(),
            daysSinceLastOrder: Math.round(customer.daysSinceLastOrder || 0),
            purchaseFrequency: purchaseFrequency
          },
          membership: patientData ? {
            tier: patientData.memberBenefits?.membershipTier || null,
            discountRate: patientData.memberBenefits?.discountPercentage || 0
          } : undefined,
          insights: {
            topProducts: topProducts,
            preferredPaymentMethod: preferredPayment,
            customBlendsCount: customer.customBlendsCount || 0,
            bundlesCount: customer.bundlesCount || 0
          }
        };
      });

      // Sort results based on sortBy parameter
      const sortedResults = processedResults.sort((a, b) => {
        let aValue: number, bValue: number;
        
        switch (sortBy) {
          case 'revenue':
            aValue = a.metrics.totalRevenue;
            bValue = b.metrics.totalRevenue;
            break;
          case 'orders':
            aValue = a.metrics.totalOrders;
            bValue = b.metrics.totalOrders;
            break;
          case 'margin':
            aValue = a.metrics.marginPercentage;
            bValue = b.metrics.marginPercentage;
            break;
          case 'recent':
            aValue = -a.timeline.daysSinceLastOrder; // Negative for recent first
            bValue = -b.timeline.daysSinceLastOrder;
            break;
          case 'frequency':
            aValue = a.timeline.purchaseFrequency;
            bValue = b.timeline.purchaseFrequency;
            break;
          default:
            aValue = a.metrics.totalRevenue;
            bValue = b.metrics.totalRevenue;
        }
        
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      });

      // Apply limit and update ranks
      const limitedResults = limit === 'all' 
        ? sortedResults.map((customer, index) => ({
            ...customer,
            rank: index + 1
          }))
        : sortedResults
            .slice(0, parseInt(limit))
            .map((customer, index) => ({
              ...customer,
              rank: index + 1
            }));

      // Filter out inactive customers if requested
      const finalResults = includeInactive === 'true' 
        ? limitedResults 
        : limitedResults.filter(c => c.timeline.daysSinceLastOrder <= 180); // 6 months

      // Calculate aggregate totals
      const aggregateTotals = finalResults.reduce(
        (acc, customer) => ({
          totalRevenue: acc.totalRevenue + customer.metrics.totalRevenue,
          totalMargin: acc.totalMargin + customer.metrics.totalMargin,
          averageMarginPercentage: 0 // Will calculate after
        }),
        { totalRevenue: 0, totalMargin: 0, averageMarginPercentage: 0 }
      );

      aggregateTotals.averageMarginPercentage = 
        aggregateTotals.totalRevenue > 0 
          ? (aggregateTotals.totalMargin / aggregateTotals.totalRevenue) * 100
          : 0;

      // Get total count of customers (before filtering)
      const totalCustomersCount = sortedResults.length;

      res.json({
        data: finalResults,
        success: true,
        metadata: {
          totalCustomers: finalResults.length,
          totalUniqueCustomers: totalCustomersCount,
          dateRange: {
            start: startDate || 'All time',
            end: endDate || 'Present'
          },
          generatedAt: new Date().toISOString(),
          aggregateTotals: aggregateTotals
        }
      });

    } catch (error) {
      console.error('Error generating customer value report:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      res.status(500).json({
        data: [],
        success: false,
        error: `Failed to generate customer value report: ${errorMessage}`
      });
    }
  }
}