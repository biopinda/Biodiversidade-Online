// Barrel exports for mongo modules
// Maintains backward compatibility with existing imports

// Connection utilities
export {
  getMongoUrl,
  getClient,
  connectClientWithTimeout,
  getCollection
} from './connection'

// Taxa operations
export {
  listTaxa,
  listTaxaPaginated,
  countTaxa,
  countTaxaRegions,
  getTaxonomicStatusPerKingdom,
  getTree,
  getFamilyPerKingdom,
  getTaxaCountPerKingdom,
  getTaxaCountPerOrderByKingdom,
  getTaxaCountPerFamilyByKingdom,
  getTaxon,
  type TaxaFilter
} from './taxa'

// Occurrence operations
export {
  listOccurrences,
  countOccurrenceRegions,
  getOccurrenceCountPerKingdom
} from './occurrences'

// Threatened species operations
export {
  getThreatenedCountPerKingdom,
  getThreatenedCategoriesPerKingdom
} from './threatened'

// Invasive species operations
export {
  getInvasiveCountPerKingdom,
  getInvasiveTopOrders,
  getInvasiveTopFamilies
} from './invasive'

// Phenological operations
export {
  getCalFenoData,
  getCalFenoFamilies,
  getCalFenoGenera,
  getCalFenoSpecies,
  generatePhenologicalHeatmap
} from './phenological'

// Cache management
export { ensureCacheCollection, clearCache, getCacheStats } from './cache'

// Shared utilities
export {
  getTopCollectionsByKingdom,
  validBrazilianStates,
  brazilianStateVariations,
  createBrazilianStateFilter
} from './utils'
