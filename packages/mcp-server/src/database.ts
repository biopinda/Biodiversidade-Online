import { type Collection, MongoClient } from 'mongodb'

/**
 * Obtém a URL de conexão do MongoDB a partir das variáveis de ambiente
 */
export function getMongoUrl(): string {
  const url = process.env.MONGO_URI

  if (!url) {
    throw new Error('MONGO_URI environment variable is required for MCP server')
  }

  return url
}

// Cliente MongoDB compartilhado
let client: MongoClient | null = null

/**
 * Obtém uma instância do cliente MongoDB
 */
export function getClient(): MongoClient {
  if (!client) {
    const url = getMongoUrl()
    client = new MongoClient(url, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      retryWrites: true
    })
  }
  return client
}

/**
 * Conecta ao MongoDB com timeout
 */
export async function connectWithTimeout(timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const client = getClient()
    const timeoutTimer = setTimeout(() => {
      console.warn('⚠️  MongoDB connection timeout after', timeout, 'ms')
      resolve(false)
    }, timeout)

    client
      .connect()
      .then(
        () => {
          console.log('✅ MongoDB connected successfully')
          resolve(true)
        },
        (error) => {
          console.error('❌ MongoDB connection failed:', error.message)
          resolve(false)
        }
      )
      .finally(() => {
        clearTimeout(timeoutTimer)
      })
  })
}

/**
 * Obtém uma coleção MongoDB
 */
export async function getCollection(
  dbName: string,
  collectionName: string
): Promise<Collection | null> {
  try {
    if (!(await connectWithTimeout())) {
      console.warn(
        `⚠️  Could not connect to MongoDB for ${dbName}.${collectionName}`
      )
      return null
    }
    const client = getClient()
    return client.db(dbName).collection(collectionName)
  } catch (error) {
    console.error(
      `❌ Error getting collection ${dbName}.${collectionName}:`,
      error
    )
    return null
  }
}

/**
 * Fecha a conexão com MongoDB
 */
export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close()
    client = null
    console.log('🔌 MongoDB connection closed')
  }
}
