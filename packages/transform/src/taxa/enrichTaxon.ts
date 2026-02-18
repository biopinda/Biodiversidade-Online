import type { Collection, Db } from 'mongodb'
import {
  addToLookup,
  collectDocumentIds,
  collectDocumentNames,
  createLookup,
  gatherLookupMatches,
  type IndexedLookup,
  materializeCollection,
  normalizeName
} from '../utils/lookup'
import type {
  NormalizedTaxonDocument,
  RawTaxonDocument
} from './normalizeTaxon'

type MongoDoc = Record<string, unknown>

type ThreatSource = 'fungiAmeacada' | 'plantaeAmeacada' | 'faunaAmeacada'
type InvasiveSource = 'invasoras'

export interface ThreatStatusEntry {
  source: ThreatSource
  category?: string
}

export interface InvasiveStatusEntry {
  source: InvasiveSource
  isInvasive: boolean
  notes?: string
}

export interface ConservationUnitEntry {
  ucName: string
}

interface TaxonEnrichmentIndexes {
  threats: IndexedLookup<ThreatStatusEntry>
  invasives: IndexedLookup<InvasiveStatusEntry>
  conservationUnits: IndexedLookup<ConservationUnitEntry>
}

export interface TaxonEnrichmentContext {
  rawCollection: Collection<RawTaxonDocument>
  indexes: TaxonEnrichmentIndexes
  cache: {
    relatedNames: Map<string, string | null>
  }
}

const DEFAULT_THREAT_SOURCES: Array<{
  collection: string
  source: ThreatSource
}> = [
  { collection: 'fungiAmeacada', source: 'fungiAmeacada' },
  { collection: 'plantaeAmeacada', source: 'plantaeAmeacada' },
  { collection: 'faunaAmeacada', source: 'faunaAmeacada' }
]

const DEFAULT_INVASIVE_SOURCES: Array<{
  collection: string
  source: InvasiveSource
}> = [{ collection: 'invasoras', source: 'invasoras' }]

const DEFAULT_CONSERVATION_COLLECTION = 'catalogoucs'

function extractCategory(doc: MongoDoc): string | undefined {
  return (
    (typeof doc.category === 'string' && doc.category.trim()) ||
    (typeof (doc as Record<string, unknown>).categoria === 'string' &&
      (doc as Record<string, unknown>).categoria?.toString().trim()) ||
    (typeof (doc as Record<string, unknown>).categoryNational === 'string' &&
      (doc as Record<string, unknown>).categoryNational?.toString().trim()) ||
    (typeof (doc as Record<string, unknown>).categoria_nacional === 'string' &&
      (doc as Record<string, unknown>).categoria_nacional?.toString().trim()) ||
    (typeof doc['Categoria de Risco'] === 'string' &&
      (doc['Categoria de Risco'] as string).trim()) ||
    (typeof doc.threatStatus === 'string' &&
      (doc.threatStatus as string).trim()) ||
    (typeof doc.status === 'string' && doc.status.trim()) ||
    undefined
  )
}

function extractInvasiveNote(doc: MongoDoc): string | undefined {
  return (
    (typeof doc.notes === 'string' && doc.notes.trim()) ||
    (typeof (doc as Record<string, unknown>).observacao === 'string' &&
      (doc as Record<string, unknown>).observacao?.toString().trim()) ||
    undefined
  )
}

function extractConservationUnitName(doc: MongoDoc): string | null {
  const candidates = [
    doc.ucName,
    (doc as Record<string, unknown>).nomeUC,
    (doc as Record<string, unknown>).nome_uc,
    (doc as Record<string, unknown>).nome,
    (doc as Record<string, unknown>).name
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  return null
}

async function buildThreatIndexes(
  db: Db
): Promise<IndexedLookup<ThreatStatusEntry>> {
  const lookup = createLookup<ThreatStatusEntry>()

  for (const { collection: collectionName, source } of DEFAULT_THREAT_SOURCES) {
    const collection = db.collection<MongoDoc>(collectionName)
    const docs = await materializeCollection(collection)

    for (const doc of docs) {
      const ids = collectDocumentIds(doc)
      const names = collectDocumentNames(doc)
      if (!ids.length && !names.length) continue

      const category = extractCategory(doc)
      addToLookup(lookup, ids, names, {
        source,
        category: category ?? undefined
      })
    }
  }

  return lookup
}

async function buildInvasiveIndexes(
  db: Db
): Promise<IndexedLookup<InvasiveStatusEntry>> {
  const lookup = createLookup<InvasiveStatusEntry>()

  for (const {
    collection: collectionName,
    source
  } of DEFAULT_INVASIVE_SOURCES) {
    const collection = db.collection<MongoDoc>(collectionName)
    const docs = await materializeCollection(collection)

    for (const doc of docs) {
      const ids = collectDocumentIds(doc)
      const names = collectDocumentNames(doc)
      if (!ids.length && !names.length) continue

      const note = extractInvasiveNote(doc)
      addToLookup(lookup, ids, names, {
        source,
        isInvasive: true,
        notes: note
      })
    }
  }

  return lookup
}

async function buildConservationIndexes(
  db: Db
): Promise<IndexedLookup<ConservationUnitEntry>> {
  const lookup = createLookup<ConservationUnitEntry>()
  const collection = db.collection<MongoDoc>(DEFAULT_CONSERVATION_COLLECTION)
  const docs = await materializeCollection(collection)

  for (const doc of docs) {
    const ucName = extractConservationUnitName(doc)
    if (!ucName) continue

    const ids = collectDocumentIds(doc)
    const names = collectDocumentNames(doc)
    if (!ids.length && !names.length) continue

    addToLookup(lookup, ids, names, { ucName })
  }

  return lookup
}

function uniqueArray<T>(values: T[]): T[] {
  const seen = new Set<T>()
  const result: T[] = []
  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

async function resolveScientificName(
  id: string,
  context: TaxonEnrichmentContext
): Promise<string | null> {
  if (context.cache.relatedNames.has(id)) {
    return context.cache.relatedNames.get(id) ?? null
  }

  const doc = await context.rawCollection.findOne(
    { _id: id },
    { projection: { scientificName: 1 } }
  )
  const scientificName =
    (doc?.scientificName && typeof doc.scientificName === 'string'
      ? doc.scientificName.trim()
      : null) ?? null

  context.cache.relatedNames.set(id, scientificName)
  return scientificName
}

export async function createTaxonEnrichmentContext(
  db: Db
): Promise<TaxonEnrichmentContext> {
  const [threats, invasives, conservationUnits] = await Promise.all([
    buildThreatIndexes(db),
    buildInvasiveIndexes(db),
    buildConservationIndexes(db)
  ])

  return {
    rawCollection: db.collection<RawTaxonDocument>('taxa'),
    indexes: { threats, invasives, conservationUnits },
    cache: {
      relatedNames: new Map()
    }
  }
}

function gatherCandidateIds(taxon: NormalizedTaxonDocument): string[] {
  const ids = new Set<string>()
  if (typeof taxon._id === 'string') ids.add(taxon._id)
  if (typeof taxon.taxonID === 'string') ids.add(taxon.taxonID)
  return Array.from(ids)
}

function gatherCandidateNames(taxon: NormalizedTaxonDocument): string[] {
  const names = new Set<string>()
  if (typeof taxon.canonicalName === 'string') {
    const normalized = normalizeName(taxon.canonicalName)
    if (normalized) names.add(normalized)
  }
  if (typeof taxon.scientificName === 'string') {
    const normalized = normalizeName(taxon.scientificName)
    if (normalized) names.add(normalized)
  }
  if (typeof taxon.flatScientificName === 'string') {
    names.add(taxon.flatScientificName.toLocaleLowerCase())
  }
  return Array.from(names)
}

export interface TaxonEnrichmentResult {
  threatStatus?: ThreatStatusEntry[]
  invasiveStatus?: InvasiveStatusEntry
  conservationUnits?: ConservationUnitEntry[]
}

export async function enrichTaxon(
  taxon: NormalizedTaxonDocument,
  context: TaxonEnrichmentContext
): Promise<TaxonEnrichmentResult> {
  const ids = gatherCandidateIds(taxon)
  const flatNames = gatherCandidateNames(taxon)

  const threatStatus = gatherLookupMatches(
    context.indexes.threats,
    ids,
    flatNames
  )
  const invasive = gatherLookupMatches(
    context.indexes.invasives,
    ids,
    flatNames
  )
  const conservationUnits = gatherLookupMatches(
    context.indexes.conservationUnits,
    ids,
    flatNames
  )

  if (Array.isArray(taxon.othernames) && taxon.othernames.length) {
    await Promise.all(
      taxon.othernames.map(async (entry) => {
        if (!entry || entry.scientificName) return
        if (!entry.taxonID) return
        entry.scientificName = await resolveScientificName(
          entry.taxonID,
          context
        )
      })
    )
  }

  return {
    threatStatus: threatStatus.length ? uniqueArray(threatStatus) : undefined,
    invasiveStatus: invasive.length
      ? {
          ...invasive[0],
          isInvasive: true
        }
      : undefined,
    conservationUnits: conservationUnits.length
      ? uniqueArray(conservationUnits)
      : undefined
  }
}
