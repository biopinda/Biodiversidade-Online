const isDeno = typeof Deno !== 'undefined'
const { MongoClient } = await import(
  //TODO: harcoding to true because I can't get astro to build otherwise
  isDeno ? 'https://deno.land/x/mongo@v0.31.2/mod.ts' : 'mongodb'
)

const url =
  // @ts-ignore astro stuff
  import.meta.env.MONGO_URI ??
  // @ts-ignore ignore node stuff
  process.env.MONGO_URI ??
  Deno.env.get('MONGO_URI')
if (!url) {
  throw new Error(
    'Please define the MONGO_URI environment variable inside .env.local'
  )
}
const client = isDeno ? new MongoClient() : new MongoClient(url)

async function getCollection(dbName: string, collection: string) {
  await client.connect(isDeno ? url : undefined)
  return client[isDeno ? 'database' : 'db'](dbName).collection(collection)
}

export async function listTaxa(
  filter: Record<string, unknown> = {},
  _projection: Record<string, unknown> = {}
) {
  const taxa = await getCollection('dwc2json', 'taxa')
  return await taxa
    .find(filter)
    // .project(projection)
    .sort({ scientificName: 1 })
    .toArray()
}

export async function listTaxaPaginated(
  filter: Record<string, unknown> = {},
  page = 0,
  _projection: Record<string, unknown> = {}
) {
  const taxa = await getCollection('dwc2json', 'taxa')
  const total = await taxa.countDocuments(filter)
  const totalPages = Math.ceil(total / 50)
  const data = await taxa
    .find(filter)
    // .project(projection)
    .sort({ scientificName: 1 })
    .skip(page * 50)
    .limit(50)
    .toArray()
  return {
    data,
    total,
    totalPages
  }
}

export async function countTaxa(filter: Record<string, unknown> = {}) {
  const taxa = await getCollection('dwc2json', 'taxa')
  return await taxa.countDocuments(filter)
}

export async function getTaxon(
  kingdom: 'Plantae' | 'Fungi' | 'Animalia',
  id: string
) {
  const taxa = await getCollection('dwc2json', 'taxa')
  return await taxa.findOne({ kingdom, taxonID: id })
}
