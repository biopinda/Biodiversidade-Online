import { Db, MongoClient } from 'mongodb'

const clientCache = new Map<string, Promise<MongoClient>>()

export interface MongoConnectionOptions {
  readonly uri?: string
  readonly dbName?: string
}

function resolveMongoUri(uri?: string): string {
  const finalUri = uri ?? process.env.MONGO_URI
  if (!finalUri) {
    throw new Error(
      'MONGO_URI environment variable is required to run transform pipelines.'
    )
  }
  return finalUri
}

async function createMongoClient(uri: string): Promise<MongoClient> {
  const client = new MongoClient(uri, {
    ignoreUndefined: true,
    maxPoolSize: 16
  })
  return client.connect()
}

export async function getMongoClient(
  options: MongoConnectionOptions = {}
): Promise<MongoClient> {
  const uri = resolveMongoUri(options.uri)
  let clientPromise = clientCache.get(uri)
  if (!clientPromise) {
    clientPromise = createMongoClient(uri)
    clientCache.set(uri, clientPromise)
  }
  return clientPromise
}

export async function getMongoDatabase(
  options: MongoConnectionOptions = {}
): Promise<Db> {
  const client = await getMongoClient(options)
  const dbName = options.dbName ?? process.env.MONGO_DB_NAME ?? 'dwc2json'
  return client.db(dbName)
}

export async function closeMongoClients(): Promise<void> {
  const clients = await Promise.allSettled(clientCache.values())
  clientCache.clear()
  await Promise.all(
    clients
      .filter(
        (result): result is PromiseFulfilledResult<MongoClient> =>
          result.status === 'fulfilled'
      )
      .map(async ({ value }) => {
        try {
          await value.close()
        } catch {
          // ignore close errors to avoid masking original failure
        }
      })
  )
}

export function isMongoClientCached(uri?: string): boolean {
  const targetUri = resolveMongoUri(uri)
  return clientCache.has(targetUri)
}
