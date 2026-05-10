/**
 * Transformation Rollback
 * Restores previous data snapshot on transformation failure
 */

import { logger } from '@/lib/logger'
import { MongoClient } from 'mongodb'

export interface RollbackSnapshot {
  _id?: string
  timestamp: Date
  version: string
  collections: string[]
  status: 'active' | 'archived'
  reason?: string
}

/**
 * Create backup snapshot before transformation
 */
export async function createSnapshot(
  client: MongoClient,
  dbName: string,
  version: string
): Promise<boolean> {
  try {
    const db = client.db(dbName)
    const snapshotDb = client.db(`${dbName}_snapshots`)

    // Get list of collections to backup
    const collections = [
      'taxa',
      'occurrences',
      'threatened_species',
      'invasive_species',
      'conservation_units'
    ]

    logger.info('Creating transformation snapshot', {
      version,
      collectionCount: collections.length
    })

    // Copy collections to snapshot database
    for (const collectionName of collections) {
      const sourceCollection = db.collection(collectionName)
      const snapshotCollection = snapshotDb.collection(
        `${collectionName}_${version}`
      )

      // Get all documents and insert into snapshot
      const documents = await sourceCollection.find({}).toArray()

      if (documents.length > 0) {
        await snapshotCollection.insertMany(documents)
        logger.debug(`Backed up ${collectionName}`, {
          documentCount: documents.length
        })
      }
    }

    // Record snapshot metadata
    const metadataCollection = snapshotDb.collection('snapshots')
    await metadataCollection.insertOne({
      timestamp: new Date(),
      version,
      collections,
      status: 'active'
    })

    logger.info('Snapshot created successfully', { version })
    return true
  } catch (error) {
    logger.error(
      'Error creating snapshot',
      error instanceof Error ? error : new Error(String(error)),
      { version }
    )
    return false
  }
}

/**
 * Rollback to previous snapshot if error rate exceeds threshold
 */
export async function rollbackOnFailure(
  client: MongoClient,
  dbName: string,
  errorRate: number,
  errorRateThreshold: number = 10 // 10%
): Promise<boolean> {
  if (errorRate <= errorRateThreshold) {
    logger.info('Error rate acceptable, no rollback needed', { errorRate })
    return true
  }

  logger.warn('Error rate exceeds threshold, initiating rollback', {
    errorRate,
    threshold: errorRateThreshold
  })

  try {
    const previousSnapshot = await getPreviousSnapshot(client, dbName)

    if (!previousSnapshot) {
      logger.error('No previous snapshot available for rollback')
      return false
    }

    const success = await restoreSnapshot(client, dbName, previousSnapshot)

    if (success) {
      logger.info('Rollback completed successfully', {
        version: previousSnapshot.version
      })
    } else {
      logger.error('Rollback failed')
    }

    return success
  } catch (error) {
    logger.error(
      'Error during rollback',
      error instanceof Error ? error : new Error(String(error))
    )
    return false
  }
}

/**
 * Get most recent snapshot (previous version)
 */
export async function getPreviousSnapshot(
  client: MongoClient,
  dbName: string
): Promise<RollbackSnapshot | null> {
  try {
    const snapshotDb = client.db(`${dbName}_snapshots`)
    const metadataCollection = snapshotDb.collection('snapshots')

    const snapshot = await metadataCollection.findOne(
      { status: 'active' },
      { sort: { timestamp: -1 } }
    )

    if (snapshot) {
      logger.debug('Retrieved previous snapshot', {
        version: snapshot.version,
        timestamp: snapshot.timestamp
      })
    }

    return snapshot as unknown as RollbackSnapshot | null
  } catch (error) {
    logger.error(
      'Error retrieving previous snapshot',
      error instanceof Error ? error : new Error(String(error))
    )
    return null
  }
}

/**
 * Restore data from snapshot
 */
export async function restoreSnapshot(
  client: MongoClient,
  dbName: string,
  snapshot: RollbackSnapshot
): Promise<boolean> {
  try {
    const db = client.db(dbName)
    const snapshotDb = client.db(`${dbName}_snapshots`)

    logger.info('Starting snapshot restore', {
      version: snapshot.version,
      collections: snapshot.collections.length
    })

    for (const collectionName of snapshot.collections) {
      const sourceCollection = snapshotDb.collection(
        `${collectionName}_${snapshot.version}`
      )
      const targetCollection = db.collection(collectionName)

      // Drop and recreate collection
      try {
        await targetCollection.drop()
      } catch (e) {
        // Collection might not exist, that's ok
      }

      // Copy documents from snapshot
      const documents = await sourceCollection.find({}).toArray()

      if (documents.length > 0) {
        await targetCollection.insertMany(documents)
        logger.debug(`Restored collection: ${collectionName}`, {
          documentCount: documents.length
        })
      }
    }

    // Update snapshot status to mark rollback
    const metadataCollection = snapshotDb.collection('snapshots')
    await metadataCollection.updateOne(
      { version: snapshot.version },
      { $set: { status: 'archived', reason: 'Manual rollback initiated' } }
    )

    logger.info('Snapshot restore completed', { version: snapshot.version })
    return true
  } catch (error) {
    logger.error(
      'Error restoring snapshot',
      error instanceof Error ? error : new Error(String(error)),
      { version: snapshot.version }
    )
    return false
  }
}

/**
 * Clean up old snapshots (keep last N versions)
 */
export async function cleanupOldSnapshots(
  client: MongoClient,
  dbName: string,
  keepVersions: number = 5
): Promise<void> {
  try {
    const snapshotDb = client.db(`${dbName}_snapshots`)
    const metadataCollection = snapshotDb.collection('snapshots')

    // Get all snapshots sorted by timestamp
    const allSnapshots = await metadataCollection
      .find({})
      .sort({ timestamp: -1 })
      .toArray()

    if (allSnapshots.length <= keepVersions) {
      logger.debug('No old snapshots to clean up')
      return
    }

    // Remove old snapshots
    const snapshotsToDelete = allSnapshots.slice(keepVersions)

    for (const snapshot of snapshotsToDelete) {
      // Delete snapshot collections
      for (const collectionName of snapshot.collections || []) {
        try {
          await snapshotDb
            .collection(`${collectionName}_${snapshot.version}`)
            .drop()
        } catch (e) {
          // Collection might not exist, that's ok
        }
      }

      // Delete metadata
      await metadataCollection.deleteOne({ _id: snapshot._id })

      logger.debug('Deleted old snapshot', { version: snapshot.version })
    }

    logger.info('Snapshot cleanup completed', {
      deletedCount: snapshotsToDelete.length
    })
  } catch (error) {
    logger.warn(
      'Error cleaning up old snapshots',
      error instanceof Error ? error : new Error(String(error))
    )
  }
}
