import type { Collection, Filter, UpdateFilter } from 'mongodb'
import { randomUUID } from 'node:crypto'

import { getMongoDatabase } from './database'

export type TransformProcessType = 'taxa' | 'occurrences'
export type TransformLockStatus = 'running' | 'completed' | 'failed'

export interface TransformStatusDocument {
  process_type: TransformProcessType
  status: TransformLockStatus
  process_id: string
  runner_id?: string
  started_at: Date
  updated_at: Date
  ended_at?: Date
  error_message?: string
  forced?: boolean
  timeout_ms?: number
}

export interface AcquireTransformLockOptions {
  force?: boolean
  runnerId?: string
  timeoutMs?: number
  processId?: string
}

export interface ReleaseTransformLockOptions {
  status: Extract<TransformLockStatus, 'completed' | 'failed'>
  error?: unknown
}

export const TRANSFORM_STATUS_COLLECTION = 'transform_status'
export const DEFAULT_LOCK_TIMEOUT_MS = 1000 * 60 * 60 * 2 // 2 hours

export class TransformLockAcquisitionError extends Error {
  constructor(
    message: string,
    public readonly processType: TransformProcessType,
    public readonly activeLock?: TransformStatusDocument
  ) {
    super(message)
    this.name = 'TransformLockAcquisitionError'
  }
}

async function getCollection(): Promise<Collection<TransformStatusDocument>> {
  const db = await getMongoDatabase()
  return db.collection<TransformStatusDocument>(TRANSFORM_STATUS_COLLECTION)
}

export async function getTransformStatus(
  processType: TransformProcessType
): Promise<TransformStatusDocument | null> {
  const collection = await getCollection()
  return collection.findOne({ process_type: processType })
}

export async function acquireTransformLock(
  processType: TransformProcessType,
  options: AcquireTransformLockOptions = {}
): Promise<TransformStatusDocument> {
  const collection = await getCollection()
  const now = new Date()
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS
  const processId = options.processId ?? randomUUID()
  const graceDate = new Date(now.getTime() - timeoutMs)

  const filter: Filter<TransformStatusDocument> = options.force
    ? { process_type: processType }
    : {
        process_type: processType,
        $or: [
          { status: { $ne: 'running' as TransformLockStatus } },
          { updated_at: { $lte: graceDate } }
        ]
      }

  const update: UpdateFilter<TransformStatusDocument> = {
    $set: {
      process_type: processType,
      status: 'running' as TransformLockStatus,
      process_id: processId,
      runner_id: options.runnerId,
      started_at: now,
      updated_at: now,
      forced: options.force ?? false,
      timeout_ms: timeoutMs
    },
    $unset: {
      error_message: true,
      ended_at: true
    }
  }

  const lockDocument = await collection.findOneAndUpdate(filter, update, {
    upsert: true,
    returnDocument: 'after'
  })

  if (!lockDocument) {
    const activeLock = await collection.findOne({ process_type: processType })
    throw new TransformLockAcquisitionError(
      `Transform process '${processType}' is already running.`,
      processType,
      activeLock ?? undefined
    )
  }

  return lockDocument
}

export async function refreshTransformLock(
  processType: TransformProcessType,
  processId: string
): Promise<TransformStatusDocument | null> {
  const collection = await getCollection()
  const lockDocument = await collection.findOneAndUpdate(
    { process_type: processType, process_id: processId },
    { $set: { updated_at: new Date() } },
    { returnDocument: 'after' }
  )
  return lockDocument
}

export async function releaseTransformLock(
  processType: TransformProcessType,
  processId: string,
  options: ReleaseTransformLockOptions
): Promise<TransformStatusDocument | null> {
  const collection = await getCollection()
  const now = new Date()
  const update: UpdateFilter<TransformStatusDocument> = {
    $set: {
      status: options.status,
      updated_at: now,
      ended_at: now,
      ...(options.status === 'failed' && options.error
        ? {
            error_message:
              options.error instanceof Error
                ? options.error.message
                : String(options.error)
          }
        : {})
    }
  }

  if (options.status === 'completed') {
    update.$unset = { forced: true }
  }

  const lockDocument = await collection.findOneAndUpdate(
    { process_type: processType, process_id: processId },
    update,
    { returnDocument: 'after' }
  )

  return lockDocument
}

export async function forceReleaseTransformLock(
  processType: TransformProcessType,
  reason: string
): Promise<TransformStatusDocument | null> {
  const collection = await getCollection()
  const now = new Date()
  const lockDocument = await collection.findOneAndUpdate(
    { process_type: processType },
    {
      $set: {
        status: 'failed' as TransformLockStatus,
        error_message: reason,
        updated_at: now,
        ended_at: now,
        process_id: randomUUID(),
        forced: true
      }
    },
    { returnDocument: 'after' }
  )
  return lockDocument
}

export async function withTransformLock<T>(
  processType: TransformProcessType,
  handler: (status: TransformStatusDocument) => Promise<T>,
  options: AcquireTransformLockOptions = {}
): Promise<T> {
  const lock = await acquireTransformLock(processType, options)
  try {
    const result = await handler(lock)
    await releaseTransformLock(processType, lock.process_id, {
      status: 'completed'
    })
    return result
  } catch (error) {
    await releaseTransformLock(processType, lock.process_id, {
      status: 'failed',
      error
    })
    throw error
  }
}
