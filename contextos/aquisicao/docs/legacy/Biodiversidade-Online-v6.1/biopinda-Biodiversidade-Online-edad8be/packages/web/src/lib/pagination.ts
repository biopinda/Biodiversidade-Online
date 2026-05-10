/**
 * Pagination Utilities
 * Handles pagination logic and metadata
 */

export interface PaginationParams {
  limit: number
  offset: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
  nextOffset?: number
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMetadata<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number
): PaginatedResponse<T> {
  const hasMore = offset + data.length < total
  const nextOffset = hasMore ? offset + limit : undefined

  return {
    data,
    total,
    limit,
    offset,
    hasMore,
    nextOffset
  }
}

/**
 * Validate and normalize pagination parameters
 */
export function normalizePagination(
  limit: number,
  offset: number,
  maxLimit: number = 10000
): PaginationParams {
  return {
    limit: Math.min(Math.max(limit, 1), maxLimit),
    offset: Math.max(offset, 0)
  }
}

/**
 * Build MongoDB skip/limit for pagination
 */
export function buildMongoDBPagination(
  limit: number,
  offset: number
): { skip: number; limit: number } {
  return {
    skip: offset,
    limit
  }
}

/**
 * Format pagination header for API responses
 */
export function buildPaginationHeaders(
  response: PaginatedResponse<unknown>
): Record<string, string> {
  return {
    'X-Total-Count': response.total.toString(),
    'X-Page-Size': response.limit.toString(),
    'X-Page-Offset': response.offset.toString(),
    'X-Has-More': response.hasMore.toString()
  }
}
