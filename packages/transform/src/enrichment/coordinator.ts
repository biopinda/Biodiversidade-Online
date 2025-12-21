/**
 * Enrichment Coordinator
 * Orchestrates loading and enrichment of biodiversity data
 */

import { MongoClient } from 'mongodb'
import { logger } from '@/lib/logger'
import { loadThreatenedSpecies } from '../loaders/threatened'
import { loadInvasiveSpecies } from '../loaders/invasive'
import { loadConservationUnits } from '../loaders/conservation_units'

export interface EnrichmentResult {
  success: boolean
  startTime: Date
  endTime: Date
  duration: number
  loadedThreatened: number
  loadedInvasive: number
  loadedConservationUnits: number
  errors: string[]
}

/**
 * Run complete enrichment pipeline
 */
export async function runEnrichmentPipeline(
  client: MongoClient,
  dbName: string
): Promise<EnrichmentResult> {
  const startTime = new Date()
  const errors: string[] = []

  try {
    logger.info('Starting enrichment pipeline', { dbName })

    // Load threatened species
    try {
      await loadThreatenedSpecies(client, dbName)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      errors.push(`Threatened species load failed: ${msg}`)
      logger.error('Threatened species load failed', error instanceof Error ? error : new Error(String(error)))
    }

    // Load invasive species
    try {
      await loadInvasiveSpecies(client, dbName)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      errors.push(`Invasive species load failed: ${msg}`)
      logger.error('Invasive species load failed', error instanceof Error ? error : new Error(String(error)))
    }

    // Load conservation units
    try {
      await loadConservationUnits(client, dbName)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      errors.push(`Conservation units load failed: ${msg}`)
      logger.error('Conservation units load failed', error instanceof Error ? error : new Error(String(error)))
    }

    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()

    logger.info('Enrichment pipeline completed', {
      duration,
      errors: errors.length
    })

    return {
      success: errors.length === 0,
      startTime,
      endTime,
      duration,
      loadedThreatened: 0, // Would be actual count from database
      loadedInvasive: 0, // Would be actual count from database
      loadedConservationUnits: 0, // Would be actual count from database
      errors
    }
  } catch (error) {
    const endTime = new Date()
    logger.error(
      'Enrichment pipeline failed',
      error instanceof Error ? error : new Error(String(error)),
      { dbName }
    )
    throw error
  }
}
