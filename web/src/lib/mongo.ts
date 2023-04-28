import { MongoClient } from 'mongodb'

// Connection URL
const url = process.env.MONGO_URI ?? ''
const client = new MongoClient(url)

async function getCollection(dbName: string, collection: string) {
  await client.connect()
  return client.db(dbName).collection(collection)
}

export async function listTaxa(filter: Record<string, unknown> = {}) {
  const taxa = await getCollection('dwc2json', 'taxa')
  return await taxa.find(filter).toArray()
}

export async function getTaxon(id: string) {
  const taxa = await getCollection('dwc2json', 'taxa')
  return await taxa.findOne({ taxonID: id })
}
