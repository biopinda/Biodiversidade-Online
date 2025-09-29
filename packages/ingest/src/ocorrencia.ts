import { calculateObjectSize } from 'bson'
import cliProgress from 'cli-progress'
import { MongoClient } from 'mongodb'
import { readFile } from 'node:fs/promises'
import Papa from 'papaparse'

import {
  getEml,
  processaEml,
  processaZip,
  type DbIpt,
  type Ipt
} from './lib/dwca.ts'

// Import normalization utilities
import {
  normalizeCountryName,
  normalizeStateName
} from './lib/normalization.js'

// Import data preservation system
import {
  initializeDataPreserver,
  preserveOriginalData,
  saveTransformedWithReference
} from './lib/preservador-dados-originais.ts'

/**
 * Utility function to convert string fields to numbers with validation
 * Keeps invalid values as original strings for backward compatibility
 */
function tryConvertToNumber(
  obj: Record<string, any>,
  propName: string,
  validator?: (num: number) => boolean
): void {
  if (obj[propName] && typeof obj[propName] === 'string') {
    const numValue = parseInt(obj[propName], 10)
    if (!isNaN(numValue) && (!validator || validator(numValue))) {
      obj[propName] = numValue
    }
    // Invalid values remain as original strings
  }
}

type InsertManyParams = Parameters<typeof ocorrenciasCol.insertMany>
async function safeInsertMany(
  collection: typeof ocorrenciasCol,
  docs: InsertManyParams[0],
  options?: InsertManyParams[1]
): ReturnType<typeof iptsCol.insertMany> {
  let chunkSize = docs.length
  while (true) {
    try {
      const chunks: (typeof docs)[] = []
      for (let i = 0; i < docs.length; i += chunkSize) {
        chunks.push(docs.slice(i, i + chunkSize))
      }
      const returns: Awaited<ReturnType<typeof ocorrenciasCol.insertMany>>[] =
        []
      for (const chunk of chunks) {
        if (calculateObjectSize(chunk) > 16 * 1024 * 1024) {
          throw new Error('Chunk size exceeds the BSON document size limit')
        }
        returns.push(await collection.insertMany(chunk, options))
      }
      return returns.reduce((acc, cur) => ({
        acknowledged: acc.acknowledged && cur.acknowledged,
        insertedCount: acc.insertedCount + cur.insertedCount,
        insertedIds: { ...acc.insertedIds, ...cur.insertedIds }
      }))
    } catch (_e) {
      chunkSize = Math.floor(chunkSize / 2)
      console.log(
        `Can't insert chunk of ${docs.length} documents, trying with ${chunkSize}`
      )
      continue
    }
  }
}

function isNetworkError(error: Error): boolean {
  return (
    error.message.includes('timeout') ||
    error.message.includes('Connection') ||
    error.message.includes('ECONNRESET') ||
    error.message.includes('ENOTFOUND') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('AbortError')
  )
}

type IptSource = {
  nome: string
  repositorio: string
  kingdom: 'Animalia' | 'Plantae' | 'Fungi'
  tag: string
  url: string
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  iterator: (item: T) => Promise<void>
) {
  // Simple promise pool to avoid overwhelming IPT servers during version checks
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
const csvContents = await readFile(
  new URL('../referencias/occurrences.csv', import.meta.url),
  'utf-8'
)
const { data: iptSources } = Papa.parse<IptSource>(csvContents, {
  header: true
})

const VERSION_CHECK_TIMEOUT_MS = 10_000

const mongoUri = process.env.MONGO_URI
if (!mongoUri) {
  console.error('MONGO_URI environment variable is required')
  process.exit(1)
}
const client = new MongoClient(mongoUri)
await client.connect()
const iptsCol = client.db('dwc2json').collection<DbIpt>('ipts')
const ocorrenciasCol = client.db('dwc2json').collection('ocorrencias')

// Initialize preservation system (optional for now)
let preservador: any = null
try {
  preservador = await initializeDataPreserver(mongoUri)
  console.debug('Data preservation system initialized')
} catch (error) {
  console.warn(
    'Failed to initialize preservation system:',
    (error as Error).message
  )
}

console.log('Connecting to MongoDB...')
let exitCode = 0
try {
  console.log('Creating indexes')

  const createIndexSafely = async (collection: any, indexes: any[]) => {
    for (const index of indexes) {
      try {
        await collection.createIndex(index.key, { name: index.name })
      } catch (error: any) {
        if (error.code === 85) {
          console.log(
            `Index ${index.name} already exists with different options, skipping`
          )
        } else {
          throw error
        }
      }
    }
  }

  await Promise.all([
    createIndexSafely(ocorrenciasCol, [
      { key: { scientificName: 1 }, name: 'scientificName' },
      { key: { iptId: 1 }, name: 'iptId' },
      { key: { ipt: 1 }, name: 'ipt' },
      { key: { canonicalName: 1 }, name: 'canonicalName' },
      { key: { flatScientificName: 1 }, name: 'flatScientificName' },
      { key: { iptKingdoms: 1 }, name: 'iptKingdoms' },
      { key: { year: 1 }, name: 'year' },
      { key: { month: 1 }, name: 'month' },
      { key: { eventDate: 1 }, name: 'eventDate' },
      // Basic field indexes
      { key: { country: 1 }, name: 'country' },
      { key: { stateProvince: 1 }, name: 'stateProvince' },
      { key: { genus: 1 }, name: 'genus' },
      { key: { specificEpithet: 1 }, name: 'specificEpithet' },
      { key: { kingdom: 1 }, name: 'kingdom' },
      { key: { family: 1 }, name: 'family' },
      { key: { recordedBy: 1 }, name: 'recordedBy' },
      { key: { recordNumber: 1 }, name: 'recordNumber' },
      { key: { locality: 1 }, name: 'locality' },
      { key: { tag: 1 }, name: 'tag' },
      { key: { phylum: 1 }, name: 'phylum' },
      { key: { class: 1 }, name: 'class' },
      { key: { order: 1 }, name: 'order' },
      // Compound indexes for performance optimization
      {
        key: { country: 1, stateProvince: 1 },
        name: 'country_stateProvince_compound'
      },
      {
        key: { genus: 1, specificEpithet: 1 },
        name: 'genus_specificEpithet_compound'
      },
      { key: { kingdom: 1, country: 1 }, name: 'kingdom_country_compound' },
      {
        key: { kingdom: 1, stateProvince: 1 },
        name: 'kingdom_stateProvince_index'
      },
      { key: { kingdom: 1, family: 1 }, name: 'kingdom_family_index' },
      // Geospatial index
      { key: { geoPoint: '2dsphere' }, name: 'geoPoint_2dsphere' },
      // Complex taxonomy index
      {
        key: {
          stateProvince: 1,
          kingdom: 1,
          phylum: 1,
          class: 1,
          order: 1,
          family: 1,
          genus: 1,
          specificEpithet: 1
        },
        name: 'idx_taxonomy_state'
      }
    ]),
    createIndexSafely(iptsCol, [
      { key: { tag: 1 }, name: 'tag' },
      { key: { ipt: 1 }, name: 'ipt' }
    ])
  ])

  console.log('Indexes created successfully')

  // Track failed IPT servers to skip resources from same server
  const failedIpts = new Set<string>()

  // Extract base URL from IPT URL for grouping
  const getIptBaseUrl = (url: string) => {
    try {
      const urlObj = new URL(url)
      return `${urlObj.protocol}//${urlObj.host}`
    } catch {
      return url
    }
  }

  const pendingProcessing: {
    index: number
    source: IptSource
    ipt: Ipt
    iptBaseUrl: string
  }[] = []

  await runWithConcurrency(
    iptSources.map((source: IptSource, index: number) => ({ source, index })),
    10,
    async ({ source, index }: { source: IptSource; index: number }) => {
      const { repositorio, kingdom, tag, url } = source
      if (!repositorio || !tag) {
        return
      }

      const iptBaseUrl = getIptBaseUrl(url)
      if (failedIpts.has(iptBaseUrl)) {
        console.log(
          `Skipping ${repositorio}:${tag} - IPT server ${iptBaseUrl} already failed`
        )
        return
      }

      console.debug(`Processing ${repositorio}:${tag}\n${url}eml.do?r=${tag}`)
      const eml = await getEml(
        `${url}eml.do?r=${tag}`,
        VERSION_CHECK_TIMEOUT_MS
      ).catch((error) => {
        if (
          error.name === 'Http' &&
          (error.message.includes('404') ||
            error.message.includes('Not Found') ||
            error.message.includes('status 404'))
        ) {
          console.log(
            `EML resource ${repositorio}:${tag} no longer exists (404) - skipping`
          )
          return null
        }

        if (isNetworkError(error)) {
          console.log(
            `IPT server ${iptBaseUrl} appears to be offline - marking for skip`
          )
          failedIpts.add(iptBaseUrl)
        }

        console.log('Erro baixando/processando eml', error.message)
        return null
      })

      if (!eml) {
        return
      }

      const ipt = processaEml(eml)
      const dbVersion = (
        (await iptsCol.findOne({ _id: ipt.id })) as DbIpt | null
      )?.version

      if (dbVersion === ipt.version) {
        console.debug(`${repositorio}:${tag} already on version ${ipt.version}`)
        return
      }

      console.log(
        `Version mismatch: DB[${dbVersion}] vs REMOTE[${ipt.version}]`
      )
      pendingProcessing.push({ index, source, ipt, iptBaseUrl })
    }
  )

  pendingProcessing.sort((a, b) => a.index - b.index)

  for (const { source, ipt, iptBaseUrl } of pendingProcessing) {
    const { repositorio, kingdom, tag, url } = source

    if (failedIpts.has(iptBaseUrl)) {
      console.log(
        `Skipping ${repositorio}:${tag} - IPT server ${iptBaseUrl} already failed`
      )
      continue
    }

    console.debug(
      `Downloading ${repositorio}:${tag} [${url}archive.do?r=${tag}]`
    )
    const ocorrencias = await processaZip(
      `${url}archive.do?r=${tag}`,
      true,
      5000
    ).catch((error) => {
      if (error.name === 'Http' && error.message.includes('404')) {
        console.log(
          `Resource ${repositorio}:${tag} no longer exists (404) - skipping`
        )
        return null
      }

      if (isNetworkError(error)) {
        console.log(
          `IPT server ${iptBaseUrl} appears to be offline during archive download - marking for skip`
        )
        failedIpts.add(iptBaseUrl)
      }

      throw error
    })

    if (!ocorrencias) {
      continue
    }

    // Step 1: Preserve original data (if preservation system is available)
    if (preservador) {
      try {
        console.debug(`Preserving original data for ${repositorio}:${tag}`)

        // Convert array-based format to object format for preservation
        const ocorrenciasJson: Record<string, any> = {}
        let recordIndex = 0
        for (const batch of ocorrencias) {
          if (!batch || !batch.length) continue
          for (const ocorrencia of batch) {
            if (ocorrencia && ocorrencia[1]) {
              ocorrenciasJson[`${ipt.id}_${recordIndex++}`] = ocorrencia[1]
            }
          }
        }

        const preservationResult = await preserveOriginalData(
          ocorrenciasJson,
          ipt,
          'ocorrencias',
          { batch_size: 5000 }
        )

        if (
          preservationResult.status === 'success' ||
          preservationResult.status === 'partial'
        ) {
          console.log(
            `Preserved ${preservationResult.documents_preserved} original documents for ${repositorio}:${tag}`
          )
          if (preservationResult.failed_documents > 0) {
            console.warn(
              `Failed to preserve ${preservationResult.failed_documents} documents`
            )
          }
        } else {
          console.warn(
            `Failed to preserve original data for ${repositorio}:${tag}, continuing with transformation only`
          )
        }
      } catch (error) {
        console.warn(
          `Preservation failed for ${repositorio}:${tag}, continuing with legacy approach:`,
          (error as Error).message
        )
      }
    }

    // Step 2: Legacy processing approach (maintain compatibility)
    console.debug(`Cleaning ${repositorio}:${tag}`)
    console.log(
      `Deleted ${
        (await ocorrenciasCol.deleteMany({ iptId: ipt.id })).deletedCount
      } entries`
    )
    const bar = new cliProgress.SingleBar(
      {},
      cliProgress.Presets.shades_classic
    )
    bar.start(ocorrencias.length, 0)
    for (const batch of ocorrencias) {
      if (!batch || !batch.length) {
        break
      }
      bar.increment(batch.length - Math.floor(batch.length / 4))
      await safeInsertMany(
        ocorrenciasCol,
        batch.map((ocorrencia) => {
          if (ocorrencia[1].decimalLatitude && ocorrencia[1].decimalLongitude) {
            const latitude = +ocorrencia[1].decimalLatitude
            const longitude = +ocorrencia[1].decimalLongitude
            if (
              !isNaN(latitude) &&
              !isNaN(longitude) &&
              latitude >= -90 &&
              latitude <= 90 &&
              longitude >= -180 &&
              longitude <= 180
            ) {
              ocorrencia[1].geoPoint = {
                type: 'Point',
                coordinates: [longitude, latitude]
              }
            }
          }
          const canonicalName = [
            ocorrencia[1].genus,
            ocorrencia[1].genericName,
            ocorrencia[1].subgenus,
            ocorrencia[1].infragenericEpithet,
            ocorrencia[1].specificEpithet,
            ocorrencia[1].infraspecificEpithet,
            ocorrencia[1].cultivarEpiteth
          ]
            .filter(Boolean)
            .join(' ')
          const iptKingdoms = kingdom.split(/, ?/)

          const processedData = { ...ocorrencia[1] }
          tryConvertToNumber(processedData, 'year', (num) => num > 0)
          tryConvertToNumber(
            processedData,
            'month',
            (num) => num >= 1 && num <= 12
          )
          tryConvertToNumber(
            processedData,
            'day',
            (num) => num >= 1 && num <= 31
          )

          // Normalize country and stateProvince for Brazilian data
          if (processedData.country) {
            const normalizedCountry = normalizeCountryName(
              processedData.country
            )
            if (normalizedCountry) {
              processedData.country = normalizedCountry
            }
          }

          if (processedData.stateProvince) {
            const normalizedState = normalizeStateName(
              processedData.stateProvince
            )
            if (normalizedState) {
              processedData.stateProvince = normalizedState
            }
          }

          if (
            processedData.eventDate &&
            typeof processedData.eventDate === 'string'
          ) {
            try {
              const eventDateObj = new Date(processedData.eventDate)
              if (
                !isNaN(eventDateObj.getTime()) &&
                eventDateObj.toString() !== 'Invalid Date'
              ) {
                if (!processedData.year || isNaN(Number(processedData.year))) {
                  processedData.year = eventDateObj.getFullYear()
                }
                if (
                  !processedData.month ||
                  isNaN(Number(processedData.month))
                ) {
                  processedData.month = eventDateObj.getMonth() + 1
                }
                if (!processedData.day || isNaN(Number(processedData.day))) {
                  processedData.day = eventDateObj.getDate()
                }
                processedData.eventDate = eventDateObj
              }
            } catch (_error) {
              // If parsing fails, keep as original string
            }
          }

          return {
            iptId: ipt.id,
            ipt: repositorio,
            canonicalName,
            iptKingdoms,
            flatScientificName: (
              (ocorrencia[1].scientificName as string) ?? canonicalName
            )
              .replace(/[^a-zA-Z0-9]/g, '')
              .toLocaleLowerCase(),
            ...processedData
          }
        }),
        {
          ordered: false
        }
      )
      bar.increment(Math.floor(batch.length / 4))
    }
    bar.stop()
    console.debug(`Inserting IPT ${repositorio}:${tag}`)
    const { id: _id, ...iptDb } = ipt
    await iptsCol.updateOne(
      { _id: ipt.id },
      { $set: { _id, ...iptDb, tag, ipt: repositorio, kingdom } },
      { upsert: true }
    )

    // Step 3: Save transformed data with references (if preservation system is available)
    if (preservador) {
      try {
        console.debug(
          `Saving transformation references for ${repositorio}:${tag}`
        )

        // Get all transformed documents for this IPT
        const transformedDocs = await ocorrenciasCol
          .find({ iptId: ipt.id })
          .toArray()

        if (transformedDocs.length > 0) {
          const transformFunctions = [
            'processaOcorrencias',
            'normalizeFields',
            'addGeoPoint'
          ]
          const saveResult = await saveTransformedWithReference(
            transformedDocs,
            ipt,
            'ocorrencias',
            transformFunctions
          )

          if (saveResult.inserted > 0) {
            console.log(
              `Linked ${saveResult.inserted} transformed documents to originals for ${repositorio}:${tag}`
            )
          }
          if (saveResult.failed > 0) {
            console.warn(
              `Failed to link ${saveResult.failed} documents for ${repositorio}:${tag}:`,
              saveResult.errors
            )
          }
        }
      } catch (error) {
        console.warn(
          `Failed to save transformation references for ${repositorio}:${tag}:`,
          (error as Error).message
        )
      }
    }
  }

  // Report failed IPTs
  if (failedIpts.size > 0) {
    console.log(
      `\nSummary: ${failedIpts.size} IPT server(s) were offline and skipped:`
    )
    for (const iptUrl of failedIpts) {
      console.log(`  - ${iptUrl}`)
    }
  }

  console.log('Processing completed successfully')
} catch (error) {
  console.error('Error occurred during processing:', error)
  exitCode = 1
} finally {
  console.log('Closing MongoDB connection')
  await client.close(true)
  console.log('MongoDB connection closed')
  if (typeof process !== 'undefined') {
    process.exit(exitCode)
  }
}
