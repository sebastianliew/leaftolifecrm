/**
 * MongoDB Query Sanitization Utilities
 * Prevents NoSQL injection attacks by sanitizing user inputs
 */

import { z } from 'zod';

// Type definitions for MongoDB query objects
type MongoQueryValue = string | number | boolean | Date | RegExp | null | undefined | MongoQueryValue[] | MongoQueryObject;
type MongoQueryObject = { [key: string]: MongoQueryValue };
type MongoPipelineStage = { [key: string]: MongoQueryValue };
type MongoSortObject = { [key: string]: 1 | -1 };
type SafeFilterParams = Record<string, string | number | boolean | string[] | undefined>;

/**
 * List of dangerous MongoDB operators that could be used for injection
 */
const DANGEROUS_OPERATORS = [
  '$where',
  '$regex',
  '$options',
  '$expr',
  '$jsonSchema',
  '$text',
  '$search',
  '$geoNear',
  '$near',
  '$nearSphere',
  '$elemMatch',
  '$size',
  '$bitsAllClear',
  '$bitsAllSet',
  '$bitsAnyClear',
  '$bitsAnySet',
  'mapReduce',
  'function',
  'javascript'
];

/**
 * Recursively sanitize a query object by removing dangerous operators
 */
export const sanitizeQuery = (query: MongoQueryValue): MongoQueryValue => {
  if (query === null || query === undefined) {
    return query;
  }

  // Handle primitive types
  if (typeof query !== 'object') {
    return query;
  }

  // Handle arrays
  if (Array.isArray(query)) {
    return query.map(item => sanitizeQuery(item));
  }
  
  // Handle Date and RegExp
  if (query instanceof Date || query instanceof RegExp) {
    return query;
  }

  // Handle objects
  const sanitized: MongoQueryObject = {};
  const queryObj = query as MongoQueryObject;
  
  for (const key in queryObj) {
    // Skip dangerous operators
    if (DANGEROUS_OPERATORS.includes(key)) {
      console.warn(`Dangerous operator "${key}" removed from query`);
      continue;
    }
    
    // Skip keys that start with $ (MongoDB operators) unless whitelisted
    if (key.startsWith('$') && !isWhitelistedOperator(key)) {
      console.warn(`Potentially dangerous operator "${key}" removed from query`);
      continue;
    }
    
    // Recursively sanitize nested objects
    sanitized[key] = sanitizeQuery(queryObj[key]);
  }
  
  return sanitized;
};

/**
 * Whitelist of safe MongoDB operators
 */
const isWhitelistedOperator = (operator: string): boolean => {
  const safeOperators = [
    '$eq', '$ne', '$gt', '$gte', '$lt', '$lte',
    '$in', '$nin', '$exists', '$type',
    '$and', '$or', '$not', '$nor',
    '$all', '$push', '$pull', '$set', '$unset',
    '$inc', '$min', '$max', '$mul',
    '$addToSet', '$pop', '$pullAll', '$rename',
    '$setOnInsert', '$bit', '$currentDate'
  ];
  
  return safeOperators.includes(operator);
};

/**
 * Validate and sanitize MongoDB ObjectId
 */
export const sanitizeObjectId = (id: string): string => {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  
  if (!objectIdRegex.test(id)) {
    throw new Error('Invalid ObjectId format');
  }
  
  return id;
};

/**
 * Zod schemas for common MongoDB queries
 */

// Schema for MongoDB ObjectId
export const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId');

// Schema for pagination parameters
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.string().optional()
});

// Schema for search parameters
export const searchQuerySchema = z.object({
  search: z.string().max(100).nullish().transform(val => val || undefined),
  category: z.string().nullish().transform(val => val || undefined),
  status: z.enum(['active', 'inactive', 'all']).nullish().transform(val => val || undefined),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(['name', 'createdAt', 'updatedAt', '-name', '-createdAt', '-updatedAt']).nullish().transform(val => val || undefined)
});

/**
 * Sanitize search parameters for safe MongoDB queries
 */
export const sanitizeSearchParams = (params: Record<string, unknown>) => {
  return searchQuerySchema.parse(params);
};

/**
 * Build a safe text search query
 * Uses MongoDB text index instead of regex
 */
export const buildTextSearchQuery = (searchTerm: string): MongoQueryObject => {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return {};
  }
  
  // Remove special characters that could break text search
  const cleaned = searchTerm
    .replace(/[<>"'\\]/g, '') // Remove potentially dangerous characters
    .substring(0, 100) // Limit length
    .trim();
  
  if (!cleaned) {
    return {};
  }
  
  // Use MongoDB text search (requires text index)
  return { $text: { $search: cleaned } };
};

/**
 * Build a safe regex query with proper escaping
 * Only use when text search is not available
 */
export const buildSafeRegexQuery = (field: string, value: string): MongoQueryObject => {
  if (!value || typeof value !== 'string') {
    return {};
  }
  
  // Escape special regex characters
  const escaped = value
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
    .substring(0, 50); // Limit length
  
  return {
    [field]: {
      $regex: escaped,
      $options: 'i' // Case insensitive
    }
  };
};

/**
 * Sanitize sort parameters
 */
export const sanitizeSortParams = (sort: string | undefined, allowedFields: string[]): MongoSortObject => {
  if (!sort) {
    return { createdAt: -1 }; // Default sort
  }
  
  const isDescending = sort.startsWith('-');
  const field = isDescending ? sort.substring(1) : sort;
  
  // Check if field is allowed
  if (!allowedFields.includes(field)) {
    return { createdAt: -1 }; // Default sort if invalid field
  }
  
  return { [field]: isDescending ? -1 : 1 };
};

/**
 * Create a safe filter object from user input
 */
export const createSafeFilter = (
  params: SafeFilterParams,
  allowedFields: string[]
): MongoQueryObject => {
  const filter: MongoQueryObject = {};
  
  for (const field of allowedFields) {
    if (params[field] !== undefined && params[field] !== '') {
      // Handle different types of filters
      if (field.endsWith('Id')) {
        // Validate ObjectId fields
        try {
          filter[field] = sanitizeObjectId(String(params[field]));
        } catch {
          // Skip invalid ObjectIds
        }
      } else if (typeof params[field] === 'boolean') {
        filter[field] = params[field];
      } else if (typeof params[field] === 'string') {
        filter[field] = params[field].substring(0, 100); // Limit string length
      } else if (typeof params[field] === 'number') {
        filter[field] = params[field];
      } else if (Array.isArray(params[field])) {
        // Sanitize array values
        filter[field] = { $in: params[field].slice(0, 100) }; // Limit array size
      }
    }
  }
  
  return sanitizeQuery(filter) as MongoQueryObject;
};

/**
 * Validate and sanitize aggregation pipeline
 */
export const sanitizeAggregationPipeline = (pipeline: unknown[]): MongoPipelineStage[] => {
  if (!Array.isArray(pipeline)) {
    throw new Error('Invalid aggregation pipeline');
  }
  
  return pipeline.map(stage => {
    if (typeof stage !== 'object' || stage === null || Array.isArray(stage)) {
      throw new Error('Invalid pipeline stage');
    }
    
    const stageObject = stage as Record<string, unknown>;
    
    // Check for dangerous stages
    const stageKeys = Object.keys(stageObject);
    if (stageKeys.some(key => key === '$where' || key === '$function')) {
      throw new Error('Dangerous aggregation stage detected');
    }
    
    return sanitizeQuery(stageObject as MongoQueryValue) as MongoPipelineStage;
  });
};