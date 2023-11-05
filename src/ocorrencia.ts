import { config } from 'https://deno.land/x/dotenv@v3.2.2/mod.ts'
import { MongoClient } from 'https://deno.land/x/mongo@v0.31.2/mod.ts'

import { processaZip } from './lib/dwca.ts'
const { MONGO_URI } = config()

const json = await processaZip(
  'https://ipt.jbrj.gov.br/jbrj/archive.do?r=jbrj_rb'
)

const client = new MongoClient()
await client.connect(MONGO_URI as string)
const collection = client.database('dwc2json').collection('ocorrencias')
console.debug('Cleaning collection')
console.log(await collection.deleteMany({}))
console.debug('Inserting ocurrences')
const ocorrencias = Object.values(json)
for (let i = 0, n = ocorrencias.length; i < n; i += 5000) {
  console.log(`Inserting ${i} to ${Math.min(i + 5000, n)}`)
  await collection.insertMany(ocorrencias.slice(i, i + 5000), {
    ordered: false
  })
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
