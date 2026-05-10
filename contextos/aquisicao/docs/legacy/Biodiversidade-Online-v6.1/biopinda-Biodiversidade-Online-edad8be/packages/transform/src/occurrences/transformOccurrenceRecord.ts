import type { Db } from 'mongodb'
import {
  createOccurrenceEnrichmentContext,
  enrichOccurrence
} from './enrichOccurrence.js'
import {
  normalizeOccurrence,
  type NormalizedOccurrenceDocument,
  type RawOccurrenceDocument
} from './normalizeOccurrence.js'

export async function transformOccurrenceRecord(
  rawDoc: RawOccurrenceDocument,
  db?: Db
): Promise<NormalizedOccurrenceDocument | null> {
  const result = normalizeOccurrence(rawDoc)

  if (!result || !result.document || !result.isBrazilian) {
    return null
  }

  const normalized = result.document
  normalized._id = rawDoc._id

  // Add enrichment if database is provided
  if (db) {
    try {
      const context = await createOccurrenceEnrichmentContext(db, {
        warn: (message: string, ...details: unknown[]) =>
          console.warn(`[ENRICH] ${message}`, ...details),
        info: (message: string, ...details: unknown[]) =>
          console.info(`[ENRICH] ${message}`, ...details)
      })

      await enrichOccurrence(normalized, context)
    } catch (error) {
      console.warn(
        'Enrichment failed, continuing with normalized data only:',
        error
      )
    }
  }

  return normalized
}
