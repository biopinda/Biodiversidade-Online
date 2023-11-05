import { config } from 'https://deno.land/x/dotenv@v3.2.2/mod.ts'
import { MongoClient } from 'https://deno.land/x/mongo@v0.31.2/mod.ts'

import { processaZip } from './lib/dwca.ts'
const { MONGO_URI } = config()

const refUrls = await Deno.readTextFile('./referencias/herbarios.txt').then(
  (contents) => contents.split('\n')
)

const client = new MongoClient()
await client.connect(MONGO_URI as string)
const collection = client.database('dwc2json').collection('ocorrencias')
console.debug('Cleaning collection')
console.log(await collection.deleteMany({}))

for (const url of refUrls) {
  if (!url) continue
  console.debug(`Processing ${url}`)
  const json = await processaZip(url)
  const ocorrencias = Object.values(json)
  console.debug(`Inserting entries (${ocorrencias.length})`)
  for (let i = 0, n = ocorrencias.length; i < n; i += 5000) {
    console.log(`Inserting ${i} to ${Math.min(i + 5000, n)}`)
    await collection.insertMany(ocorrencias.slice(i, i + 5000), {
      ordered: false
    })
  }
}
console.log('Creating indexes')
await collection.createIndexes({
  indexes: [
    {
      key: { scientificName: 1 },
      name: 'scientificName'
    }
  ]
})
console.debug('Done')
