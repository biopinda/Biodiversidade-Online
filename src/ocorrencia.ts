import { MongoClient } from 'npm:mongodb'
import { calculateObjectSize } from 'npm:bson'
import cliProgress from 'npm:cli-progress'

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

const iptSources = await Deno.readTextFile('./referencias/sources.json').then(
  (contents) => JSON.parse(contents)
)

const client = new MongoClient(Deno.env.get('MONGO_URI') as string)
await client.connect()
const iptsCol = client.db('dwc2json').collection<DbIpt>('ipts')
const ocorrenciasCol = client.db('dwc2json').collection('ocorrencias')

console.log('Creating indexes')
await Promise.all([
  ocorrenciasCol.createIndexes([
    {
      key: { scientificName: 1 },
      name: 'scientificName'
    },
    {
      key: { iptId: 1 },
      name: 'iptId'
    },
    {
      key: { ipt: 1 },
      name: 'ipt'
    },
    { key: { canonicalName: 1 }, name: 'canonicalName' },
    { key: { flatScientificName: 1 }, name: 'flatScientificName' }
  ]),
  iptsCol.createIndexes([
    {
      key: { tag: 1 },
      name: 'tag'
    },
    {
      key: { ipt: 1 },
      name: 'ipt'
    }
  ])
])

for (const { ipt: iptName, baseUrl, datasets } of iptSources) {
  for (const set of datasets) {
    if (!set) continue
    console.debug(`Processing ${set}`)
    const eml = await getEml(`${baseUrl}eml.do?r=${set}`)
    const ipt = processaEml(eml)
    const dbVersion = ((await iptsCol.findOne({ _id: ipt.id })) as DbIpt | null)
      ?.version
    if (dbVersion === ipt.version) {
      console.debug(`${set} already on version ${ipt.version}`)
      continue
    }
    console.log(`Version mismatch: DB[${dbVersion}] vs REMOTE[${ipt.version}]`)
    console.debug(`Downloading ${set} [${baseUrl}archive.do?r=${set}]`)
    const ocorrencias = await processaZip(
      `${baseUrl}archive.do?r=${set}`,
      true,
      5000
    )
    console.debug(`Cleaning ${set}`)
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
        batch.map((ocorrencia) => ({
          iptId: ipt.id,
          ipt: iptName,
          canonicalName: [
            ocorrencia[1].genus,
            ocorrencia[1].specificEpithet,
            ocorrencia[1].infraspecificEpithet
          ]
            .filter(Boolean)
            .join(' '),
          flatScientificName: (ocorrencia[1].scientificName as string)
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLocaleLowerCase(),
          ...ocorrencia[1]
        })),
        {
          ordered: false
        }
      )
      bar.increment(Math.floor(batch.length / 4))
    }
    bar.stop()
    console.debug(`Inserting IPT ${set}`)
    const { id: _id, ...iptDb } = ipt
    await iptsCol.updateOne(
      { _id: ipt.id },
      { $set: { _id, ...iptDb, tag: set, ipt: iptName } },
      { upsert: true }
    )
  }
}
console.debug('Done')
client.close()
