import { Collection, Document, InsertOneResult } from 'mongodb'
import type { TransformProcessType } from './concurrency'
import { getMongoDatabase } from './database'

export type TransformMetricsProcessType =
  | 'transform_taxa'
  | 'transform_occurrences'
  | 'ingest_taxa'
  | 'ingest_occurrences'

export interface ProcessMetricsDocument {
  process_type: TransformMetricsProcessType
  resource_identifier?: string
  started_at: Date
  completed_at: Date
  duration_seconds: number
  records_processed: number
  records_inserted: number
  records_updated: number
  records_failed: number
  error_summary: Record<string, number>
  runner_id?: string
  version?: string
  process_id?: string
}

export interface MetricsTrackerOptions {
  processType: TransformMetricsProcessType
  runnerId?: string
  resourceIdentifier?: string
  version?: string
  processId?: string
}

export interface MetricsSnapshot {
  processType: TransformMetricsProcessType
  resourceIdentifier?: string
  startedAt: Date
  counters: {
    processed: number
    inserted: number
    updated: number
    failed: number
  }
  errorSummary: Record<string, number>
  runnerId?: string
  version?: string
  processId?: string
}

const PROCESS_METRICS_COLLECTION = 'process_metrics'

async function getCollection(): Promise<Collection<ProcessMetricsDocument>> {
  const db = await getMongoDatabase()
  return db.collection<ProcessMetricsDocument>(PROCESS_METRICS_COLLECTION)
}

export class ProcessMetricsTracker {
  private readonly startedAt = new Date()
  private processed = 0
  private inserted = 0
  private updated = 0
  private failed = 0
  private readonly errorSummary = new Map<string, number>()
  private resourceIdentifier?: string
  private finished = false

  constructor(private readonly options: MetricsTrackerOptions) {
    this.resourceIdentifier = options.resourceIdentifier
  }

  addProcessed(count = 1): void {
    this.processed += count
  }

  addInserted(count = 1): void {
    this.inserted += count
  }

  addUpdated(count = 1): void {
    this.updated += count
  }

  addFailed(count = 1): void {
    this.failed += count
  }

  addError(key: string, count = 1): void {
    const current = this.errorSummary.get(key) ?? 0
    this.errorSummary.set(key, current + count)
  }

  setResourceIdentifier(identifier: string | undefined): void {
    this.resourceIdentifier = identifier
  }

  snapshot(): MetricsSnapshot {
    return {
      processType: this.options.processType,
      resourceIdentifier: this.resourceIdentifier,
      startedAt: this.startedAt,
      counters: {
        processed: this.processed,
        inserted: this.inserted,
        updated: this.updated,
        failed: this.failed
      },
      errorSummary: Object.fromEntries(this.errorSummary),
      runnerId: this.options.runnerId,
      version: this.options.version,
      processId: this.options.processId
    }
  }

  async finish(
    status: 'completed' | 'failed',
    error?: unknown
  ): Promise<InsertOneResult<ProcessMetricsDocument>> {
    if (this.finished) {
      throw new Error('ProcessMetricsTracker.finish called more than once.')
    }
    this.finished = true

    if (status === 'failed' && error) {
      this.addError('runtime', 1)
    }

    const completedAt = new Date()
    const durationSeconds = Math.max(
      0,
      (completedAt.getTime() - this.startedAt.getTime()) / 1000
    )
    const processed = Math.max(
      this.processed,
      this.inserted + this.updated + this.failed
    )

    const document: ProcessMetricsDocument = {
      process_type: this.options.processType,
      resource_identifier: this.resourceIdentifier,
      started_at: this.startedAt,
      completed_at: completedAt,
      duration_seconds: durationSeconds,
      records_processed: processed,
      records_inserted: this.inserted,
      records_updated: this.updated,
      records_failed: this.failed,
      error_summary: Object.fromEntries(this.errorSummary),
      runner_id: this.options.runnerId,
      version: this.options.version,
      process_id: this.options.processId
    }

    const collection = await getCollection()
    return collection.insertOne(document as ProcessMetricsDocument & Document)
  }
}

export function createTransformMetricsTracker(
  processType: Extract<
    TransformMetricsProcessType,
    'transform_taxa' | 'transform_occurrences'
  >,
  options: Omit<MetricsTrackerOptions, 'processType'> = {}
): ProcessMetricsTracker {
  return new ProcessMetricsTracker({
    processType,
    runnerId: options.runnerId,
    resourceIdentifier: options.resourceIdentifier,
    version: options.version,
    processId: options.processId
  })
}

export function createIngestMetricsTracker(
  processType: Extract<
    TransformMetricsProcessType,
    'ingest_taxa' | 'ingest_occurrences'
  >,
  options: Omit<MetricsTrackerOptions, 'processType'> = {}
): ProcessMetricsTracker {
  return new ProcessMetricsTracker({
    processType,
    runnerId: options.runnerId,
    resourceIdentifier: options.resourceIdentifier,
    version: options.version,
    processId: options.processId
  })
}

export function mergeTransformProcess(
  processType: TransformProcessType
): Extract<
  TransformMetricsProcessType,
  'transform_taxa' | 'transform_occurrences'
> {
  return processType === 'taxa' ? 'transform_taxa' : 'transform_occurrences'
}
