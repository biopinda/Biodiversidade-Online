/**
 * API Validation Utilities
 * Validates request parameters and returns appropriate errors
 */

import { logger } from './logger'

export interface ValidationError {
  field: string
  message: string
}

export interface ValidatedParams {
  valid: boolean
  errors: ValidationError[]
  data?: Record<string, unknown>
}

/**
 * Validate pagination parameters
 */
export function validatePagination(
  limit?: string,
  offset?: string
): ValidatedParams {
  const errors: ValidationError[] = []
  const data: Record<string, number> = {}

  // Validate limit
  if (limit) {
    const parsedLimit = parseInt(limit, 10)
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      errors.push({
        field: 'limit',
        message: 'Limit must be a positive integer'
      })
    } else if (parsedLimit > 10000) {
      errors.push({
        field: 'limit',
        message: 'Limit cannot exceed 10000'
      })
    } else {
      data.limit = parsedLimit
    }
  } else {
    data.limit = 100 // Default
  }

  // Validate offset
  if (offset) {
    const parsedOffset = parseInt(offset, 10)
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      errors.push({
        field: 'offset',
        message: 'Offset must be a non-negative integer'
      })
    } else {
      data.offset = parsedOffset
    }
  } else {
    data.offset = 0 // Default
  }

  return {
    valid: errors.length === 0,
    errors,
    data
  }
}

/**
 * Validate region parameter
 */
export function validateRegion(region?: string): ValidatedParams {
  const errors: ValidationError[] = []
  const data: Record<string, string> = {}

  if (region) {
    // Brazilian state codes (IBGE format: 2 digits)
    const validCodes = Array.from({ length: 28 }, (_, i) => {
      const codes = [
        '11', '12', '13', '14', '15', '16', '17', '21', '22', '23', '24',
        '25', '26', '27', '28', '29', '31', '32', '33', '35', '41', '42',
        '43', '50', '51', '52', '53'
      ]
      return codes[i]
    })

    if (!validCodes.includes(region)) {
      errors.push({
        field: 'region',
        message: 'Invalid region code. Use IBGE state code (2 digits).'
      })
    } else {
      data.region = region
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data
  }
}

/**
 * Validate conservation status parameter
 */
export function validateConservationStatus(status?: string): ValidatedParams {
  const errors: ValidationError[] = []
  const data: Record<string, string> = {}

  if (status) {
    const validStatuses = [
      'extinct',
      'critically-endangered',
      'endangered',
      'vulnerable',
      'near-threatened',
      'least-concern',
      'data-deficient'
    ]

    if (!validStatuses.includes(status)) {
      errors.push({
        field: 'conservation_status',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      })
    } else {
      data.conservationStatus = status
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data
  }
}

/**
 * Validate geobox parameter (minLat,minLon,maxLat,maxLon)
 */
export function validateGeobox(geobox?: string): ValidatedParams {
  const errors: ValidationError[] = []
  const data: Record<string, number[]> = {}

  if (geobox) {
    const parts = geobox.split(',').map((s) => parseFloat(s.trim()))

    if (parts.length !== 4 || parts.some(isNaN)) {
      errors.push({
        field: 'geobox',
        message: 'Geobox must be in format: minLat,minLon,maxLat,maxLon'
      })
    } else {
      const [minLat, minLon, maxLat, maxLon] = parts

      // Validate Brazil bounds
      const brazilBounds = {
        minLat: -33.8,
        maxLat: 5.3,
        minLon: -73.9,
        maxLon: -34.9
      }

      if (
        minLat < brazilBounds.minLat ||
        maxLat > brazilBounds.maxLat ||
        minLon < brazilBounds.minLon ||
        maxLon > brazilBounds.maxLon
      ) {
        errors.push({
          field: 'geobox',
          message: 'Coordinates must be within Brazil bounds'
        })
      } else if (minLat >= maxLat || minLon >= maxLon) {
        errors.push({
          field: 'geobox',
          message: 'Min values must be less than max values'
        })
      } else {
        data.coordinates = [minLat, minLon, maxLat, maxLon]
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data
  }
}

/**
 * Combine multiple validation results
 */
export function combineValidations(
  ...validations: ValidatedParams[]
): ValidatedParams {
  const allErrors = validations.flatMap((v) => v.errors)
  const combinedData = Object.assign(
    {},
    ...validations.map((v) => v.data || {})
  )

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    data: combinedData
  }
}

/**
 * Log validation errors
 */
export function logValidationErrors(
  errors: ValidationError[],
  endpoint: string
): void {
  if (errors.length > 0) {
    logger.warn(`Validation failed for ${endpoint}`, {
      errorCount: errors.length,
      fields: errors.map((e) => e.field)
    })
  }
}
