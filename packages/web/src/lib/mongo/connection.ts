import { type Collection, MongoClient } from 'mongodb'

// Debug environment variables (only in development)
if (
  (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') ||
  (typeof import.meta !== 'undefined' &&
    import.meta.env?.NODE_ENV === 'development')
) {
  console.log('🔍 Debug env vars:', {
    nodeEnv:
      typeof process !== 'undefined' ? process.env.NODE_ENV : 'undefined',
    mongoFromProcess:
      typeof process !== 'undefined' ? process.env.MONGO_URI : 'undefined',
    mongoFromGlobal:
      typeof globalThis !== 'undefined' && globalThis.process?.env?.MONGO_URI,
    importMetaEnv:
      typeof import.meta !== 'undefined'
        ? import.meta.env?.MONGO_URI
        : 'undefined'
  })
}

export function getMongoUrl(): string {
  // Try different ways to get MONGO_URI
  const url =
    (typeof process !== 'undefined' && process.env.MONGO_URI) ??
    (typeof globalThis !== 'undefined' && globalThis.process?.env?.MONGO_URI) ??
    (typeof import.meta !== 'undefined' && import.meta.env?.MONGO_URI)

  console.log('🔗 Using MongoDB URL:', url ? 'Found' : 'Not found')

  if (!url) {
    console.error('❌ MONGO_URI environment variable is not defined')
    throw new Error(
      'Please define the MONGO_URI environment variable inside .env.local'
    )
  }

  return url
}

// Create client lazily to avoid connection issues at module load time
let client: MongoClient | null = null

export function getClient(): MongoClient {
  if (!client) {
    const url = getMongoUrl()
    client = new MongoClient(url, {
      // Add connection options to improve reliability
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      retryWrites: true
    })
  }
  return client
}

export function connectClientWithTimeout(timeout = 5000) {
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

export async function getCollection(dbName: string, collection: string) {
  try {
    if (!(await connectClientWithTimeout())) {
      console.warn(
        `⚠️  Could not connect to MongoDB for ${dbName}.${collection}`
      )
      return null
    }
    const client = getClient()
    return client.db(dbName).collection(collection) as Collection
  } catch (error) {
    console.error(`❌ Error getting collection ${dbName}.${collection}:`, error)
    return null
  }
}

export async function getMongoDatabase() {
  if (!(await connectClientWithTimeout())) {
    throw new Error('Could not connect to MongoDB')
  }
  const client = getClient()
  const url = getMongoUrl()
  // Extract database name from connection string
  const dbName = url.split('/').pop()?.split('?')[0] || 'biodiversidade'
  return client.db(dbName)
}
