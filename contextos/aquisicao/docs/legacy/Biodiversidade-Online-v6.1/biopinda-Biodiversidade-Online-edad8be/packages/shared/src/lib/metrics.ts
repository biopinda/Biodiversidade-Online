import { Db } from 'mongodb'
import { PROCESS_METRICS_COLLECTION } from '../config/collections.js'

export interface ProcessMetrics {
  process_type:
    | 'ingest_taxa'
    | 'ingest_occurrences'
    | 'transform_taxa'
    | 'transform_occurrences'
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
}

/**
 * Registra métricas de processo no MongoDB
 */
export async function recordProcessMetrics(
  db: Db,
  metrics: Omit<ProcessMetrics, 'duration_seconds'>
): Promise<void> {
  const duration_seconds =
    (metrics.completed_at.getTime() - metrics.started_at.getTime()) / 1000

  const metricsDoc: ProcessMetrics = {
    ...metrics,
    duration_seconds
  }

  await db.collection(PROCESS_METRICS_COLLECTION).insertOne(metricsDoc)
}

/**
 * Helper para criar builder de métricas
 */
export class MetricsBuilder {
  private metrics: Partial<ProcessMetrics>

  constructor(
    processType: ProcessMetrics['process_type'],
    resourceIdentifier?: string
  ) {
    this.metrics = {
      process_type: processType,
      resource_identifier: resourceIdentifier,
      started_at: new Date(),
      records_processed: 0,
      records_inserted: 0,
      records_updated: 0,
      records_failed: 0,
      error_summary: {}
    }
  }

  incrementProcessed(count: number = 1): this {
    this.metrics.records_processed =
      (this.metrics.records_processed ?? 0) + count
    return this
  }

  incrementInserted(count: number = 1): this {
    this.metrics.records_inserted = (this.metrics.records_inserted ?? 0) + count
    return this
  }

  incrementUpdated(count: number = 1): this {
    this.metrics.records_updated = (this.metrics.records_updated ?? 0) + count
    return this
  }

  incrementFailed(count: number = 1): this {
    this.metrics.records_failed = (this.metrics.records_failed ?? 0) + count
    return this
  }

  addError(errorType: string, count: number = 1): this {
    const summary = this.metrics.error_summary ?? {}
    summary[errorType] = (summary[errorType] ?? 0) + count
    this.metrics.error_summary = summary
    return this
  }

  setVersion(version: string): this {
    this.metrics.version = version
    return this
  }

  setRunnerId(runnerId: string): this {
    this.metrics.runner_id = runnerId
    return this
  }

  async save(db: Db): Promise<void> {
    this.metrics.completed_at = new Date()
    await recordProcessMetrics(
      db,
      this.metrics as Omit<ProcessMetrics, 'duration_seconds'>
    )
  }
}
