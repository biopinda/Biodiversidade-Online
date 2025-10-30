import type { Collection, Db } from 'mongodb'
import { normalizeNameKey } from '../utils/name'
import type { NormalizedOccurrenceDocument } from './normalizeOccurrence'

interface TaxonSummary {
  _id: string
  scientificName?: string
  canonicalName?: string
  flatScientificName?: string
  kingdom?: string
}

type TaxonDocument = Record<string, unknown> & { _id: string }

type CollectorParser = (
  input: string
) => Promise<string[] | null> | string[] | null

export interface OccurrenceEnrichmentContext {
  taxaCollection: Collection<TaxonDocument>
  taxonIdCache: Map<string, TaxonSummary | null>
  taxonNameCache: Map<string, TaxonSummary | null>
  // Pre-loaded taxa for fast lookups
  allTaxaById: Map<string, TaxonSummary>
  allTaxaByFlatName: Map<string, TaxonSummary>
  allTaxaByCanonicalName: Map<string, TaxonSummary>
  allTaxaByScientificName: Map<string, TaxonSummary>
  collectorParser: CollectorParser
  logger: {
    warn(message: string, ...details: unknown[]): void
    info(message: string, ...details: unknown[]): void
  }
}

export interface OccurrenceEnrichmentResult {
  taxonMatched: boolean
  parsingStatus?: 'success' | 'failed' | 'skipped'
}

const TAXON_PROJECTION = {
  _id: 1,
  scientificName: 1,
  canonicalName: 1,
  flatScientificName: 1,
  kingdom: 1
} as const

function toTaxonSummary(doc: TaxonDocument | null): TaxonSummary | null {
  if (!doc) return null
  return {
    _id: doc._id,
    scientificName:
      typeof doc.scientificName === 'string' ? doc.scientificName : undefined,
    canonicalName:
      typeof doc.canonicalName === 'string' ? doc.canonicalName : undefined,
    flatScientificName:
      typeof doc.flatScientificName === 'string'
        ? doc.flatScientificName
        : undefined,
    kingdom: typeof doc.kingdom === 'string' ? doc.kingdom : undefined
  }
}

function defaultCollectorParser(input: string): string[] {
  return input
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

async function loadCollectorParser(
  logger: OccurrenceEnrichmentContext['logger']
): Promise<CollectorParser> {
  const moduleName = process.env.COLLECTOR_PARSER_MODULE
  if (!moduleName) {
    return defaultCollectorParser
  }

  try {
    const imported = await import(moduleName)
    const parserCandidate =
      imported?.parse ||
      imported?.default ||
      imported?.collectorParser ||
      imported?.collector

    if (typeof parserCandidate === 'function') {
      return async (input: string) => {
        const result = await parserCandidate(input)
        if (!result) return null
        if (Array.isArray(result)) {
          return result
            .map((value: unknown) =>
              typeof value === 'string' ? value.trim() : ''
            )
            .filter((value): value is string => value.length > 0)
        }
        if (
          typeof result === 'object' &&
          Array.isArray((result as { names?: unknown[] }).names)
        ) {
          const names = (result as { names: unknown[] }).names
          return names
            .map((value: unknown) =>
              typeof value === 'string' ? value.trim() : ''
            )
            .filter((value): value is string => value.length > 0)
        }
        if (typeof result === 'string') {
          return defaultCollectorParser(result)
        }
        return null
      }
    }

    logger.warn(
      'Parser de coletores carregado não possui função utilizável',
      moduleName
    )
  } catch (error) {
    logger.warn('Falha ao carregar parser de coletores', { moduleName, error })
  }

  return defaultCollectorParser
}

export async function createOccurrenceEnrichmentContext(
  db: Db,
  logger: OccurrenceEnrichmentContext['logger']
): Promise<OccurrenceEnrichmentContext> {
  const taxaCollection = db.collection<TaxonDocument>('taxa')

  // Pre-load all taxa for fast lookups
  logger.info('Pre-loading taxa data for enrichment...')
  const startTime = Date.now()

  const allTaxaById = new Map<string, TaxonSummary>()
  const allTaxaByFlatName = new Map<string, TaxonSummary>()
  const allTaxaByCanonicalName = new Map<string, TaxonSummary>()
  const allTaxaByScientificName = new Map<string, TaxonSummary>()

  const cursor = taxaCollection.find({}, { projection: TAXON_PROJECTION })
  for await (const doc of cursor) {
    const summary = toTaxonSummary(doc)
    if (summary) {
      allTaxaById.set(summary._id, summary)

      if (summary.flatScientificName) {
        allTaxaByFlatName.set(summary.flatScientificName.toLowerCase(), summary)
      }

      if (summary.canonicalName) {
        allTaxaByCanonicalName.set(summary.canonicalName.toLowerCase(), summary)
      }

      if (summary.scientificName) {
        allTaxaByScientificName.set(
          summary.scientificName.toLowerCase(),
          summary
        )
      }
    }
  }

  const loadTime = ((Date.now() - startTime) / 1000).toFixed(2)
  logger.info(`Taxa data loaded in ${loadTime}s (${allTaxaById.size} taxa)`)

  return {
    taxaCollection,
    taxonIdCache: new Map(),
    taxonNameCache: new Map(),
    allTaxaById,
    allTaxaByFlatName,
    allTaxaByCanonicalName,
    allTaxaByScientificName,
    collectorParser: await loadCollectorParser(logger),
    logger
  }
}

function getCandidateTaxonIds(
  document: NormalizedOccurrenceDocument
): string[] {
  const ids = new Set<string>()
  if (typeof document.taxonID === 'string' && document.taxonID.trim()) {
    ids.add(document.taxonID.trim())
  }
  if (
    typeof document.acceptedNameUsageID === 'string' &&
    document.acceptedNameUsageID.trim()
  ) {
    ids.add(document.acceptedNameUsageID.trim())
  }
  return Array.from(ids)
}

function getCandidateTaxonFlatNames(
  document: NormalizedOccurrenceDocument
): string[] {
  const flatNames = new Set<string>()
  if (
    typeof document.flatScientificName === 'string' &&
    document.flatScientificName.trim()
  ) {
    flatNames.add(document.flatScientificName.trim().toLocaleLowerCase())
  }
  if (typeof document.canonicalName === 'string') {
    const key = normalizeNameKey(document.canonicalName)
    if (key) flatNames.add(key)
  }
  if (typeof document.scientificName === 'string') {
    const key = normalizeNameKey(document.scientificName)
    if (key) flatNames.add(key)
  }
  return Array.from(flatNames)
}

async function resolveTaxonById(
  id: string,
  context: OccurrenceEnrichmentContext
): Promise<TaxonSummary | null> {
  if (context.taxonIdCache.has(id)) {
    return context.taxonIdCache.get(id) ?? null
  }

  // Use pre-loaded taxa map for instant lookup
  const summary = context.allTaxaById.get(id) ?? null
  context.taxonIdCache.set(id, summary)
  return summary
}

async function resolveTaxonByFlatName(
  flatName: string,
  context: OccurrenceEnrichmentContext
): Promise<TaxonSummary | null> {
  if (context.taxonNameCache.has(flatName)) {
    return context.taxonNameCache.get(flatName) ?? null
  }

  // Use pre-loaded taxa maps for instant lookups
  const lowerFlatName = flatName.toLowerCase()
  let summary =
    context.allTaxaByFlatName.get(lowerFlatName) ??
    context.allTaxaByCanonicalName.get(lowerFlatName) ??
    context.allTaxaByScientificName.get(lowerFlatName) ??
    null

  context.taxonNameCache.set(flatName, summary)
  return summary
}

async function resolveTaxon(
  document: NormalizedOccurrenceDocument,
  context: OccurrenceEnrichmentContext
): Promise<TaxonSummary | null> {
  const ids = getCandidateTaxonIds(document)
  for (const id of ids) {
    const match = await resolveTaxonById(id, context)
    if (match) return match
  }

  const names = getCandidateTaxonFlatNames(document)
  for (const name of names) {
    const match = await resolveTaxonByFlatName(name, context)
    if (match) return match
  }

  return null
}

async function parseCollectors(
  recordedBy: unknown,
  context: OccurrenceEnrichmentContext
): Promise<{
  names: string[] | null
  status: 'success' | 'failed' | 'skipped'
}> {
  if (typeof recordedBy !== 'string' || !recordedBy.trim()) {
    return { names: null, status: 'skipped' }
  }

  try {
    const parsed = await context.collectorParser(recordedBy)
    if (parsed && parsed.length) {
      return { names: Array.from(new Set(parsed)), status: 'success' }
    }
    return { names: null, status: 'failed' }
  } catch (error) {
    context.logger.warn('Falha ao analisar campo recordedBy', {
      recordedBy,
      error
    })
    return { names: null, status: 'failed' }
  }
}

export async function enrichOccurrence(
  document: NormalizedOccurrenceDocument,
  context: OccurrenceEnrichmentContext
): Promise<OccurrenceEnrichmentResult> {
  const taxon = await resolveTaxon(document, context)

  if (taxon) {
    document.taxonID = taxon._id
    if (taxon.scientificName) {
      document.scientificName = taxon.scientificName
    }
    if (taxon.canonicalName) {
      document.canonicalName = taxon.canonicalName
    }
    if (taxon.flatScientificName) {
      document.flatScientificName = taxon.flatScientificName
    }
    if (taxon.kingdom && typeof document.kingdom !== 'string') {
      document.kingdom = taxon.kingdom
    }
  }

  const collectorResult = await parseCollectors(document.recordedBy, context)
  if (collectorResult.names && collectorResult.names.length) {
    document.collectors = collectorResult.names
  }
  if (collectorResult.status !== 'skipped') {
    document.parsingStatus = collectorResult.status
  }

  return {
    taxonMatched: Boolean(taxon),
    parsingStatus: collectorResult.status
  }
}
