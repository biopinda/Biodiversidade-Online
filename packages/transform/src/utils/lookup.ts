import type { Collection } from 'mongodb'
import { normalizeNameKey } from './name'

type MongoDoc = Record<string, unknown>

export interface IndexedLookup<T> {
  byId: Map<string, T[]>
  byFlatName: Map<string, T[]>
}

export const ID_FIELDS = [
  '_id',
  'taxonID',
  'taxonId',
  'taxon_id',
  'identifier',
  'id'
]

export const NAME_FIELDS = [
  'canonicalName',
  'scientificName',
  'scientificname',
  'nome',
  'nomeCientifico',
  'nome_cientifico',
  'nomeCientífico',
  'species',
  'especie',
  'speciesScientificName'
]

export function normalizeId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export function normalizeName(value: unknown): string | null {
  return normalizeNameKey(value)
}

export function createLookup<T>(): IndexedLookup<T> {
  return {
    byId: new Map(),
    byFlatName: new Map()
  }
}

export function addToLookup<T>(
  lookup: IndexedLookup<T>,
  ids: string[],
  names: string[],
  value: T
): void {
  for (const id of ids) {
    if (!id) continue
    const existing = lookup.byId.get(id)
    if (existing) {
      existing.push(value)
    } else {
      lookup.byId.set(id, [value])
    }
  }

  for (const name of names) {
    if (!name) continue
    const existing = lookup.byFlatName.get(name)
    if (existing) {
      existing.push(value)
    } else {
      lookup.byFlatName.set(name, [value])
    }
  }
}

export function collectDocumentIds(doc: MongoDoc): string[] {
  const values = new Set<string>()
  for (const field of ID_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(doc, field)) {
      const normalized = normalizeId((doc as Record<string, unknown>)[field])
      if (normalized) values.add(normalized)
    }
  }
  return Array.from(values)
}

export function collectDocumentNames(doc: MongoDoc): string[] {
  const values = new Set<string>()
  for (const field of NAME_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(doc, field)) {
      const normalized = normalizeName((doc as Record<string, unknown>)[field])
      if (normalized) values.add(normalized)
    }
  }
  if (
    typeof doc.flatScientificName === 'string' &&
    doc.flatScientificName.trim()
  ) {
    values.add(doc.flatScientificName.trim().toLocaleLowerCase())
  }
  if (
    typeof doc.flatScientificname === 'string' &&
    doc.flatScientificname.trim()
  ) {
    values.add(doc.flatScientificname.trim().toLocaleLowerCase())
  }
  return Array.from(values)
}

export function gatherLookupMatches<T>(
  lookup: IndexedLookup<T>,
  ids: string[],
  flatNames: string[]
): T[] {
  const results: T[] = []
  const seen = new Set<T>()

  for (const id of ids) {
    const entries = lookup.byId.get(id)
    if (!entries) continue
    for (const entry of entries) {
      if (seen.has(entry)) continue
      seen.add(entry)
      results.push(entry)
    }
  }

  for (const name of flatNames) {
    const entries = lookup.byFlatName.get(name)
    if (!entries) continue
    for (const entry of entries) {
      if (seen.has(entry)) continue
      seen.add(entry)
      results.push(entry)
    }
  }

  return results
}

export async function materializeCollection(
  collection: Collection<MongoDoc>
): Promise<MongoDoc[]> {
  return collection.find({}).toArray()
}
