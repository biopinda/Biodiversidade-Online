import { Db, MongoClient } from 'mongodb'

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

interface DatabaseOptions {
  maxPoolSize?: number
  minPoolSize?: number
}

/**
 * Obtém conexão MongoDB reutilizável
 * Pool de conexões é criado uma vez e reutilizado
 */
export async function getDatabase(options: DatabaseOptions = {}): Promise<Db> {
  if (cachedDb && cachedClient) {
    return cachedDb
  }

  const uri = process.env.MONGO_URI
  if (!uri) {
    throw new Error(
      'MONGO_URI não configurado. Configure a variável de ambiente.'
    )
  }

  const client = new MongoClient(uri, {
    maxPoolSize: options.maxPoolSize ?? 10,
    minPoolSize: options.minPoolSize ?? 2
  })

  await client.connect()

  const dbName = new URL(uri).pathname.substring(1)
  const db = client.db(dbName || undefined)

  cachedClient = client
  cachedDb = db

  return db
}

/**
 * Fecha conexão MongoDB (útil para cleanup em scripts)
 */
export async function closeDatabase(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close()
    cachedClient = null
    cachedDb = null
  }
}
