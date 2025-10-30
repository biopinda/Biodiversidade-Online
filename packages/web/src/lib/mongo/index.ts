// Barrel exports for mongo modules
// Maintains backward compatibility with existing imports

// Types for MongoDB documents
export interface TaxonDocument {
  _id?: string
  taxonID: string
  scientificName: string
  scientificNameAuthorship?: string
  acceptedNameUsage?: string
  acceptedNameUsageID?: string
  originalNameUsageID?: string
  namePublishedIn?: string
  namePublishedInYear?: string
  kingdom: 'Plantae' | 'Fungi' | 'Animalia'
  higherClassification?: string
  family?: string
  genus?: string
  specificEpithet?: string
  taxonRank?: string
  taxonomicStatus?: string
  nomenclaturalStatus?: string
  modified?: string
  bibliographicCitation?: string
  distribution?: {
    origin?: string
    endemism?: string
    phytogeographicDomains?: string[]
    occurrence?: string[]
    vegetationType?: string[]
  }
  othernames?: Array<{
    taxonID: string
    scientificName?: string
    taxonomicStatus?: string
  }>
  vernacularname?: VernacularNameEntry[]
  reference?: ReferenceEntry[]
  occurrences?: OccurrenceRecord[]
}

export interface VernacularNameEntry {
  vernacularName?: string
  language?: string
  locality?: string
}

export interface ReferenceEntry {
  creator?: string
  bibliographicCitation?: string
}

export interface OccurrenceRecord {
  _id?: any
  scientificName?: string
  kingdom?: string
  stateProvince?: string
  country?: string
  decimalLatitude?: number
  decimalLongitude?: number
  eventDate?: string
  collector?: string
  institution?: string
  [key: string]: any // Allow other Darwin Core fields
}

export interface PhenologicalHeatmapCell {
  month: number
  monthName: string
  count: number
  intensity: number
}

// Connection utilities
export {
  connectClientWithTimeout,
  getClient,
  getCollection,
  getMongoDatabase,
  getMongoUrl
} from './connection'

// Taxa operations
export {
  countTaxa,
  countTaxaRegions,
  getFamilyPerKingdom,
  getTaxaCountPerFamilyByKingdom,
  getTaxaCountPerKingdom,
  getTaxaCountPerOrderByKingdom,
  getTaxon,
  getTaxonomicStatusPerKingdom,
  getTree,
  listTaxa,
  listTaxaPaginated,
  type TaxaFilter
} from './taxa'

// Occurrence operations
export {
  countOccurrenceRegions,
  getOccurrenceCountPerKingdom,
  listOccurrences
} from './occurrences'

// Threatened species operations
export {
  getThreatenedCategoriesPerKingdom,
  getThreatenedCountPerKingdom
} from './threatened'

// Invasive species operations
export {
  getInvasiveCountPerKingdom,
  getInvasiveTopFamilies,
  getInvasiveTopOrders
} from './invasive'

// Phenological operations
export {
  generatePhenologicalHeatmap,
  getCalFenoData,
  getCalFenoFamilies,
  getCalFenoGenera,
  getCalFenoSpecies,
  type PhenologicalOccurrence
} from './phenological'

// Cache management
export { clearCache, ensureCacheCollection, getCacheStats } from './cache'

// Shared utilities
export {
  brazilianStateVariations,
  createBrazilianStateFilter,
  getTopCollectionsByKingdom,
  validBrazilianStates
} from './utils'
