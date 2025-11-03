import { transformTaxonRecord } from '@darwincore/transform'
import type { AnyBulkWriteOperation, Document } from 'mongodb'
import { MongoClient } from 'mongodb'
import {
  AUXILIARY_COLLECTIONS,
  getRawCollection,
  getTransformedCollection
} from './config/collections'
import { type DbIpt, processaZip } from './lib/dwca'
import { buildTaxonDeterministicId } from './utils/deterministic-id'
import { IngestMetricsTracker } from './utils/metrics'

type RawTaxonDocument = Document & { _id: string }

const RAW_COLLECTION_NAME = getRawCollection('taxa')
const TRANSFORMED_COLLECTION_NAME = getTransformedCollection('taxa')
const METRICS_COLLECTION_NAME = AUXILIARY_COLLECTIONS.metrics
const BULK_BATCH_SIZE = 5000
const DEFAULT_DB_NAME = process.env.MONGO_DB_NAME ?? 'dwc2json'

// NOTE: Integrated transformation - ingest stores raw AND transformed data inline

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

const cloneRecord = (
  record: Record<string, unknown>
): Record<string, unknown> => {
  return typeof structuredClone === 'function'
    ? structuredClone(record)
    : JSON.parse(JSON.stringify(record))
}

const ingestFauna = async (url: string): Promise<void> => {
  const startTime = new Date()
  const { json, ipt } = await processaZip(url)

  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) {
    throw new Error('MONGO_URI environment variable is required')
  }

  const client = new MongoClient(mongoUri)
  await client.connect()

  const db = client.db(DEFAULT_DB_NAME)
  const rawCollection = db.collection<RawTaxonDocument>(RAW_COLLECTION_NAME)
  const transformedCollection = db.collection(TRANSFORMED_COLLECTION_NAME)
  const metricsCollection = db.collection(METRICS_COLLECTION_NAME)
  const iptsCollection = db.collection<DbIpt>('ipts')

  // Check if we already have this version
  const existing = (await iptsCollection.findOne({
    _id: ipt.id
  })) as DbIpt | null

  if (existing?.version === ipt.version) {
    console.log(`Fauna already on version ${ipt.version}, skipping ingestion`)
    await client.close()
    return
  }

  const metrics = new IngestMetricsTracker({
    processType: 'ingest_taxa',
    resourceIdentifier: ipt.id,
    runnerId: resolveRunnerId(),
    version: resolveScriptVersion()
  })

  const records = Object.values(json)
  metrics.addProcessed(records.length)

  let inserted = 0
  let updated = 0
  let transformInserted = 0
  let transformUpdated = 0
  let hadError = false

  try {
    for (let offset = 0; offset < records.length; offset += BULK_BATCH_SIZE) {
      const batch = records.slice(offset, offset + BULK_BATCH_SIZE)
      const operations: AnyBulkWriteOperation<RawTaxonDocument>[] = []

      for (const record of batch) {
        const taxonID = record.taxonID as string | undefined
        if (!taxonID) {
          metrics.addError('missingTaxonID')
          metrics.addFailed(1)
          continue
        }
        const _id = buildTaxonDeterministicId({ taxonID, source: 'fauna' })
        const rawDoc = cloneRecord(record) as RawTaxonDocument
        rawDoc._id = _id
        rawDoc.iptId = ipt.id
        rawDoc.iptVersion = ipt.version
        rawDoc.rawIngestedAt = startTime
        rawDoc.rawSource = 'fauna'
        operations.push({
          replaceOne: {
            filter: { _id },
            replacement: rawDoc,
            upsert: true
          }
        })
      }

      if (!operations.length) {
        continue
      }

      try {
        const result = await rawCollection.bulkWrite(operations, {
          ordered: false
        })
        inserted += result.upsertedCount ?? 0
        updated += result.modifiedCount ?? 0
        const failures =
          operations.length -
          ((result.upsertedCount ?? 0) + (result.matchedCount ?? 0))
        if (failures > 0) {
          metrics.addError('writeFailure', failures)
        }

        // INTEGRATED TRANSFORMATION: Transform and insert to taxa collection inline
        const transformOperations: AnyBulkWriteOperation<Document>[] = []
        for (const record of batch) {
          const taxonID = record.taxonID as string | undefined
          if (!taxonID) continue

          const _id = buildTaxonDeterministicId({ taxonID, source: 'fauna' })
          const rawDoc = cloneRecord(record) as RawTaxonDocument
          rawDoc._id = _id

          try {
            const transformedDoc = await transformTaxonRecord(rawDoc, db)
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
            console.warn(`Transform failed for ${_id}:`, transformError)
            metrics.addError('transformFailure')
          }
        }

        if (transformOperations.length > 0) {
          try {
            const transformResult = await transformedCollection.bulkWrite(
              transformOperations,
              {
                ordered: false
              }
            )
            transformInserted += transformResult.upsertedCount ?? 0
            transformUpdated += transformResult.modifiedCount ?? 0
          } catch (transformError) {
            console.warn('Bulk transform write failed:', transformError)
            metrics.addError('transformBulkWrite', transformOperations.length)
          }
        }
      } catch (error) {
        metrics.addError('bulkWrite', operations.length)
        throw error
      }
    }

    const { id: iptId, ...iptDetails } = ipt
    await iptsCollection.updateOne(
      { _id: iptId },
      {
        $set: {
          ...iptDetails,
          ipt: 'fauna',
          set: 'fauna',
          collection: RAW_COLLECTION_NAME,
          lastIngestedAt: startTime,
          sourceUrl: url
        }
      },
      { upsert: true }
    )
  } catch (error) {
    hadError = true
    metrics.addError('runtime')
    throw error
  } finally {
    metrics.addInserted(inserted)
    metrics.addUpdated(updated)

    const metricsDoc = metrics.buildDocument()
    await metricsCollection.insertOne(metricsDoc)
    await client.close()

    if (!hadError) {
      const skipped =
        metricsDoc.records_processed -
        (metricsDoc.records_inserted +
          metricsDoc.records_updated +
          metricsDoc.records_failed)
      console.log(
        `Fauna ingestão concluída:`,
        `RAW: processados=${metricsDoc.records_processed}, inseridos=${metricsDoc.records_inserted}, atualizados=${metricsDoc.records_updated}, falhas=${metricsDoc.records_failed}, inalterados=${skipped}`,
        `TRANSFORM: inseridos=${transformInserted}, atualizados=${transformUpdated}`
      )
    }
  }
}

async function main() {
  const [url] = process.argv.slice(2)
  if (!url) {
    console.error(
      'Usage: bun run --filter @darwincore/ingest fauna -- <dwc-a url>'
    )
    process.exit(1)
  }

  try {
    await ingestFauna(url)
  } catch (error) {
    if (shouldSkip404(error)) {
      console.log(`Fauna resource no longer exists (404) - exiting`)
      return
    }
    throw error
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Fauna ingestion failed', error)
    process.exitCode = 1
  })
}
