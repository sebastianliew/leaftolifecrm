/**
 * Common validation schemas for MongoDB operations
 * Uses Zod for type-safe validation
 */

import { z } from 'zod';

/**
 * MongoDB ObjectId validation schema
 */
export const mongoIdSchema = z.string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId format')
  .transform(val => val); // Ensure it's returned as string

/**
 * Pagination schema with sensible defaults
 */
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
});

/**
 * Sort schema that validates sort fields and direction
 */
export const createSortSchema = (allowedFields: string[]) => {
  const sortFields = allowedFields.flatMap(field => [field, `-${field}`]);
  return z.enum(sortFields as [string, ...string[]]).optional();
};

/**
 * Search query schema for product searches
 */
export const productSearchSchema = z.object({
  search: z.string().max(100).optional(),
  category: mongoIdSchema.optional(),
  brand: mongoIdSchema.optional(),
  status: z.enum(['active', 'inactive', 'all']).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.coerce.boolean().optional(),
  ...paginationSchema.shape,
  sort: createSortSchema(['name', 'createdAt', 'updatedAt', 'sellingPrice', 'currentStock']).optional()
});

/**
 * User search schema
 */
export const userSearchSchema = z.object({
  search: z.string().max(100).optional(),
  role: z.enum(['admin', 'user', 'staff']).optional(),
  isActive: z.coerce.boolean().optional(),
  ...paginationSchema.shape,
  sort: createSortSchema(['name', 'email', 'createdAt', 'lastLogin']).optional()
});

/**
 * Transaction search schema
 */
export const transactionSearchSchema = z.object({
  search: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['completed', 'pending', 'cancelled']).optional(),
  customerId: mongoIdSchema.optional(),
  ...paginationSchema.shape,
  sort: createSortSchema(['transactionNumber', 'createdAt', 'totalAmount']).optional()
});

/**
 * Generic ID parameter schema
 */
export const idParamSchema = z.object({
  id: mongoIdSchema
});

/**
 * Date range schema
 */
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
}).refine(
  data => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'Start date must be before or equal to end date' }
);

/**
 * Safe string schema that prevents injection
 */
export const safeStringSchema = (maxLength: number = 100) => 
  z.string()
    .max(maxLength)
    .regex(/^[^<>'"\\]*$/, 'String contains invalid characters')
    .trim();

/**
 * Email schema
 */
export const emailSchema = z.string()
  .email('Invalid email format')
  .toLowerCase()
  .trim();

/**
 * Phone number schema
 */
export const phoneSchema = z.string()
  .regex(/^[+]?[\d\s()-]+$/, 'Invalid phone number format')
  .min(10, 'Phone number too short')
  .max(20, 'Phone number too long');

/**
 * Create a schema for bulk operations
 */
export const bulkOperationSchema = <T extends z.ZodTypeAny>(itemSchema: T) => 
  z.object({
    items: z.array(itemSchema).min(1).max(100),
    operation: z.enum(['create', 'update', 'delete'])
  });

/**
 * Error response schema
 */
export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  code: z.string().optional(),
  details: z.unknown().optional()
});

/**
 * Success response schema
 */
export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: dataSchema.optional()
  });

/**
 * Helper function to validate request body
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}

/**
 * Helper function to validate query parameters
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): T {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return schema.parse(params);
}