/**
 * Occurrence normalization pipeline - composes atomic transform functions
 */

import {
  createTransformPipeline,
  createTransformStep
} from '../../lib/orchestrator'
import type {
  NormalizedOccurrenceDocument,
  RawOccurrenceDocument
} from '../normalizeOccurrence'
import * as transforms from './index'

/**
 * Create the occurrence normalization pipeline
 * This pipeline transforms raw occurrence documents into normalized format
 */
export const occurrenceNormalizationPipeline = createTransformPipeline<
  RawOccurrenceDocument,
  NormalizedOccurrenceDocument
>('occurrence-normalization', [
  // Step 1: Validate and clone document
  createTransformStep('validate-and-clone', transforms.validateAndClone),

  // Step 2: Normalize occurrence ID
  createTransformStep(
    'normalize-occurrence-id',
    transforms.normalizeOccurrenceId
  ),

  // Step 3: Build geo point from coordinates
  createTransformStep('build-geo-point', transforms.buildGeoPoint),

  // Step 4: Build canonical name
  createTransformStep('build-canonical-name', transforms.buildCanonicalName),

  // Step 5: Build flat scientific name
  createTransformStep(
    'build-flat-scientific-name',
    transforms.buildFlatScientificName_Transform
  ),

  // Step 6: Normalize IPT kingdoms
  createTransformStep(
    'normalize-ipt-kingdoms',
    transforms.normalizeIptKingdoms
  ),

  // Step 7: Normalize date fields (year/month/day)
  createTransformStep('normalize-date-fields', transforms.normalizeDateFields),

  // Step 8: Parse and normalize event date
  createTransformStep('normalize-event-date', transforms.normalizeEventDate),

  // Step 9: Normalize country
  createTransformStep('normalize-country', transforms.normalizeCountry),

  // Step 10: Normalize state/province
  createTransformStep('normalize-state', transforms.normalizeState),

  // Step 11: Normalize county
  createTransformStep('normalize-county', transforms.normalizeCounty),

  // Step 12: Check if Brazilian and set reproductive condition (filters non-Brazilian)
  createTransformStep(
    'check-brazilian-and-set-reproductive',
    transforms.checkBrazilianAndSetReproductiveCondition
  )
])
