import { MongoClient } from 'npm:mongodb'
import { calculateObjectSize } from 'npm:bson'
import cliProgress from 'npm:cli-progress'
import Papa from 'npm:papaparse'

import { getEml, processaEml, processaZip, type DbIpt } from './lib/dwca.ts'

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

type IptSource = {
  nome: string
  repositorio: string
  kingdom: 'Animalia' | 'Plantae' | 'Fungi'
  tag: string
  url: string
}
const { data: iptSources } = (await Deno.readTextFile(
  './referencias/occurrences.csv'
).then((contents) => Papa.parse(contents, { header: true }))) as {
  data: IptSource[]
}

const mongoUri = Deno.env.get('MONGO_URI')
if (!mongoUri) {
  console.error('MONGO_URI environment variable is required')
  Deno.exit(1)
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
          console.log(`Index ${index.name} already exists with different options, skipping`)
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
      { key: { year: 1 }, name: 'year' }
    ]),
    createIndexSafely(iptsCol, [
      { key: { tag: 1 }, name: 'tag' },
      { key: { ipt: 1 }, name: 'ipt' }
    ])
  ])
  
  console.log('Indexes created successfully')

  for (const { repositorio, kingdom, tag, url } of iptSources) {
  if (!repositorio || !tag) continue;
  console.debug(`Processing ${repositorio}:${tag}\n${url}eml.do?r=${tag}`)
  const eml = await getEml(`${url}eml.do?r=${tag}`).catch((error) => {
    if (error.name === 'Http' && error.message.includes('404')) {
      console.log(`EML resource ${repositorio}:${tag} no longer exists (404) - skipping`)
      return null
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
  console.debug(`Downloading ${repositorio}:${tag} [${url}archive.do?r=${tag}]`)
  const ocorrencias = await processaZip(`${url}archive.do?r=${tag}`, true, 5000).catch((error) => {
    if (error.name === 'Http' && error.message.includes('404')) {
      console.log(`Resource ${repositorio}:${tag} no longer exists (404) - skipping`)
      return null
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
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
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
        
        // Process year field: convert to numeric, keep invalid as string
        const processedData = { ...ocorrencia[1] }
        if (processedData.year && typeof processedData.year === 'string') {
          const yearNum = parseInt(processedData.year, 10)
          if (!isNaN(yearNum) && yearNum > 0) {
            processedData.year = yearNum
          }
          // Invalid years remain as original strings
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
  }

  console.log('Processing completed successfully')
} catch (error) {
  console.error('Error occurred during processing:', error)
  throw error
} finally {
  console.log('Closing MongoDB connection')
  await client.close()
}
