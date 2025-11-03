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
  CNC_FLORA_FUNGI_COLLECTION,
  CNC_FLORA_PLANTAE_COLLECTION,
  FAUNA_AMEACADA_COLLECTION,
  INVASORAS_COLLECTION,
  OCCURRENCES_COLLECTION,
  OCCURRENCES_RAW_COLLECTION,
  PROCESS_METRICS_COLLECTION,
  TAXA_COLLECTION,
  TAXA_RAW_COLLECTION,
  TRANSFORM_STATUS_COLLECTION,
  UCS_COLLECTION
} from './config/collections.js'

// Metrics
export {
  MetricsBuilder,
  recordProcessMetrics,
  type ProcessMetrics
} from './lib/metrics.js'
