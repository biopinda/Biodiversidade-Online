import { MongoClient } from 'mongodb'
const url = import.meta.env.MONGO_URI ?? process.env.MONGO_URI
if (!url) {
  throw new Error(
    'Please define the MONGO_URI environment variable inside .env.local'
  )
}
const client = new MongoClient(url)

async function getCollection(dbName: string, collection: string) {
  await client.connect()
  return client.db(dbName).collection(collection)
}

export async function listTaxa(
  filter: Record<string, unknown> = {},
  projection: Record<string, unknown> = {}
) {
  const taxa = await getCollection('dwc2json', 'taxa')
  return await taxa
    .find(filter)
    .project(projection)
    .sort({ scientificName: 1 })
    .toArray()
}

export async function countTaxa(filter: Record<string, unknown> = {}) {
  const taxa = await getCollection('dwc2json', 'taxa')
  return await taxa.countDocuments(filter)
}

export async function getTaxon(id: string) {
  const taxa = await getCollection('dwc2json', 'taxa')
  return await taxa.findOne({ taxonID: id })
}
