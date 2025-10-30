import {
  normalizeCountryName,
  normalizeStateName
} from '../lib/normalization.ts'
import { buildFlatScientificName } from '../utils/name'

export type RawOccurrenceDocument = Record<string, unknown> & { _id: string }

export interface GeoPoint {
  type: 'Point'
  coordinates: [number, number]
}

export interface NormalizedOccurrenceDocument extends Record<string, unknown> {
  _id: string
  occurrenceID?: string
  taxonID?: string
  geoPoint?: GeoPoint
  canonicalName?: string
  flatScientificName?: string
  iptKingdoms?: string[]
  collectors?: string[]
  parsingStatus?: 'success' | 'failed' | 'skipped'
  _transformedAt?: Date
  _transformVersion?: string
}

const BRAZIL_NORMALIZED = 'Brasil'
const FLORA_REGEX = /(^|[\s\p{P}])(fl(or|ôr))([\s\p{P}]|$)/iu

function cloneDocument<T extends Record<string, unknown>>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function isValidLatitude(value: number): boolean {
  return !Number.isNaN(value) && value >= -90 && value <= 90
}

function isValidLongitude(value: number): boolean {
  return !Number.isNaN(value) && value >= -180 && value <= 180
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function buildCanonicalName(parts: Array<unknown>): string | undefined {
  const filtered = parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((value) => value.length > 0)
  return filtered.length ? filtered.join(' ') : undefined
}

function normalizeIptKingdoms(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0)
    return cleaned.length ? cleaned : undefined
  }

  if (typeof value === 'string') {
    const cleaned = value
      .split(/[,;]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
    return cleaned.length ? cleaned : undefined
  }

  return undefined
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return null
}

export interface NormalizeOccurrenceResult {
  document: NormalizedOccurrenceDocument | null
  isBrazilian: boolean
}

function normalizeCounty(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((fragment) => fragment.charAt(0).toUpperCase() + fragment.slice(1))
    .join(' ')
}

export function normalizeOccurrence(
  raw: RawOccurrenceDocument
): NormalizeOccurrenceResult {
  if (!raw?._id || typeof raw._id !== 'string') {
    return { document: null, isBrazilian: false }
  }

  const normalized = cloneDocument(raw) as NormalizedOccurrenceDocument
  normalized._id = raw._id

  if (typeof normalized.occurrenceID === 'string') {
    normalized.occurrenceID = normalized.occurrenceID.trim()
  }

  const latitude = toNumber(normalized.decimalLatitude)
  const longitude = toNumber(normalized.decimalLongitude)
  if (
    latitude !== null &&
    longitude !== null &&
    isValidLatitude(latitude) &&
    isValidLongitude(longitude)
  ) {
    normalized.geoPoint = {
      type: 'Point',
      coordinates: [longitude, latitude]
    }
  } else {
    delete normalized.geoPoint
  }

  const canonicalName = buildCanonicalName([
    normalized.genus,
    normalized.genericName,
    normalized.subgenus,
    normalized.infragenericEpithet,
    normalized.specificEpithet,
    normalized.infraspecificEpithet,
    normalized.cultivarEpiteth
  ])
  if (canonicalName) {
    normalized.canonicalName = canonicalName
  }

  const scientificName =
    typeof normalized.scientificName === 'string'
      ? normalized.scientificName.trim()
      : undefined
  const flatScientificName = scientificName
    ? buildFlatScientificName(scientificName)
    : canonicalName
      ? buildFlatScientificName(canonicalName)
      : undefined
  if (flatScientificName) {
    normalized.flatScientificName = flatScientificName
  }

  const iptKingdoms = normalizeIptKingdoms(
    normalized.iptKingdom ?? normalized.kingdom
  )
  if (iptKingdoms) {
    normalized.iptKingdoms = iptKingdoms
  }

  const yearNumber = toNumber(normalized.year)
  if (yearNumber !== null && yearNumber > 0) {
    normalized.year = yearNumber
  }

  const monthNumber = toNumber(normalized.month)
  if (monthNumber !== null && monthNumber >= 1 && monthNumber <= 12) {
    normalized.month = monthNumber
  }

  const dayNumber = toNumber(normalized.day)
  if (dayNumber !== null && dayNumber >= 1 && dayNumber <= 31) {
    normalized.day = dayNumber
  }

  const parsedDate = parseDate(normalized.eventDate)
  if (parsedDate) {
    normalized.eventDate = parsedDate

    if (!normalized.year || typeof normalized.year !== 'number') {
      normalized.year = parsedDate.getUTCFullYear()
    }
    if (!normalized.month || typeof normalized.month !== 'number') {
      normalized.month = parsedDate.getUTCMonth() + 1
    }
    if (!normalized.day || typeof normalized.day !== 'number') {
      normalized.day = parsedDate.getUTCDate()
    }
  }

  const normalizedCountry = normalizeCountryName(normalized.country)
  if (normalizedCountry) {
    normalized.country = normalizedCountry
  }

  const normalizedState = normalizeStateName(normalized.stateProvince)
  if (normalizedState) {
    normalized.stateProvince = normalizedState
  }

  const normalizedCounty = normalizeCounty(normalized.county)
  if (normalizedCounty) {
    normalized.county = normalizedCounty
  }

  const isBrazilian = normalized.country === BRAZIL_NORMALIZED

  const plantKingdom = (normalized.iptKingdoms ?? [])
    .map((value) => value.toLowerCase())
    .includes('plantae')

  if (
    plantKingdom &&
    typeof normalized.occurrenceRemarks === 'string' &&
    FLORA_REGEX.test(normalized.occurrenceRemarks)
  ) {
    normalized.reproductiveCondition = 'flor'
  }

  return {
    document: normalized,
    isBrazilian
  }
}
