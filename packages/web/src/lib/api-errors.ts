/**
 * API Error Handling
 * Standard error response format and HTTP codes
 */

import { logger } from './logger'

export interface APIError {
  status: number
  code: string
  message: string
  details?: Record<string, unknown>
}

export const ErrorCodes = {
  // 400 Bad Request
  INVALID_PARAMS: 'INVALID_PARAMS',
  INVALID_REGION: 'INVALID_REGION',
  INVALID_LIMIT: 'INVALID_LIMIT',
  INVALID_GEOBOX: 'INVALID_GEOBOX',

  // 404 Not Found
  NOT_FOUND: 'NOT_FOUND',
  TAXON_NOT_FOUND: 'TAXON_NOT_FOUND',
  OCCURRENCE_NOT_FOUND: 'OCCURRENCE_NOT_FOUND',

  // 500 Internal Server Error
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TRANSFORMATION_ERROR: 'TRANSFORMATION_ERROR',
  CHAT_ERROR: 'CHAT_ERROR',

  // Service unavailable
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  MONGODB_UNAVAILABLE: 'MONGODB_UNAVAILABLE',
  CLAUDE_API_UNAVAILABLE: 'CLAUDE_API_UNAVAILABLE'
}

/**
 * Build error response object
 */
export function buildErrorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): APIError {
  return {
    status,
    code,
    message,
    details
  }
}

/**
 * Create standard error responses
 */
export const StandardErrors = {
  invalidParams: (details?: Record<string, unknown>) =>
    buildErrorResponse(
      400,
      ErrorCodes.INVALID_PARAMS,
      'Invalid request parameters',
      details
    ),

  invalidRegion: (value?: string) =>
    buildErrorResponse(
      400,
      ErrorCodes.INVALID_REGION,
      `Invalid region: ${value || 'unknown'}`,
      { received: value }
    ),

  invalidLimit: (value?: string) =>
    buildErrorResponse(
      400,
      ErrorCodes.INVALID_LIMIT,
      `Invalid limit: ${value || 'unknown'}. Must be between 1 and 10000`,
      { received: value }
    ),

  invalidGeobox: (value?: string) =>
    buildErrorResponse(
      400,
      ErrorCodes.INVALID_GEOBOX,
      'Invalid geobox format. Expected: minLat,minLon,maxLat,maxLon',
      { received: value }
    ),

  notFound: (resource: string) =>
    buildErrorResponse(
      404,
      ErrorCodes.NOT_FOUND,
      `${resource} not found`,
      { resource }
    ),

  databaseError: (details?: Record<string, unknown>) =>
    buildErrorResponse(
      500,
      ErrorCodes.DATABASE_ERROR,
      'Database error occurred',
      details
    ),

  internalError: (details?: Record<string, unknown>) =>
    buildErrorResponse(
      500,
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      details
    ),

  mongoDbUnavailable: () =>
    buildErrorResponse(
      503,
      ErrorCodes.MONGODB_UNAVAILABLE,
      'MongoDB service is temporarily unavailable'
    ),

  claudeApiUnavailable: () =>
    buildErrorResponse(
      503,
      ErrorCodes.CLAUDE_API_UNAVAILABLE,
      'Claude API service is temporarily unavailable'
    ),

  serviceUnavailable: () =>
    buildErrorResponse(
      503,
      ErrorCodes.SERVICE_UNAVAILABLE,
      'Service temporarily unavailable'
    )
}

/**
 * Create JSON error response for Astro
 */
export function createErrorResponse(
  error: APIError
): { body: string; status: number } {
  return {
    body: JSON.stringify(error),
    status: error.status
  }
}

/**
 * Log API error
 */
export function logAPIError(
  error: APIError,
  endpoint: string,
  context?: Record<string, unknown>
): void {
  logger.error(`API Error: ${endpoint}`, undefined, {
    code: error.code,
    status: error.status,
    message: error.message,
    endpoint,
    ...context
  })
}

/**
 * Handle API error and return response
 */
export async function handleAPIError(
  error: unknown,
  endpoint: string
): Promise<{ body: string; status: number }> {
  let apiError: APIError

  if (error instanceof Error) {
    if (error.message.includes('MongoDB')) {
      apiError = StandardErrors.mongoDbUnavailable()
    } else if (error.message.includes('Claude')) {
      apiError = StandardErrors.claudeApiUnavailable()
    } else {
      apiError = StandardErrors.internalError({
        message: error.message
      })
    }
  } else {
    apiError = StandardErrors.internalError()
  }

  logAPIError(apiError, endpoint)
  return createErrorResponse(apiError)
}
