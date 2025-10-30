/**
 * Taxa normalization pipeline - composes atomic transform functions
 */

import {
  createTransformPipeline,
  createTransformStep
} from '../../lib/orchestrator'
import type {
  NormalizedTaxonDocument,
  RawTaxonDocument
} from '../normalizeTaxon'
import * as transforms from './index'

/**
 * Create the taxa normalization pipeline
 * This pipeline transforms raw taxa documents into normalized format
 */
export const taxaNormalizationPipeline = createTransformPipeline<
  RawTaxonDocument,
  NormalizedTaxonDocument
>('taxa-normalization', [
  // Step 1: Validate and clone document
  createTransformStep('validate-and-clone', transforms.validateAndClone),

  // Step 2: Filter by taxon rank (required - fails if not in whitelist)
  createTransformStep('filter-by-taxon-rank', transforms.filterByTaxonRank),

  // Step 3: Build canonical name
  createTransformStep('build-canonical-name', transforms.buildCanonicalName),

  // Step 4: Build flat scientific name
  createTransformStep(
    'build-flat-scientific-name',
    transforms.buildFlatScientificName_Transform
  ),

  // Step 5: Normalize higher classification
  createTransformStep(
    'normalize-higher-classification',
    transforms.normalizeHigherClassification
  ),

  // Step 6: Normalize kingdom
  createTransformStep('normalize-kingdom', transforms.normalizeKingdom),

  // Step 7: Normalize vernacular names
  createTransformStep(
    'normalize-vernacular-names',
    transforms.normalizeVernacularNames
  ),

  // Step 8: Extract and normalize distribution
  createTransformStep('extract-distribution', transforms.extractDistribution),

  // Step 9: Normalize species profile
  createTransformStep(
    'normalize-species-profile',
    transforms.normalizeSpeciesProfile
  ),

  // Step 10: Convert resource relationship to other names
  createTransformStep(
    'convert-resource-relationship',
    transforms.convertResourceRelationshipToOtherNames
  ),

  // Step 11: Force Animalia kingdom (for fauna)
  createTransformStep('force-animalia-kingdom', transforms.forceAnimaliKingdom)
])
