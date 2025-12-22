export interface PaginationParams {
  page?: number
  limit?: number
  cursor?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginationResult<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
    nextCursor?: string
  }
}

interface MongooseQueryChain<T> {
  sort: (sort: Record<string, 1 | -1>) => MongooseQueryChain<T>;
  skip: (skip: number) => MongooseQueryChain<T>;
  limit: (limit: number) => MongooseQueryChain<T>;
  lean: () => MongooseQueryChain<T>;
  populate: (populate: string | string[]) => MongooseQueryChain<T>;
  exec: () => Promise<T[]>;
}

export interface PaginationOptions {
  defaultLimit?: number
  maxLimit?: number
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: PaginationOptions = {}
): PaginationParams {
  const { defaultLimit = 50, maxLimit = 100 } = options
  
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const requestedLimit = parseInt(searchParams.get('limit') || String(defaultLimit))
  const limit = Math.min(Math.max(1, requestedLimit), maxLimit)
  const cursor = searchParams.get('cursor') || undefined
  const sortBy = searchParams.get('sortBy') || 'createdAt'
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

  return { page, limit, cursor, sortBy, sortOrder }
}

export function createPaginationResult<T>(
  data: T[],
  totalCount: number,
  params: PaginationParams
): PaginationResult<T> {
  const { page = 1, limit = 50 } = params
  const totalPages = Math.ceil(totalCount / limit)

  return {
    data,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextCursor: params.cursor
    }
  }
}

export function calculateSkip(page: number, limit: number): number {
  return (page - 1) * limit
}

// MongoDB aggregation pipeline helper for pagination
export function createPaginationPipeline(
  matchStage: Record<string, unknown>,
  page: number,
  limit: number,
  sortOptions: Record<string, 1 | -1> = { createdAt: -1 }
) {
  const skip = calculateSkip(page, limit)
  
  return [
    { $match: matchStage },
    { $sort: sortOptions },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: limit }]
      }
    },
    {
      $project: {
        data: 1,
        total: { $arrayElemAt: ["$metadata.total", 0] }
      }
    }
  ]
}

// Helper for Mongoose queries
export async function paginateQuery<T>(
  model: {
    countDocuments: (query: Record<string, unknown>) => Promise<number>;
    find: (query: Record<string, unknown>) => MongooseQueryChain<T>;
  },
  query: Record<string, unknown>,
  params: PaginationParams,
  populate?: string | string[]
): Promise<PaginationResult<T>> {
  const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = params
  const skip = calculateSkip(page, limit)
  
  // Get total count
  const totalCount = await model.countDocuments(query)
  
  // Build sort object
  const sort: Record<string, 1 | -1> = {}
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1
  
  // Execute query
  let queryBuilder = model
    .find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean()
  
  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach(field => {
        queryBuilder = queryBuilder.populate(field)
      })
    } else {
      queryBuilder = queryBuilder.populate(populate)
    }
  }
  
  const data = await queryBuilder.exec()
  
  return createPaginationResult(data, totalCount, params)
}