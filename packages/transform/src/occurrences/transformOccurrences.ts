import { calculateObjectSize } from 'bson'
import cliProgress from 'cli-progress'
import type { AnyBulkWriteOperation, Collection, Filter } from 'mongodb'
import type { TransformPipelineHandler } from '../cli/runTransform'
import { getMongoDatabase } from '../lib/database'
import { executeTransformPipeline } from '../lib/orchestrator'
import {
  createOccurrenceEnrichmentContext,
  enrichOccurrence
} from './enrichOccurrence'
import type {
  NormalizedOccurrenceDocument,
  RawOccurrenceDocument
} from './normalizeOccurrence'
import { occurrenceNormalizationPipeline } from './transforms/pipeline'

const RAW_COLLECTION = 'occurrences_ipt'
const TARGET_COLLECTION = 'occurrences'
const MAX_BULK_OPERATIONS = 5000 // Increased from 2000
const MAX_BULK_BYTES = 12 * 1024 * 1024
const HARD_DOC_SIZE_LIMIT = 15 * 1024 * 1024
const DEFAULT_BATCH_SIZE = 10000 // Increased from 5000
const PARALLEL_BATCH_SIZE = 1000 // Increased now that enrichment is fast in-memory

interface BulkState<TSchema extends { _id: string }> {
  operations: Array<AnyBulkWriteOperation<TSchema>>
  currentBytes: number
}

function createBulkState<
  TSchema extends { _id: string }
>(): BulkState<TSchema> {
  return {
    operations: [],
    currentBytes: 0
  }
}

async function flushBulk<TSchema extends { _id: string }>(
  state: BulkState<TSchema>,
  collection: Collection<TSchema>,
  metrics: {
    addInserted: (count?: number) => void
    addUpdated: (count?: number) => void
    addError: (key: string, count?: number) => void
  },
  logger: { warn(message: string, ...details: unknown[]): void },
  dryRun: boolean
): Promise<{ inserted: number; updated: number }> {
  if (!state.operations.length) {
    return { inserted: 0, updated: 0 }
  }

  if (dryRun) {
    state.operations.length = 0
    state.currentBytes = 0
    return { inserted: 0, updated: 0 }
  }

  try {
    const result = await collection.bulkWrite(state.operations, {
      ordered: false
    })
    const insertedCount = result.upsertedCount ?? 0
    const updatedCount = result.modifiedCount ?? 0
    if (insertedCount) metrics.addInserted(insertedCount)
    if (updatedCount) metrics.addUpdated(updatedCount)
    return { inserted: insertedCount, updated: updatedCount }
  } catch (error) {
    logger.warn('Falha ao executar bulkWrite em occurrences', error)
    metrics.addError('bulkWrite')
    throw error
  } finally {
    state.operations.length = 0
    state.currentBytes = 0
  }
}

function prepareUpsertOperation<TSchema extends { _id: string }>(
  document: TSchema
): AnyBulkWriteOperation<TSchema> {
  const filter = { _id: document._id } as Filter<TSchema>
  return {
    updateOne: {
      filter,
      update: { $set: document },
      upsert: true
    }
  }
}

export async function createOccurrencesTransformHandler(): Promise<TransformPipelineHandler> {
  const db = await getMongoDatabase()
  const rawCollection = db.collection<RawOccurrenceDocument>(RAW_COLLECTION)
  const targetCollection =
    db.collection<NormalizedOccurrenceDocument>(TARGET_COLLECTION)

  return async ({ metrics, logger, options }) => {
    const enrichmentContext = await createOccurrenceEnrichmentContext(
      db,
      logger
    )

    const version = options.version ?? 'unknown'

    // Ensure index exists for efficient queries
    await targetCollection.createIndex(
      { _id: 1, _transformVersion: 1 },
      { background: true }
    )

    // Get total count
    const totalCount = await rawCollection.countDocuments({})
    logger.info(`Total de ocorrências a verificar: ${totalCount}`)

    // Fast check: count already transformed
    const alreadyTransformedCount = await targetCollection.countDocuments({
      _transformVersion: version
    })

    logger.info(
      `${alreadyTransformedCount} ocorrências já transformadas (serão ignoradas)`
    )

    const documentsToProcess = totalCount - alreadyTransformedCount

    if (documentsToProcess === 0) {
      logger.info('Nenhuma ocorrência para processar. Finalizando.')
      return {
        processed: 0,
        inserted: 0,
        updated: 0,
        failed: 0
      }
    }

    // Build Set of already-transformed IDs for O(1) lookup during iteration
    // We use a cursor to avoid the 16MB BSON limit of distinct()
    logger.info('Carregando IDs já transformados...')
    const startLoadTime = Date.now()
    const alreadyTransformedIds = new Set<string>()
    const idCursor = targetCollection.find(
      { _transformVersion: version },
      { projection: { _id: 1 } }
    )
    for await (const doc of idCursor) {
      alreadyTransformedIds.add(doc._id)
    }
    const loadTime = ((Date.now() - startLoadTime) / 1000).toFixed(2)
    logger.info(
      `IDs carregados em ${loadTime}s (${alreadyTransformedIds.size} IDs)`
    )

    logger.info(`~${documentsToProcess} ocorrências necessitam transformação`)

    // Create progress bar
    const progressBar = new cliProgress.SingleBar(
      {
        format:
          'Occurrence Transform |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s | Velocidade: {speed} docs/s',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      },
      cliProgress.Presets.shades_classic
    )

    if (!options.dryRun) {
      progressBar.start(documentsToProcess, 0, { speed: 0 })
    }

    const startTime = Date.now()

    const cursor = rawCollection
      .find({})
      .addCursorFlag('noCursorTimeout', true)
      .batchSize(50000) // Increased batch size for better I/O performance

    const bulkState = createBulkState<NormalizedOccurrenceDocument>()
    let processed = 0
    let inserted = 0
    let updated = 0
    let failed = 0

    // Process documents in batches, skipping already-transformed ones
    let batch: RawOccurrenceDocument[] = []

    for await (const raw of cursor) {
      // Skip if already transformed (O(1) lookup in Set)
      if (alreadyTransformedIds.has(raw._id)) {
        continue
      }

      batch.push(raw)

      if (batch.length >= PARALLEL_BATCH_SIZE) {
        await processOccurrenceBatch(
          batch,
          bulkState,
          targetCollection,
          enrichmentContext,
          version,
          {
            processed: () => processed++,
            inserted: (n: number) => (inserted += n),
            updated: (n: number) => (updated += n),
            failed: () => failed++
          },
          metrics,
          logger,
          options
        )

        if (!options.dryRun) {
          const elapsed = (Date.now() - startTime) / 1000
          const speed = processed / elapsed
          progressBar.update(processed, { speed: speed.toFixed(0) })
        }

        batch = []
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      await processOccurrenceBatch(
        batch,
        bulkState,
        targetCollection,
        enrichmentContext,
        version,
        {
          processed: () => processed++,
          inserted: (n: number) => (inserted += n),
          updated: (n: number) => (updated += n),
          failed: () => failed++
        },
        metrics,
        logger,
        options
      )
    }

    const result = await flushBulk(
      bulkState,
      targetCollection,
      metrics,
      logger,
      Boolean(options.dryRun)
    )
    inserted += result.inserted
    updated += result.updated

    if (!options.dryRun) {
      progressBar.update(documentsToProcess)
      progressBar.stop()
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)
    logger.info(
      `Transform concluído em ${totalTime}s | Velocidade média: ${(processed / Number(totalTime)).toFixed(0)} docs/s`
    )
    logger.info(
      `Estatísticas: processados=${processed}, inseridos=${inserted}, atualizados=${updated}, falhas=${failed}`
    )

    return {
      processed,
      inserted,
      updated,
      failed
    }
  }
}

async function processOccurrenceBatch(
  batch: RawOccurrenceDocument[],
  bulkState: BulkState<NormalizedOccurrenceDocument>,
  targetCollection: Collection<NormalizedOccurrenceDocument>,
  enrichmentContext: Awaited<
    ReturnType<typeof createOccurrenceEnrichmentContext>
  >,
  version: string,
  counters: {
    processed: () => void
    inserted: (n: number) => void
    updated: (n: number) => void
    failed: () => void
  },
  metrics: {
    addProcessed: () => void
    addFailed: () => void
    addError: (key: string) => void
    addInserted: (count?: number) => void
    addUpdated: (count?: number) => void
  },
  logger: { warn(message: string, ...details: unknown[]): void },
  options: { dryRun?: boolean }
): Promise<void> {
  // Process all documents in the batch in parallel
  const results = await Promise.all(
    batch.map(async (raw) => {
      counters.processed()
      metrics.addProcessed()

      const result = await executeTransformPipeline(
        occurrenceNormalizationPipeline,
        raw
      )
      if (!result.success || !result.document) {
        counters.failed()
        metrics.addFailed()
        if (result.failedAt) {
          metrics.addError(`normalization:${result.failedAt}`)
        } else {
          metrics.addError('normalization')
        }
        if (result.error) {
          logger.warn(
            'Erro durante normalização de ocorrência',
            result.failedAt,
            result.error
          )
        }
        return null
      }

      const document = result.document

      document._transformedAt = new Date()
      document._transformVersion = version

      try {
        const enrichment = await enrichOccurrence(document, enrichmentContext)
        if (!enrichment.taxonMatched) {
          metrics.addError('taxonLookup')
        }
        if (
          enrichment.parsingStatus &&
          enrichment.parsingStatus !== 'success'
        ) {
          metrics.addError('collectorParsing')
        }
      } catch (error) {
        logger.warn('Falha ao enriquecer ocorrência', document._id, error)
        counters.failed()
        metrics.addFailed()
        metrics.addError('enrichment')
        return null
      }

      const docSize = calculateObjectSize(document)
      if (docSize >= HARD_DOC_SIZE_LIMIT) {
        logger.warn(
          'Documento de ocorrência excede limite de tamanho e será ignorado',
          {
            _id: document._id,
            size: docSize
          }
        )
        counters.failed()
        metrics.addFailed()
        metrics.addError('docTooLarge')
        return null
      }

      return { document, docSize }
    })
  )

  // Add all successful results to bulk operations
  for (const result of results) {
    if (!result) continue

    bulkState.operations.push(prepareUpsertOperation(result.document))
    bulkState.currentBytes += result.docSize

    if (
      bulkState.operations.length >= MAX_BULK_OPERATIONS ||
      bulkState.currentBytes >= MAX_BULK_BYTES
    ) {
      const flushResult = await flushBulk(
        bulkState,
        targetCollection,
        metrics,
        logger,
        Boolean(options.dryRun)
      )
      counters.inserted(flushResult.inserted)
      counters.updated(flushResult.updated)
    }
  }
}
