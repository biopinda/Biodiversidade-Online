export type IngestMetricsProcessType = 'ingest_taxa' | 'ingest_occurrences'

export interface IngestMetricsOptions {
  processType: IngestMetricsProcessType
  resourceIdentifier?: string
  runnerId?: string
  version?: string
}

export interface IngestMetricsDocument {
  process_type: IngestMetricsProcessType
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

export class IngestMetricsTracker {
  private readonly startedAt = new Date()
  private processed = 0
  private inserted = 0
  private updated = 0
  private failed = 0
  private readonly errorSummary = new Map<string, number>()
  private resourceIdentifier?: string

  constructor(private readonly options: IngestMetricsOptions) {
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
    this.addFailed(count)
  }

  setResourceIdentifier(identifier: string | undefined): void {
    this.resourceIdentifier = identifier
  }

  snapshot(): IngestMetricsDocument {
    const completedAt = new Date()
    return {
      process_type: this.options.processType,
      resource_identifier: this.resourceIdentifier,
      started_at: this.startedAt,
      completed_at: completedAt,
      duration_seconds: Math.max(
        0,
        (completedAt.getTime() - this.startedAt.getTime()) / 1000
      ),
      records_processed: this.processed,
      records_inserted: this.inserted,
      records_updated: this.updated,
      records_failed: this.failed,
      error_summary: Object.fromEntries(this.errorSummary),
      runner_id: this.options.runnerId,
      version: this.options.version
    }
  }

  buildDocument(completedAt = new Date()): IngestMetricsDocument {
    return {
      process_type: this.options.processType,
      resource_identifier: this.resourceIdentifier,
      started_at: this.startedAt,
      completed_at: completedAt,
      duration_seconds: Math.max(
        0,
        (completedAt.getTime() - this.startedAt.getTime()) / 1000
      ),
      records_processed: this.processed,
      records_inserted: this.inserted,
      records_updated: this.updated,
      records_failed: this.failed,
      error_summary: Object.fromEntries(this.errorSummary),
      runner_id: this.options.runnerId,
      version: this.options.version
    }
  }
}
