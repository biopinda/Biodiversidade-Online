/**
 * Threatened Species Loader
 * Loads data from Flora/Funga do Brasil and other authoritative sources
 */

import { MongoClient } from 'mongodb'
import { logger } from '@/lib/logger'

export interface ThreatenedSpecies {
  _id?: string
  taxonID: string
  scientificName: string
  threatLevel:
    | 'extinct'
    | 'critically-endangered'
    | 'endangered'
    | 'vulnerable'
    | 'near-threatened'
    | 'least-concern'
    | 'data-deficient'
  protectionStatus?: string
  recoveryStatus?: string
  assessmentDate?: Date
  source: string
  lastUpdated: Date
}

export interface FloraFungaResponse {
  name: string
  scientificName: string
  threatLevel: string
  status: string
  protection?: string
}

export async function loadThreatenedSpecies(
  client: MongoClient,
  dbName: string
): Promise<void> {
  const db = client.db(dbName)
  const collection = db.collection<ThreatenedSpecies>('threatened_species')

  try {
    logger.info('Starting threatened species load', {}, 'flora-funga-api')

    // Create index on taxonID for fast lookups
    await collection.createIndex({ taxonID: 1 })

    // Load from Flora/Funga do Brasil API
    // NOTE: This is a mock implementation - replace with actual API integration
    const threatData = await fetchFloraFungaThreatenedData()

    if (threatData.length === 0) {
      logger.warn('No threatened species data from Flora/Funga', {}, 'flora-funga-api')
      return
    }

    // Batch insert/update threatened species
    const bulkOps = threatData.map((item) => ({
      updateOne: {
        filter: { taxonID: item.taxonID },
        update: {
          $set: {
            taxonID: item.taxonID,
            scientificName: item.scientificName,
            threatLevel: mapThreatLevel(item.threatLevel),
            protectionStatus: item.protection,
            source: 'Flora/Funga do Brasil',
            lastUpdated: new Date()
          }
        },
        upsert: true
      }
    }))

    if (bulkOps.length > 0) {
      const result = await collection.bulkWrite(bulkOps)
      logger.info('Threatened species loaded', {
        inserted: result.upsertedCount,
        updated: result.modifiedCount,
        total: bulkOps.length
      })
    }
  } catch (error) {
    logger.error(
      'Error loading threatened species',
      error instanceof Error ? error : new Error(String(error)),
      { source: 'flora-funga-api' }
    )
    throw error
  }
}

/**
 * Fetch threatened species data from Flora/Funga do Brasil API
 * This is a mock implementation - replace with actual API integration
 */
async function fetchFloraFungaThreatenedData(): Promise<FloraFungaResponse[]> {
  try {
    // Mock data for demonstration
    // In production, fetch from: https://florafauna.br/api/species/threatened
    return [
      {
        name: 'Arara-azul-grande',
        scientificName: 'Anodorhynchus hyacinthinus',
        threatLevel: 'VU',
        status: 'In recovery',
        protection: 'Legally protected'
      },
      {
        name: 'Onça-pintada',
        scientificName: 'Panthera onca',
        threatLevel: 'VU',
        status: 'Stable',
        protection: 'Legally protected'
      },
      {
        name: 'Muriqui',
        scientificName: 'Brachyteles arachnoides',
        threatLevel: 'EN',
        status: 'Recovering',
        protection: 'Legally protected'
      }
    ]
  } catch (error) {
    logger.warn('Failed to fetch from Flora/Funga API, using fallback', {
      error: error instanceof Error ? error.message : String(error)
    })
    return []
  }
}

/**
 * Map IUCN threat level codes to standardized format
 */
function mapThreatLevel(
  code: string
): ThreatenedSpecies['threatLevel'] {
  const mapping: Record<string, ThreatenedSpecies['threatLevel']> = {
    EX: 'extinct',
    CR: 'critically-endangered',
    EN: 'endangered',
    VU: 'vulnerable',
    NT: 'near-threatened',
    LC: 'least-concern',
    DD: 'data-deficient'
  }
  return mapping[code.toUpperCase()] || 'data-deficient'
}
