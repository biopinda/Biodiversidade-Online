/**
 * Invasive Species Loader
 * Loads data from IBAMA and other authoritative sources
 */

import { logger } from '@/lib/logger'
import { MongoClient } from 'mongodb'

export interface InvasiveSpecies {
  _id?: string
  taxonID: string
  scientificName: string
  geographicOrigin?: string
  ecosystemImpact?: string
  invasivenessLevel?: 'high' | 'medium' | 'low'
  affectedBiomes?: string[]
  source: string
  assessmentDate?: Date
  lastUpdated: Date
}

export interface IBAMAInvasiveResponse {
  name: string
  scientificName: string
  origin: string
  impact: string
  riskLevel: string
  affectedBiomes?: string[]
}

export async function loadInvasiveSpecies(
  client: MongoClient,
  dbName: string
): Promise<void> {
  const db = client.db(dbName)
  const collection = db.collection<InvasiveSpecies>('invasive_species')

  try {
    logger.info('Starting invasive species load', {}, 'ibama')

    // Create index on taxonID for fast lookups
    await collection.createIndex({ taxonID: 1 })

    // Load from IBAMA registry
    const invasiveData = await fetchIBAMAInvasiveData()

    if (invasiveData.length === 0) {
      logger.warn('No invasive species data from IBAMA', {}, 'ibama')
      return
    }

    // Batch insert/update invasive species
    const bulkOps = invasiveData.map((item) => ({
      updateOne: {
        filter: { taxonID: item.taxonID },
        update: {
          $set: {
            taxonID: item.taxonID,
            scientificName: item.scientificName,
            geographicOrigin: item.origin,
            ecosystemImpact: item.impact,
            invasivenessLevel: mapRiskLevel(item.riskLevel),
            affectedBiomes: item.affectedBiomes || [],
            source: 'IBAMA',
            assessmentDate: new Date(),
            lastUpdated: new Date()
          }
        },
        upsert: true
      }
    }))

    if (bulkOps.length > 0) {
      const result = await collection.bulkWrite(bulkOps)
      logger.info('Invasive species loaded', {
        inserted: result.upsertedCount,
        updated: result.modifiedCount,
        total: bulkOps.length
      })
    }
  } catch (error) {
    logger.error(
      'Error loading invasive species',
      error instanceof Error ? error : new Error(String(error)),
      { source: 'ibama' }
    )
    throw error
  }
}

/**
 * Fetch invasive species data from IBAMA registry
 * This is a mock implementation - replace with actual API integration
 */
async function fetchIBAMAInvasiveData(): Promise<IBAMAInvasiveResponse[]> {
  try {
    // Mock data for demonstration
    // In production, fetch from: https://www.ibama.gov.br/invasoras/api
    return [
      {
        name: 'Peixe-leão',
        scientificName: 'Pterois volitans',
        origin: 'Indo-Pacific',
        impact: 'Predation of native fish, disruption of ecosystem',
        riskLevel: 'high',
        affectedBiomes: ['Atlantic Ocean', 'Caribbean']
      },
      {
        name: 'Mexilhão-dourado',
        scientificName: 'Limnoperna fortunei',
        origin: 'Asia',
        impact: 'Fouling of infrastructure, competition with native mussels',
        riskLevel: 'high',
        affectedBiomes: ['Freshwater', 'Rivers']
      },
      {
        name: 'Tiririca-africana',
        scientificName: 'Cenchrus echinatus',
        origin: 'Africa',
        impact:
          'Competition with native plants, difficulty for livestock grazing',
        riskLevel: 'medium',
        affectedBiomes: ['Cerrado', 'Caatinga']
      }
    ]
  } catch (error) {
    logger.warn('Failed to fetch from IBAMA API, using fallback', {
      error: error instanceof Error ? error.message : String(error)
    })
    return []
  }
}

/**
 * Map IBAMA risk levels to standardized format
 */
function mapRiskLevel(level: string): InvasiveSpecies['invasivenessLevel'] {
  const mapping: Record<string, InvasiveSpecies['invasivenessLevel']> = {
    alta: 'high',
    high: 'high',
    media: 'medium',
    medium: 'medium',
    baixa: 'low',
    low: 'low'
  }
  return mapping[level.toLowerCase()] || 'medium'
}
