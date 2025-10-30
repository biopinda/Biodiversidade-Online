import { buildFlatScientificName } from '../utils/name'
import type {
  ConservationUnitEntry,
  InvasiveStatusEntry,
  ThreatStatusEntry
} from './enrichTaxon'

export type RawTaxonDocument = Record<string, unknown> & { _id: string }

export interface NormalizedTaxonDocument extends Record<string, unknown> {
  _id: string
  taxonID?: string
  canonicalName?: string
  flatScientificName?: string
  higherClassification?: string
  vernacularname?: Array<{ vernacularName: string; language: string }>
  distribution?: Record<string, unknown>
  othernames?: Array<{
    taxonID?: string
    scientificName?: string | null
    taxonomicStatus?: string | null
  }>
  speciesprofile?: Record<string, unknown>
  kingdom?: string
  threatStatus?: ThreatStatusEntry[]
  invasiveStatus?: InvasiveStatusEntry
  conservationUnits?: ConservationUnitEntry[]
  _transformedAt?: Date
  _transformVersion?: string
}

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

function buildCanonicalName(tokens: Array<unknown>): string | undefined {
  const cleaned = tokens
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value && value.length > 0)

  if (!cleaned.length) {
    return undefined
  }

  return cleaned.join(' ')
}

function normalizeVernacularNames(
  input: unknown
): Array<{ vernacularName: string; language: string }> | undefined {
  if (!Array.isArray(input)) {
    return undefined
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

  return normalized.length ? normalized : undefined
}

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

function extractDistribution(
  distribution: unknown,
  normalizedKingdom: string | undefined
): Record<string, unknown> | undefined {
  if (!Array.isArray(distribution)) {
    return undefined
  }

  const entries = distribution.filter(
    (entry): entry is DistributionEntry => !!entry && typeof entry === 'object'
  )
  if (!entries.length) {
    return undefined
  }

  if (normalizedKingdom === FAUNA_KINGDOM) {
    return normalizeFaunaDistribution(entries)
  }

  return normalizeFloraDistribution(entries)
}

function normalizeSpeciesProfile(
  input: unknown
): Record<string, unknown> | undefined {
  if (!Array.isArray(input) || !input.length) {
    return undefined
  }

  const first = input[0]
  if (!first || typeof first !== 'object') {
    return undefined
  }

  const cloned = cloneDocument(first as Record<string, unknown>)
  if (cloned.lifeForm && typeof cloned.lifeForm === 'object') {
    delete (cloned.lifeForm as Record<string, unknown>).vegetationType
  }

  return cloned
}

function normalizeOtherNames(input: unknown):
  | Array<{
      taxonID?: string
      scientificName?: string | null
      taxonomicStatus?: string | null
    }>
  | undefined {
  if (!Array.isArray(input) || !input.length) {
    return undefined
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

  return mapped.length ? mapped : undefined
}

function normalizeHigherClassification(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const parts = value.split(';').map((part) => part.trim())
  return parts.length > 1 && parts[1] ? parts[1] : parts[0] || undefined
}

function normalizeKingdom(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed.toLowerCase().includes('animalia')) {
    return FAUNA_KINGDOM
  }
  return trimmed
}

export function isSupportedTaxonRank(rank: unknown): rank is string {
  return typeof rank === 'string' && FLORA_RANK_WHITELIST.has(rank)
}

export function normalizeTaxon(
  raw: RawTaxonDocument
): NormalizedTaxonDocument | null {
  if (!raw?._id || typeof raw._id !== 'string') {
    return null
  }

  const rank = raw.taxonRank
  if (!isSupportedTaxonRank(rank)) {
    return null
  }

  const normalizedKingdom = normalizeKingdom(raw.kingdom)
  const base = cloneDocument(raw) as NormalizedTaxonDocument

  base._id = raw._id

  // canonical & flat names
  const canonicalName = buildCanonicalName([
    base.genus,
    base.genericName,
    base.subgenus,
    base.infragenericEpithet,
    base.specificEpithet,
    base.infraspecificEpithet,
    base.cultivarEpiteth
  ])
  if (canonicalName) {
    base.canonicalName = canonicalName
  }

  const scientificNameValue =
    typeof base.scientificName === 'string' && base.scientificName.trim()
      ? base.scientificName.trim()
      : undefined
  const flatScientificName = scientificNameValue
    ? buildFlatScientificName(scientificNameValue)
    : canonicalName
      ? buildFlatScientificName(canonicalName)
      : undefined
  if (flatScientificName) {
    base.flatScientificName = flatScientificName
  }

  const higherClassification = normalizeHigherClassification(
    base.higherClassification
  )
  if (higherClassification) {
    base.higherClassification = higherClassification
  }

  const normalizedVernacular = normalizeVernacularNames(base.vernacularname)
  if (normalizedVernacular) {
    base.vernacularname = normalizedVernacular
  }

  const distribution = extractDistribution(base.distribution, normalizedKingdom)
  if (distribution) {
    base.distribution = distribution
  } else {
    delete base.distribution
  }

  const speciesProfile = normalizeSpeciesProfile(base.speciesprofile)
  if (speciesProfile) {
    base.speciesprofile = speciesProfile
  } else {
    delete base.speciesprofile
  }

  const otherNames = normalizeOtherNames(base.resourcerelationship)
  if (otherNames) {
    base.othernames = otherNames
  }
  delete base.resourcerelationship

  if (normalizedKingdom) {
    base.kingdom = normalizedKingdom
  }

  if (normalizedKingdom === FAUNA_KINGDOM) {
    base.kingdom = FAUNA_KINGDOM
  }

  return base
}
