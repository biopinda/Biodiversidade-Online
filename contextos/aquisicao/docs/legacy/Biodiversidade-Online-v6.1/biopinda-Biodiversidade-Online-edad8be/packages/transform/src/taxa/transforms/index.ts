/**
 * Atomic transform functions for taxa
 * Each function takes a document and returns a transformed document or null
 */

import { buildFlatScientificName } from '../../utils/name'
import type {
  NormalizedTaxonDocument,
  RawTaxonDocument
} from '../normalizeTaxon'

const FAUNA_KINGDOM = 'Animalia'
const FLORA_RANK_WHITELIST = new Set([
  'ESPECIE',
  'VARIEDADE',
  'FORMA',
  'SUB_ESPECIE'
])
const HYPHENIZE_REGEX = /\s+/g

type DistributionEntry = Record<string, any>

function cloneDocument<T extends Record<string, unknown>>(input: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(input)
  }
  return JSON.parse(JSON.stringify(input)) as T
}

/**
 * Transform 1: Validate document structure and clone
 */
export function validateAndClone(
  raw: RawTaxonDocument
): NormalizedTaxonDocument | null {
  if (!raw?._id || typeof raw._id !== 'string') {
    return null
  }

  const base = cloneDocument(raw) as NormalizedTaxonDocument
  base._id = raw._id
  return base
}

/**
 * Transform 2: Filter by taxon rank
 */
export function filterByTaxonRank(
  doc: NormalizedTaxonDocument
): NormalizedTaxonDocument | null {
  const rank = doc.taxonRank
  if (typeof rank !== 'string' || !FLORA_RANK_WHITELIST.has(rank)) {
    return null
  }
  return doc
}

/**
 * Transform 3: Build canonical name
 */
export function buildCanonicalName(
  doc: NormalizedTaxonDocument
): NormalizedTaxonDocument {
  const tokens = [
    doc.genus,
    doc.genericName,
    doc.subgenus,
    doc.infragenericEpithet,
    doc.specificEpithet,
    doc.infraspecificEpithet,
    doc.cultivarEpiteth
  ]

  const cleaned = tokens
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value && value.length > 0)

  if (cleaned.length > 0) {
    doc.canonicalName = cleaned.join(' ')
  }

  return doc
}

/**
 * Transform 4: Build flat scientific name
 */
export function buildFlatScientificName_Transform(
  doc: NormalizedTaxonDocument
): NormalizedTaxonDocument {
  const scientificNameValue =
    typeof doc.scientificName === 'string' && doc.scientificName.trim()
      ? doc.scientificName.trim()
      : undefined

  const flatScientificName = scientificNameValue
    ? buildFlatScientificName(scientificNameValue)
    : doc.canonicalName
      ? buildFlatScientificName(doc.canonicalName)
      : undefined

  if (flatScientificName) {
    doc.flatScientificName = flatScientificName
  }

  return doc
}

/**
 * Transform 5: Normalize higher classification
 */
export function normalizeHigherClassification(
  doc: NormalizedTaxonDocument
): NormalizedTaxonDocument {
  const value = doc.higherClassification
  if (typeof value === 'string') {
    const parts = value.split(';').map((part) => part.trim())
    const normalized =
      parts.length > 1 && parts[1] ? parts[1] : parts[0] || undefined
    if (normalized) {
      doc.higherClassification = normalized
    }
  }
  return doc
}

/**
 * Transform 6: Normalize kingdom
 */
export function normalizeKingdom(
  doc: NormalizedTaxonDocument
): NormalizedTaxonDocument {
  const value = doc.kingdom
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) {
      if (trimmed.toLowerCase().includes('animalia')) {
        doc.kingdom = FAUNA_KINGDOM
      } else {
        doc.kingdom = trimmed
      }
    }
  }
  return doc
}

/**
 * Transform 7: Normalize vernacular names
 */
export function normalizeVernacularNames(
  doc: NormalizedTaxonDocument
): NormalizedTaxonDocument {
  const input = doc.vernacularname
  if (!Array.isArray(input)) {
    return doc
  }

  const normalized = input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const vernacular = (entry as Record<string, unknown>).vernacularName
      const language = (entry as Record<string, unknown>).language

      if (typeof vernacular !== 'string' || !vernacular.trim()) return null

      const normalizedVernacular = vernacular
        .trim()
        .toLowerCase()
        .replace(HYPHENIZE_REGEX, '-')
      const normalizedLanguage =
        typeof language === 'string' && language.trim()
          ? language.trim().charAt(0).toUpperCase() +
            language.trim().slice(1).toLowerCase()
          : 'Português'

      return {
        vernacularName: normalizedVernacular,
        language: normalizedLanguage
      }
    })
    .filter(Boolean) as Array<{ vernacularName: string; language: string }>

  if (normalized.length > 0) {
    doc.vernacularname = normalized
  }

  return doc
}

/**
 * Transform 8: Normalize flora distribution
 */
function normalizeFloraDistribution(
  distribution: DistributionEntry[]
): Record<string, unknown> | undefined {
  if (!distribution.length) {
    return undefined
  }

  const [first] = distribution
  const origin = first?.establishmentMeans
  const occurrenceRemarks = first?.occurrenceRemarks ?? {}
  const occurrenceList = distribution
    .map((item) => item?.locationID)
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0
    )
    .map((value) => value.trim())
    .sort()

  const vegetationType =
    Array.isArray(first?.speciesprofile) && first.speciesprofile.length > 0
      ? first.speciesprofile[0]?.lifeForm?.vegetationType
      : undefined

  return {
    origin:
      typeof origin === 'string' && origin.trim() ? origin.trim() : undefined,
    Endemism: occurrenceRemarks?.endemism,
    phytogeographicDomains: occurrenceRemarks?.phytogeographicDomain,
    occurrence: occurrenceList,
    vegetationType
  }
}

/**
 * Transform 8b: Normalize fauna distribution
 */
function normalizeFaunaDistribution(
  distribution: DistributionEntry[]
): Record<string, unknown> | undefined {
  if (!distribution.length) {
    return undefined
  }

  const [first] = distribution
  const origin =
    typeof first?.establishmentMeans === 'string' &&
    first.establishmentMeans.trim()
      ? first.establishmentMeans.trim()
      : undefined

  const buildList = (value: unknown) =>
    typeof value === 'string'
      ? value
          .split(';')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : []

  return {
    origin,
    occurrence: buildList(first?.locality),
    countryCode: buildList(first?.countryCode)
  }
}

/**
 * Transform 8: Extract and normalize distribution
 */
export function extractDistribution(
  doc: NormalizedTaxonDocument
): NormalizedTaxonDocument {
  const distribution = doc.distribution
  if (!Array.isArray(distribution)) {
    delete doc.distribution
    return doc
  }

  const entries = distribution.filter(
    (entry): entry is DistributionEntry => !!entry && typeof entry === 'object'
  )

  if (!entries.length) {
    delete doc.distribution
    return doc
  }

  const normalizedKingdom = doc.kingdom
  const normalized =
    normalizedKingdom === FAUNA_KINGDOM
      ? normalizeFaunaDistribution(entries)
      : normalizeFloraDistribution(entries)

  if (normalized) {
    doc.distribution = normalized
  } else {
    delete doc.distribution
  }

  return doc
}

/**
 * Transform 9: Normalize species profile
 */
export function normalizeSpeciesProfile(
  doc: NormalizedTaxonDocument
): NormalizedTaxonDocument {
  const input = doc.speciesprofile
  if (!Array.isArray(input) || !input.length) {
    delete doc.speciesprofile
    return doc
  }

  const first = input[0]
  if (!first || typeof first !== 'object') {
    delete doc.speciesprofile
    return doc
  }

  const cloned = cloneDocument(first as Record<string, unknown>)
  if (cloned.lifeForm && typeof cloned.lifeForm === 'object') {
    delete (cloned.lifeForm as Record<string, unknown>).vegetationType
  }

  doc.speciesprofile = cloned
  return doc
}

/**
 * Transform 10: Convert resource relationship to other names
 */
export function convertResourceRelationshipToOtherNames(
  doc: NormalizedTaxonDocument
): NormalizedTaxonDocument {
  const input = doc.resourcerelationship
  if (!Array.isArray(input) || !input.length) {
    delete doc.resourcerelationship
    return doc
  }

  const mapped = input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const record = entry as Record<string, unknown>
      const taxonID =
        typeof record.relatedResourceID === 'string'
          ? record.relatedResourceID.trim()
          : undefined
      const taxonomicStatus =
        typeof record.relationshipOfResource === 'string'
          ? record.relationshipOfResource.trim()
          : undefined

      if (!taxonID) {
        return null
      }

      return {
        taxonID,
        scientificName: null,
        taxonomicStatus: taxonomicStatus ?? null
      }
    })
    .filter(Boolean) as Array<{
    taxonID: string
    scientificName: null
    taxonomicStatus: string | null
  }>

  if (mapped.length > 0) {
    doc.othernames = mapped
  }

  delete doc.resourcerelationship
  return doc
}

/**
 * Transform 11: Force kingdom for fauna (if already Animalia)
 */
export function forceAnimaliKingdom(
  doc: NormalizedTaxonDocument
): NormalizedTaxonDocument {
  if (doc.kingdom === FAUNA_KINGDOM) {
    doc.kingdom = FAUNA_KINGDOM
  }
  return doc
}
