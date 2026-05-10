import { createHash } from 'node:crypto'

export interface TaxonIdentifierSource {
  taxonID?: string | null
  source?: 'flora' | 'fauna' | null
}

export interface OccurrenceIdentifierSource {
  occurrenceID?: string | null
  catalogNumber?: string | null
  recordNumber?: string | null
  eventDate?: string | Date | null
  locality?: string | null
  recordedBy?: string | null
}

function normalize(
  value: string | number | Date | null | undefined
): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : undefined
}

function sanitizeSegment(segment: string): string {
  return segment.replace(/[\s]+/g, ' ').trim()
}

export function buildTaxonDeterministicId(
  source: TaxonIdentifierSource
): string {
  const taxonId = normalize(source.taxonID)
  if (!taxonId) {
    throw new Error(
      'Não foi possível gerar _id determinístico: taxonID ausente ou vazio.'
    )
  }

  // Use A prefix for fauna (Animalia) and P prefix for flora (Plantae)
  // to prevent collisions between sources while maintaining compact IDs
  if (source.source === 'fauna') {
    return `A${sanitizeSegment(taxonId)}`
  }
  if (source.source === 'flora') {
    return `P${sanitizeSegment(taxonId)}`
  }

  // Fallback for backward compatibility when source not specified
  return sanitizeSegment(taxonId)
}

export function buildOccurrenceDeterministicId(
  source: OccurrenceIdentifierSource,
  iptId: string
): string {
  const normalizedIpt = sanitizeSegment(normalize(iptId) ?? '')
  if (!normalizedIpt) {
    throw new Error(
      'iptId é obrigatório para gerar _id de ocorrência determinístico.'
    )
  }

  const occurrenceId = normalize(source.occurrenceID)
  if (occurrenceId) {
    return `${sanitizeSegment(occurrenceId)}::${normalizedIpt}`
  }

  const fallbackFields = [
    normalize(source.catalogNumber),
    normalize(source.recordNumber),
    normalize(source.eventDate ?? undefined),
    normalize(source.locality),
    normalize(source.recordedBy)
  ].filter((value): value is string => Boolean(value))

  if (fallbackFields.length === 0) {
    throw new Error(
      'Não foi possível gerar _id determinístico: occurrenceID ausente e campos de fallback vazios.'
    )
  }

  const hash = createHash('sha1')
    .update(`${normalizedIpt}|${fallbackFields.join('|')}`)
    .digest('hex')

  return `hash::${normalizedIpt}::${hash}`
}
