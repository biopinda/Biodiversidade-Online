// Utilities
export {
  buildOccurrenceDeterministicId,
  buildTaxonDeterministicId,
  type OccurrenceIdentifierSource,
  type TaxonIdentifierSource
} from './utils/deterministic-id.js'

// Database
export { closeDatabase, getDatabase } from './lib/database.js'

// Collections
export {
  FAUNA_AMEACADA_COLLECTION,
  FUNGI_AMEACADA_COLLECTION,
  INVASORAS_COLLECTION,
  OCCURRENCES_COLLECTION,
  PLANTAE_AMEACADA_COLLECTION,
  PROCESS_METRICS_COLLECTION,
  TAXA_COLLECTION,
  TRANSFORM_STATUS_COLLECTION,
  UCS_COLLECTION
} from './config/collections.js'

// Metrics
export {
  MetricsBuilder,
  recordProcessMetrics,
  type ProcessMetrics
} from './lib/metrics.js'
