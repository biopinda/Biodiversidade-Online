import { countOccurrenceRegions, type TaxaFilter } from '@/lib/mongo'
import { type ErrorResponse, type OccurrenceResponse } from '@/types/occurrence'
import type { APIRoute } from 'astro'

// Valid taxonomic filter parameters
const VALID_TAXONOMIC_FIELDS: Set<string> = new Set([
  'kingdom',
  'phylum',
  'class',
  'order',
  'superfamily',
  'family',
  'genus',
  'specificEpithet'
])

/**
 * Validate and sanitize filter parameters
 */
function validateAndSanitizeFilters(searchParams: URLSearchParams): TaxaFilter {
  const filter: TaxaFilter = {}

  for (const [key, value] of searchParams.entries()) {
    // Only accept valid taxonomic fields
    if (!VALID_TAXONOMIC_FIELDS.has(key)) {
      console.warn(`⚠️ Invalid filter parameter ignored: ${key}`)
      continue
    }

    // Trim and validate value
    const trimmedValue = value?.trim()
    if (trimmedValue && trimmedValue.length > 0) {
      // Basic validation - no script tags or SQL injection attempts
      if (
        trimmedValue.includes('<script') ||
        trimmedValue.includes('script>')
      ) {
        console.warn(
          `⚠️ Potentially malicious filter value ignored: ${key}=${trimmedValue}`
        )
        continue
      }

      // Limit length to prevent abuse
      if (trimmedValue.length > 100) {
        console.warn(`⚠️ Filter value too long, truncated: ${key}`)
        filter[key] = trimmedValue.substring(0, 100)
      } else {
        filter[key] = trimmedValue
      }
    }
  }

  return filter
}

/**
 * Create error response with proper headers
 */
function createErrorResponse(message: string, status: number): Response {
  const errorResponse: ErrorResponse = { error: message }

  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  })
}

/**
 * Create success response with proper headers
 */
function createSuccessResponse(data: OccurrenceResponse): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
    }
  })
}

export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now()

  try {
    // Validate and sanitize input parameters
    const filter = validateAndSanitizeFilters(url.searchParams)

    // Check if refresh is requested
    const forceRefresh = url.searchParams.get('refresh') === 'true'

    console.log(
      `🔍 Occurrence query with filters:`,
      filter,
      forceRefresh ? '(forced refresh)' : '(using cache)'
    )

    // Query the database
    const regions = await countOccurrenceRegions(filter, forceRefresh)

    // Handle database connection failures
    if (!regions) {
      console.error('❌ Database connection failed for occurrence count query')
      return createErrorResponse('Falha ao conectar ao banco de dados', 500)
    }

    // Validate response structure
    if (typeof regions.total !== 'number' || !Array.isArray(regions.regions)) {
      console.error('❌ Invalid response structure from countOccurrenceRegions')
      return createErrorResponse('Erro na estrutura de dados retornados', 500)
    }

    // Add query performance logging
    const queryTime = Date.now() - startTime
    console.log(
      `✅ Occurrence query completed in ${queryTime}ms. Total: ${regions.total}, Regions: ${regions.regions.length}`
    )

    return createSuccessResponse(regions as OccurrenceResponse)
  } catch (error) {
    const queryTime = Date.now() - startTime
    console.error(`❌ Error in occurrence count API (${queryTime}ms):`, error)

    // Different error handling based on error type
    if (error instanceof Error) {
      // Database timeout or connection error
      if (
        error.message.includes('timeout') ||
        error.message.includes('connection')
      ) {
        return createErrorResponse('Tempo limite de consulta excedido', 504)
      }

      // Invalid query or aggregation error
      if (
        error.message.includes('aggregation') ||
        error.message.includes('pipeline')
      ) {
        return createErrorResponse('Erro na consulta de dados', 400)
      }
    }

    // Generic server error
    return createErrorResponse('Erro interno do servidor', 500)
  }
}
