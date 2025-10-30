export type CollectionDomain = 'taxa' | 'occurrences'

export const RAW_COLLECTIONS: Record<CollectionDomain, string> = {
  taxa: 'taxa_ipt',
  occurrences: 'occurrences_ipt'
}

export const TRANSFORMED_COLLECTIONS: Record<CollectionDomain, string> = {
  taxa: 'taxa',
  occurrences: 'occurrences'
}

export const AUXILIARY_COLLECTIONS = {
  locks: 'transform_status',
  metrics: 'process_metrics'
} as const

export const COLLECTION_NAMES = {
  raw: RAW_COLLECTIONS,
  transformed: TRANSFORMED_COLLECTIONS,
  auxiliary: AUXILIARY_COLLECTIONS
} as const

export function getRawCollection(domain: CollectionDomain): string {
  return RAW_COLLECTIONS[domain]
}

export function getTransformedCollection(domain: CollectionDomain): string {
  return TRANSFORMED_COLLECTIONS[domain]
}
