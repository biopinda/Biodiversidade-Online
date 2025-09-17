import { MongoClient } from 'mongodb'
import { calculateObjectSize } from 'bson'
import cliProgress from 'cli-progress'
import Papa from 'papaparse'
import { readFile } from 'node:fs/promises'

import { getEml, processaEml, processaZip, type DbIpt } from './lib/dwca.ts'

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
        insertedIds: { ...acc.insertedIds, ...cur.insertedIds },
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
const csvContents = await readFile(
  new URL('../referencias/occurrences.csv', import.meta.url),
  'utf-8'
)
const { data: iptSources } = Papa.parse<IptSource>(csvContents, {
  header: true,
})

const mongoUri = process.env.MONGO_URI
if (!mongoUri) {
  console.error('MONGO_URI environment variable is required')
  process.exit(1)
}
const client = new MongoClient(mongoUri)
await client.connect()
const iptsCol = client.db('dwc2json').collection<DbIpt>('ipts')
const ocorrenciasCol = client.db('dwc2json').collection('ocorrencias')

console.log('Connecting to MongoDB...')
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
    ]),
    createIndexSafely(iptsCol, [
      { key: { tag: 1 }, name: 'tag' },
      { key: { ipt: 1 }, name: 'ipt' },
    ]),
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

  for (const { repositorio, kingdom, tag, url } of iptSources) {
    if (!repositorio || !tag) continue

    // Check if this IPT server has already failed
    const iptBaseUrl = getIptBaseUrl(url)
    if (failedIpts.has(iptBaseUrl)) {
      console.log(
        `Skipping ${repositorio}:${tag} - IPT server ${iptBaseUrl} already failed`
      )
      continue
    }

    console.debug(`Processing ${repositorio}:${tag}\n${url}eml.do?r=${tag}`)
    const eml = await getEml(`${url}eml.do?r=${tag}`).catch((error) => {
      // Handle 404 errors when IPT EML resources no longer exist
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

      // If this is a timeout or connection error, mark the entire IPT as failed
      if (isNetworkError(error)) {
        console.log(
          `IPT server ${iptBaseUrl} appears to be offline - marking for skip`
        )
        failedIpts.add(iptBaseUrl)
      }

      console.log('Erro baixando/processando eml', error.message)
      return null
    })
    if (!eml) continue
    const ipt = processaEml(eml)
    const dbVersion = ((await iptsCol.findOne({ _id: ipt.id })) as DbIpt | null)
      ?.version
    if (dbVersion === ipt.version) {
      console.debug(`${repositorio}:${tag} already on version ${ipt.version}`)
      continue
    }
    console.log(`Version mismatch: DB[${dbVersion}] vs REMOTE[${ipt.version}]`)
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

      // If this is a timeout or connection error, mark the entire IPT as failed
      if (isNetworkError(error)) {
        console.log(
          `IPT server ${iptBaseUrl} appears to be offline during archive download - marking for skip`
        )
        failedIpts.add(iptBaseUrl)
      }

      throw error
    })
    if (!ocorrencias) continue
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
      if (!batch || !batch.length) break
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
                coordinates: [longitude, latitude],
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
            ocorrencia[1].cultivarEpiteth,
          ]
            .filter(Boolean)
            .join(' ')
          const iptKingdoms = kingdom.split(/, ?/)

          // Process year field: convert to numeric, keep invalid as string
          const processedData = { ...ocorrencia[1] }
          tryConvertToNumber(processedData, 'year', (num) => num > 0)

          // Process month field: convert to numeric, keep invalid as string
          tryConvertToNumber(
            processedData,
            'month',
            (num) => num >= 1 && num <= 12
          )

          // Process day field: convert to numeric, keep invalid as string
          tryConvertToNumber(
            processedData,
            'day',
            (num) => num >= 1 && num <= 31
          )

          // Process eventDate field: extract year/month/day if missing, then convert to BSON Date
          if (
            processedData.eventDate &&
            typeof processedData.eventDate === 'string'
          ) {
            try {
              const eventDateObj = new Date(processedData.eventDate)
              // Check if the date is valid (not NaN) and not an invalid date
              if (
                !isNaN(eventDateObj.getTime()) &&
                eventDateObj.toString() !== 'Invalid Date'
              ) {
                // Extract year, month, day from eventDate if missing
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
                // Convert eventDate to BSON Date
                processedData.eventDate = eventDateObj
              }
              // Invalid dates remain as original strings
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
            ...processedData,
          }
        }),
        {
          ordered: false,
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
  throw error
} finally {
  console.log('Closing MongoDB connection')
  await client.close()
}
