/**
 * Atomic transform functions for occurrences
 * Each function takes a document and returns a transformed document or null
 */

import {
  normalizeCountryName,
  normalizeStateName
} from '../../lib/normalization'
import { buildFlatScientificName } from '../../utils/name'
import type {
  NormalizedOccurrenceDocument,
  RawOccurrenceDocument
} from '../normalizeOccurrence'

const BRAZIL_NORMALIZED = 'Brasil'
const FLORA_REGEX = /(^|[\s\p{P}])(fl(or|ôr))([\s\p{P}]|$)/iu

function cloneDocument<T extends Record<string, unknown>>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Transform 1: Validate document structure and clone
 */
export function validateAndClone(
  raw: RawOccurrenceDocument
): NormalizedOccurrenceDocument | null {
  if (!raw?._id || typeof raw._id !== 'string') {
    return null
  }

  const normalized = cloneDocument(raw) as NormalizedOccurrenceDocument
  normalized._id = raw._id
  return normalized
}

/**
 * Transform 2: Normalize occurrence ID
 */
export function normalizeOccurrenceId(
  doc: NormalizedOccurrenceDocument
): NormalizedOccurrenceDocument {
  if (typeof doc.occurrenceID === 'string') {
    doc.occurrenceID = doc.occurrenceID.trim()
  }
  return doc
}

/**
 * Transform 3: Build geo point from coordinates
 */
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

export function buildGeoPoint(
  doc: NormalizedOccurrenceDocument
): NormalizedOccurrenceDocument {
  const latitude = toNumber(doc.decimalLatitude)
  const longitude = toNumber(doc.decimalLongitude)

  if (
    latitude !== null &&
    longitude !== null &&
    isValidLatitude(latitude) &&
    isValidLongitude(longitude)
  ) {
    doc.geoPoint = {
      type: 'Point',
      coordinates: [longitude, latitude]
    }
  } else {
    delete doc.geoPoint
  }

  return doc
}

/**
 * Transform 4: Build canonical name
 */
function buildCanonicalNameFromParts(
  parts: Array<unknown>
): string | undefined {
  const filtered = parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((value) => value.length > 0)
  return filtered.length ? filtered.join(' ') : undefined
}

export function buildCanonicalName(
  doc: NormalizedOccurrenceDocument
): NormalizedOccurrenceDocument {
  const canonicalName = buildCanonicalNameFromParts([
    doc.genus,
    doc.genericName,
    doc.subgenus,
    doc.infragenericEpithet,
    doc.specificEpithet,
    doc.infraspecificEpithet,
    doc.cultivarEpiteth
  ])

  if (canonicalName) {
    doc.canonicalName = canonicalName
  }

  return doc
}

/**
 * Transform 5: Build flat scientific name
 */
export function buildFlatScientificName_Transform(
  doc: NormalizedOccurrenceDocument
): NormalizedOccurrenceDocument {
  const scientificName =
    typeof doc.scientificName === 'string'
      ? doc.scientificName.trim()
      : undefined

  const flatScientificName = scientificName
    ? buildFlatScientificName(scientificName)
    : doc.canonicalName
      ? buildFlatScientificName(doc.canonicalName)
      : undefined

  if (flatScientificName) {
    doc.flatScientificName = flatScientificName
  }

  return doc
}

/**
 * Transform 6: Normalize IPT kingdoms
 */
export function normalizeIptKingdoms(
  doc: NormalizedOccurrenceDocument
): NormalizedOccurrenceDocument {
  const value = doc.iptKingdom ?? doc.kingdom

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0)
    if (cleaned.length > 0) {
      doc.iptKingdoms = cleaned
    }
  } else if (typeof value === 'string') {
    const cleaned = value
      .split(/[,;]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
    if (cleaned.length > 0) {
      doc.iptKingdoms = cleaned
    }
  }

  return doc
}

/**
 * Transform 7: Normalize year/month/day
 */
export function normalizeDateFields(
  doc: NormalizedOccurrenceDocument
): NormalizedOccurrenceDocument {
  const yearNumber = toNumber(doc.year)
  if (yearNumber !== null && yearNumber > 0) {
    doc.year = yearNumber
  }

  const monthNumber = toNumber(doc.month)
  if (monthNumber !== null && monthNumber >= 1 && monthNumber <= 12) {
    doc.month = monthNumber
  }

  const dayNumber = toNumber(doc.day)
  if (dayNumber !== null && dayNumber >= 1 && dayNumber <= 31) {
    doc.day = dayNumber
  }

  return doc
}

/**
 * Transform 8: Parse and normalize event date
 */
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

export function normalizeEventDate(
  doc: NormalizedOccurrenceDocument
): NormalizedOccurrenceDocument {
  const parsedDate = parseDate(doc.eventDate)
  if (parsedDate) {
    doc.eventDate = parsedDate

    if (!doc.year || typeof doc.year !== 'number') {
      doc.year = parsedDate.getUTCFullYear()
    }
    if (!doc.month || typeof doc.month !== 'number') {
      doc.month = parsedDate.getUTCMonth() + 1
    }
    if (!doc.day || typeof doc.day !== 'number') {
      doc.day = parsedDate.getUTCDate()
    }
  }

  return doc
}

/**
 * Transform 9: Normalize country
 */
export function normalizeCountry(
  doc: NormalizedOccurrenceDocument
): NormalizedOccurrenceDocument {
  const normalizedCountry = normalizeCountryName(doc.country)
  if (normalizedCountry) {
    doc.country = normalizedCountry
  }
  return doc
}

/**
 * Transform 10: Normalize state/province
 */
export function normalizeState(
  doc: NormalizedOccurrenceDocument
): NormalizedOccurrenceDocument {
  const normalizedState = normalizeStateName(doc.stateProvince)
  if (normalizedState) {
    doc.stateProvince = normalizedState
  }
  return doc
}

/**
 * Transform 11: Normalize county
 */
function normalizeCountyName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((fragment) => fragment.charAt(0).toUpperCase() + fragment.slice(1))
    .join(' ')
}

export function normalizeCounty(
  doc: NormalizedOccurrenceDocument
): NormalizedOccurrenceDocument {
  const normalizedCounty = normalizeCountyName(doc.county)
  if (normalizedCounty) {
    doc.county = normalizedCounty
  }
  return doc
}

/**
 * Transform 12: Check if Brazilian and set reproductive condition
 */
export function checkBrazilianAndSetReproductiveCondition(
  doc: NormalizedOccurrenceDocument
): NormalizedOccurrenceDocument | null {
  const isBrazilian = doc.country === BRAZIL_NORMALIZED

  // Filter: only process Brazilian occurrences
  if (!isBrazilian) {
    return null
  }

  const plantKingdom = (doc.iptKingdoms ?? [])
    .map((value) => value.toLowerCase())
    .includes('plantae')

  if (
    plantKingdom &&
    typeof doc.occurrenceRemarks === 'string' &&
    FLORA_REGEX.test(doc.occurrenceRemarks)
  ) {
    doc.reproductiveCondition = 'flor'
  }

  return doc
}
