import { calculateObjectSize } from 'bson'
import cliProgress from 'cli-progress'
import type {
  AnyBulkWriteOperation,
  Collection,
  CreateIndexesOptions,
  Document,
  IndexDirection
} from 'mongodb'
import { MongoClient } from 'mongodb'
import { readFile } from 'node:fs/promises'
import Papa from 'papaparse'

import { transformOccurrenceRecord } from '@darwincore/transform'
import {
  AUXILIARY_COLLECTIONS,
  getRawCollection,
  getTransformedCollection
} from './config/collections'
import {
  getEml,
  processaEml,
  processaZip,
  type DbIpt,
  type Ipt
} from './lib/dwca'
import { buildOccurrenceDeterministicId } from './utils/deterministic-id'
import { IngestMetricsTracker } from './utils/metrics'

type IptSource = {
  nome: string
  repositorio: string
  kingdom: string
  tag: string
  url: string
}

type OccurrenceRecord = Document
type RawOccurrenceDocument = Document & { _id: string }
type OccurrenceBatchEntry = [string, OccurrenceRecord]
type OccurrenceBatch = OccurrenceBatchEntry[]

type RawDocMetadata = {
  ipt: Ipt
  source: IptSource
  ingestStartedAt: Date
  archiveUrl: string
}

const RAW_COLLECTION_NAME = getRawCollection('occurrences')
const TRANSFORMED_COLLECTION_NAME = getTransformedCollection('occurrences')
const METRICS_COLLECTION_NAME = AUXILIARY_COLLECTIONS.metrics
const DEFAULT_DB_NAME = process.env.MONGO_DB_NAME ?? 'dwc2json'
const BULK_MAX_OPERATIONS = 500
const BULK_MAX_BYTES = 12 * 1024 * 1024 // stay well below 16MB limit
const VERSION_CHECK_TIMEOUT_MS = 15_000
const ARCHIVE_CHUNK_SIZE = 5000
const CONCURRENCY_LIMIT = 10
const CSV_PATH = new URL('../referencias/occurrences.csv', import.meta.url)

const resolveRunnerId = () =>
  process.env.GITHUB_RUN_ID ??
  process.env.RUNNER_NAME ??
  process.env.RUN_ID ??
  process.env.HOSTNAME ??
  undefined

const resolveScriptVersion = () =>
  process.env.GITHUB_SHA ?? process.env.INGEST_VERSION ?? 'local-dev'

const shouldSkip404 = (error: unknown) =>
  error instanceof Error &&
  error.name === 'Http' &&
  (error.message.includes('404') ||
    error.message.includes('Not Found') ||
    error.message.includes('status 404'))

const isNetworkError = (error: Error) =>
  error.message.includes('timeout') ||
  error.message.includes('Connection') ||
  error.message.includes('ECONNRESET') ||
  error.message.includes('ENOTFOUND') ||
  error.message.includes('ECONNREFUSED') ||
  error.message.includes('AbortError')

const cloneRecord = (record: OccurrenceRecord): OccurrenceRecord => {
  if (typeof structuredClone === 'function') {
    return structuredClone(record)
  }
  return JSON.parse(JSON.stringify(record)) as OccurrenceRecord
}

const buildRawOccurrenceDocument = (
  raw: OccurrenceRecord,
  metadata: RawDocMetadata
): RawOccurrenceDocument => {
  const doc = cloneRecord(raw) as RawOccurrenceDocument

  const occurrenceID =
    typeof doc.occurrenceID === 'string' && doc.occurrenceID.trim().length > 0
      ? doc.occurrenceID.trim()
      : undefined

  const deterministicId = buildOccurrenceDeterministicId(
    {
      occurrenceID,
      catalogNumber: doc.catalogNumber as string | undefined,
      recordNumber: doc.recordNumber as string | undefined,
      eventDate: doc.eventDate as string | undefined,
      locality: doc.locality as string | undefined,
      recordedBy: doc.recordedBy as string | undefined
    },
    metadata.ipt.id
  )

  doc._id = deterministicId
  if (occurrenceID && !doc.occurrenceID) {
    doc.occurrenceID = occurrenceID
  }
  doc.iptId = metadata.ipt.id
  doc.ipt = metadata.source.repositorio
  doc.iptTag = metadata.source.tag
  doc.iptKingdom = metadata.source.kingdom
  doc.iptVersion = metadata.ipt.version
  doc.rawIngestedAt = metadata.ingestStartedAt
  doc.rawSourceUrl = metadata.archiveUrl

  return doc
}

type PendingBulkOperation<TSchema extends Document> = {
  operation: AnyBulkWriteOperation<TSchema>
  size: number
}

const executeBulkUpsert = async (
  collection: Collection<RawOccurrenceDocument>,
  operations: PendingBulkOperation<RawOccurrenceDocument>[],
  metrics: IngestMetricsTracker
) => {
  const chunk: PendingBulkOperation<RawOccurrenceDocument>[] = []
  let currentBytes = 0

  const flush = async () => {
    if (!chunk.length) {
      return
    }
    try {
      const result = await collection.bulkWrite(
        chunk.map((item) => item.operation),
        { ordered: false }
      )
      metrics.addInserted(result.upsertedCount ?? 0)
      metrics.addUpdated(result.modifiedCount ?? 0)
    } catch (error) {
      metrics.addError('bulkWrite')
      metrics.addFailed(chunk.length)
      throw error
    } finally {
      chunk.length = 0
      currentBytes = 0
    }
  }

  for (const pending of operations) {
    if (pending.size >= 15 * 1024 * 1024) {
      metrics.addError('docTooLarge')
      metrics.addFailed(1)
      continue
    }

    if (
      chunk.length >= BULK_MAX_OPERATIONS ||
      currentBytes + pending.size >= BULK_MAX_BYTES
    ) {
      await flush()
    }

    chunk.push(pending)
    currentBytes += pending.size
  }

  await flush()
}

const runWithConcurrency = async <T>(
  items: T[],
  limit: number,
  iterator: (item: T) => Promise<void>
) => {
  const executing: Promise<void>[] = []
  for (const item of items) {
    const task = Promise.resolve().then(() => iterator(item))
    executing.push(task)
    task.finally(() => {
      const index = executing.indexOf(task)
      if (index >= 0) {
        executing.splice(index, 1)
      }
    })
    if (executing.length >= limit) {
      await Promise.race(executing)
    }
  }
  await Promise.all(executing)
}

type PendingIpt = {
  index: number
  source: IptSource
  ipt: Ipt
  iptBaseUrl: string
}

type SimpleIndexDefinition = {
  key: Record<string, IndexDirection>
  name?: string
  options?: Omit<CreateIndexesOptions, 'name'>
}

const RAW_OCCURRENCE_INDEXES: SimpleIndexDefinition[] = [
  { key: { iptId: 1 }, name: 'iptId' },
  { key: { occurrenceID: 1 }, name: 'occurrenceID' },
  { key: { scientificName: 1 }, name: 'scientificName' }
]

const IPT_COLLECTION_INDEXES: SimpleIndexDefinition[] = [
  { key: { tag: 1 }, name: 'tag' },
  { key: { ipt: 1 }, name: 'ipt' }
]

const ensureIndexes = async <TSchema extends Document>(
  collection: Collection<TSchema>,
  indexes: ReadonlyArray<SimpleIndexDefinition>
) => {
  for (const index of indexes) {
    try {
      await collection.createIndex(index.key, {
        name: index.name,
        ...(index.options ?? {})
      })
    } catch (error) {
      const conflict =
        error instanceof Error && error.message.includes('already exists')
      if (!conflict) {
        console.warn('Failed to create index', index, error)
      }
    }
  }
}

const ingestIptOccurrences = async (
  client: MongoClient,
  rawCollection: Collection<RawOccurrenceDocument>,
  transformedCollection: Collection<Document>,
  metricsCollection: Collection<Document>,
  iptsCollection: Collection<DbIpt>,
  pending: PendingIpt,
  runnerId: string | undefined,
  scriptVersion: string,
  failedIpts: Set<string>
) => {
  const { source, ipt, iptBaseUrl } = pending
  const archiveUrl = `${source.url}archive.do?r=${source.tag}`

  const ingestStartedAt = new Date()
  const metrics = new IngestMetricsTracker({
    processType: 'ingest_occurrences',
    resourceIdentifier: ipt.id,
    runnerId,
    version: scriptVersion
  })

  try {
    console.debug(`Downloading ${source.repositorio}:${source.tag}`)
    const batches = (await processaZip(
      archiveUrl,
      true,
      ARCHIVE_CHUNK_SIZE
    ).catch((error) => {
      if (shouldSkip404(error)) {
        console.log(
          `Resource ${source.repositorio}:${source.tag} no longer exists (404) - skipping`
        )
        return null
      }

      if (error instanceof Error && isNetworkError(error)) {
        console.log(
          `IPT server ${iptBaseUrl} appears to be offline during archive download - marking for skip`
        )
        failedIpts.add(iptBaseUrl)
      }

      throw error
    })) as OccurrenceBatch[] | null

    if (!batches) {
      return
    }

    // Get total records before consuming the iterator
    const totalRecords = batches.length

    // Convert iterator to array to get accurate batch count
    const batchArray = Array.from(batches)
    const totalBatches = batchArray.length

    const progressBar = new cliProgress.SingleBar(
      {
        format:
          'Processing {bar} | {value}/{total} batches ({records} records) | ETA: {eta}s',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      },
      cliProgress.Presets.shades_classic
    )
    progressBar.start(totalBatches, 0, { records: totalRecords })

    let transformInserted = 0
    let transformUpdated = 0

    for (const batch of batchArray) {
      if (!batch || batch.length === 0) {
        progressBar.increment()
        continue
      }

      const operations: PendingBulkOperation<RawOccurrenceDocument>[] = []

      for (const entry of batch) {
        const raw = entry[1]
        metrics.addProcessed(1)

        try {
          const document = buildRawOccurrenceDocument(raw, {
            archiveUrl,
            ingestStartedAt,
            ipt,
            source
          })
          operations.push({
            operation: {
              replaceOne: {
                filter: { _id: document._id },
                replacement: document,
                upsert: true
              }
            },
            size: calculateObjectSize(document)
          })
        } catch (error) {
          metrics.addError('deterministicId')
          metrics.addFailed(1)
        }
      }

      if (operations.length > 0) {
        await executeBulkUpsert(rawCollection, operations, metrics)

        // INTEGRATED TRANSFORMATION: Transform and insert to occurrences collection inline
        const db = client.db(DEFAULT_DB_NAME)
        const transformOperations: AnyBulkWriteOperation<Document>[] = []

        for (const entry of batch) {
          const raw = entry[1]

          try {
            const rawDoc = buildRawOccurrenceDocument(raw, {
              archiveUrl,
              ingestStartedAt,
              ipt,
              source
            })

            const transformedDoc = await transformOccurrenceRecord(rawDoc, db)
            if (transformedDoc) {
              transformOperations.push({
                replaceOne: {
                  filter: { _id: transformedDoc._id } as any,
                  replacement: transformedDoc,
                  upsert: true
                }
              })
            }
          } catch (transformError) {
            // Log but continue - raw data is preserved
            console.warn(`Transform failed for occurrence:`, transformError)
            metrics.addError('transformFailure')
          }
        }

        if (transformOperations.length > 0) {
          try {
            const transformResult = await transformedCollection.bulkWrite(
              transformOperations,
              { ordered: false }
            )
            transformInserted += transformResult.upsertedCount ?? 0
            transformUpdated += transformResult.modifiedCount ?? 0
          } catch (transformError) {
            console.warn('Bulk transform write failed:', transformError)
            metrics.addError('transformBulkWrite', transformOperations.length)
          }
        }
      }

      progressBar.increment()
    }

    progressBar.stop()

    console.log(
      `${source.repositorio}:${source.tag} - TRANSFORM: inseridos=${transformInserted}, atualizados=${transformUpdated}`
    )

    const { id: _id, ...iptData } = ipt
    await iptsCollection.updateOne(
      { _id: ipt.id },
      {
        $set: {
          _id,
          ...iptData,
          ipt: source.repositorio,
          tag: source.tag,
          kingdom: source.kingdom,
          set: 'occurrences_raw',
          collection: RAW_COLLECTION_NAME,
          lastIngestedAt: ingestStartedAt,
          sourceUrl: source.url
        }
      },
      { upsert: true }
    )
  } catch (error) {
    metrics.addError('runtime')
    throw error
  } finally {
    const metricsDoc = metrics.buildDocument()
    await metricsCollection.insertOne(metricsDoc)
  }
}

const ingestOccurrences = async () => {
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) {
    throw new Error('MONGO_URI environment variable is required')
  }

  const csvContents = await readFile(CSV_PATH, 'utf-8')
  const { data: parsedSources } = Papa.parse<IptSource>(csvContents, {
    header: true
  })

  const iptSources = parsedSources.filter(
    (source) => source.repositorio && source.tag && source.url
  )

  const client = new MongoClient(mongoUri)
  let exitCode = 0

  try {
    await client.connect()
    const db = client.db(DEFAULT_DB_NAME)
    const rawCollection =
      db.collection<RawOccurrenceDocument>(RAW_COLLECTION_NAME)
    const transformedCollection = db.collection(TRANSFORMED_COLLECTION_NAME)
    const metricsCollection = db.collection(METRICS_COLLECTION_NAME)
    const iptsCollection = db.collection<DbIpt>('ipts')

    await ensureIndexes(rawCollection, RAW_OCCURRENCE_INDEXES)

    await ensureIndexes(iptsCollection, IPT_COLLECTION_INDEXES)

    const failedIpts = new Set<string>()
    const pendingProcessing: PendingIpt[] = []
    const runnerId = resolveRunnerId()
    const scriptVersion = resolveScriptVersion()

    await runWithConcurrency(
      iptSources.map((source, index) => ({ source, index })),
      CONCURRENCY_LIMIT,
      async ({ source, index }) => {
        const { repositorio, tag, url } = source
        if (!repositorio || !tag || !url) {
          return
        }

        const iptBaseUrl = (() => {
          try {
            const urlObj = new URL(url)
            return `${urlObj.protocol}//${urlObj.host}`
          } catch {
            return url
          }
        })()

        if (failedIpts.has(iptBaseUrl)) {
          console.log(
            `Skipping ${repositorio}:${tag} - IPT server ${iptBaseUrl} already failed`
          )
          return
        }

        const eml = await getEml(
          `${url}eml.do?r=${tag}`,
          VERSION_CHECK_TIMEOUT_MS
        ).catch((error) => {
          if (shouldSkip404(error)) {
            console.log(
              `EML resource ${repositorio}:${tag} no longer exists (404) - skipping`
            )
            return null
          }

          if (error instanceof Error && isNetworkError(error)) {
            console.log(
              `IPT server ${iptBaseUrl} appears offline during EML fetch - marking for skip`
            )
            failedIpts.add(iptBaseUrl)
          }

          console.log('Erro baixando/processando EML', error)
          return null
        })

        if (!eml) {
          return
        }

        const ipt = processaEml(eml)
        const existing = (await iptsCollection.findOne({
          _id: ipt.id
        })) as DbIpt | null

        if (existing?.version === ipt.version) {
          console.debug(
            `${repositorio}:${tag} already on version ${ipt.version}`
          )
          return
        }

        pendingProcessing.push({ index, source, ipt, iptBaseUrl })
      }
    )

    pendingProcessing.sort((a, b) => a.index - b.index)

    for (const pending of pendingProcessing) {
      try {
        await ingestIptOccurrences(
          client,
          rawCollection,
          transformedCollection,
          metricsCollection,
          iptsCollection,
          pending,
          runnerId,
          scriptVersion,
          failedIpts
        )
      } catch (error) {
        console.error(
          `Error occurred during processing of ${pending.source.repositorio}:${pending.source.tag}:`,
          error
        )
        exitCode = 1
      }
    }

    if (failedIpts.size > 0) {
      console.log(
        `\nSummary: ${failedIpts.size} IPT server(s) were offline and skipped:`
      )
      for (const item of failedIpts) {
        console.log(`  - ${item}`)
      }
    }

    if (!pendingProcessing.length) {
      console.log('No IPT resources required ingestion updates.')
    } else {
      console.log('Occurrence raw ingestion completed')
    }
  } finally {
    await client.close(true)
    process.exitCode = exitCode
  }
}

if (import.meta.main) {
  ingestOccurrences().catch((error) => {
    console.error('Occurrence ingestion failed', error)
    process.exitCode = 1
  })
}
