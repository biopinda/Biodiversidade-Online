/**
 * Data Version Tracking
 * Manages data version metadata for consistency across interfaces
 */

import { getMongoDatabase } from './mongo'
import { logger } from './logger'

export interface DataVersion {
  _id?: string
  version: string
  timestamp: Date
  transformationId: string
  recordsProcessed: number
  recordsError: number
  status: 'success' | 'failed' | 'partial'
  collections: {
    taxa: number
    occurrences: number
    threatenedSpecies: number
    invasiveSpecies: number
    conservationUnits: number
  }
  checksum: string
}

/**
 * Get current data version
 */
export async function getCurrentDataVersion(): Promise<DataVersion | null> {
  try {
    const db = await getMongoDatabase()
    const collection = db.collection('data_versions')

    const latest = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray()

    if (latest.length === 0) {
      logger.debug('No data version found')
      return null
    }

    logger.info('Retrieved current data version', {
      version: latest[0].version,
      timestamp: latest[0].timestamp
    })

    return latest[0] as unknown as DataVersion
  } catch (error) {
    logger.error(
      'Error retrieving data version',
      error instanceof Error ? error : new Error(String(error))
    )
    return null
  }
}

/**
 * Record a new data version after transformation
 */
export async function recordDataVersion(
  data: Omit<DataVersion, '_id'>
): Promise<boolean> {
  try {
    const db = await getMongoDatabase()
    const collection = db.collection('data_versions')

    const result = await collection.insertOne(data as any)

    logger.info('Recorded new data version', {
      version: data.version,
      transformationId: data.transformationId,
      recordsProcessed: data.recordsProcessed,
      status: data.status
    })

    return !!result.insertedId
  } catch (error) {
    logger.error(
      'Error recording data version',
      error instanceof Error ? error : new Error(String(error))
    )
    return false
  }
}

/**
 * Get version history (last N versions)
 */
export async function getVersionHistory(
  limit: number = 10
): Promise<DataVersion[]> {
  try {
    const db = await getMongoDatabase()
    const collection = db.collection('data_versions')

    const versions = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()

    logger.debug('Retrieved version history', { count: versions.length })

    return versions as unknown as DataVersion[]
  } catch (error) {
    logger.error(
      'Error retrieving version history',
      error instanceof Error ? error : new Error(String(error))
    )
    return []
  }
}

/**
 * Check if data is stale (older than threshold)
 */
export async function isDataStale(
  thresholdHours: number = 24
): Promise<boolean> {
  try {
    const currentVersion = await getCurrentDataVersion()

    if (!currentVersion) {
      logger.warn('No data version available, considering data stale')
      return true
    }

    const versionAge = Date.now() - currentVersion.timestamp.getTime()
    const thresholdMs = thresholdHours * 60 * 60 * 1000

    const isStale = versionAge > thresholdMs

    if (isStale) {
      logger.warn('Data is stale', {
        ageHours: Math.floor(versionAge / (60 * 60 * 1000)),
        thresholdHours,
        version: currentVersion.version
      })
    }

    return isStale
  } catch (error) {
    logger.error(
      'Error checking data staleness',
      error instanceof Error ? error : new Error(String(error))
    )
    return true // Assume stale on error
  }
}

/**
 * Get version info for API headers
 */
export async function getVersionHeaders(): Promise<Record<string, string>> {
  try {
    const currentVersion = await getCurrentDataVersion()

    if (!currentVersion) {
      return {
        'X-Data-Version': 'unknown',
        'X-Data-Timestamp': new Date().toISOString()
      }
    }

    return {
      'X-Data-Version': currentVersion.version,
      'X-Data-Timestamp': currentVersion.timestamp.toISOString(),
      'X-Data-Status': currentVersion.status,
      'X-Transformation-ID': currentVersion.transformationId
    }
  } catch (error) {
    logger.error(
      'Error building version headers',
      error instanceof Error ? error : new Error(String(error))
    )
    return {
      'X-Data-Version': 'unknown'
    }
  }
}
