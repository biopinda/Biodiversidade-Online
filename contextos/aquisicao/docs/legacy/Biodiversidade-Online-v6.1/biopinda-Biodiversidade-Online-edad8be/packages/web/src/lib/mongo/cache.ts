import { getCollection } from './connection'

// Cache management utilities
// Most cache operations are handled inline within occurrence queries
// This module provides shared cache utilities

export async function ensureCacheCollection() {
  try {
    const cache = await getCollection('dwc2json', 'occurrenceCache')
    if (!cache) return false

    // Ensure TTL index exists
    await cache.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 })

    // Ensure key index exists
    await cache.createIndex({ key: 1 }, { unique: true })

    return true
  } catch (error) {
    console.warn('⚠️ Failed to setup cache collection:', error)
    return false
  }
}

export async function clearCache(keyPattern?: string) {
  try {
    const cache = await getCollection('dwc2json', 'occurrenceCache')
    if (!cache) return false

    if (keyPattern) {
      const result = await cache.deleteMany({ key: new RegExp(keyPattern) })
      console.log(
        `🗑️ Cleared ${result.deletedCount} cache entries matching pattern: ${keyPattern}`
      )
    } else {
      const result = await cache.deleteMany({})
      console.log(`🗑️ Cleared all ${result.deletedCount} cache entries`)
    }

    return true
  } catch (error) {
    console.error('❌ Failed to clear cache:', error)
    return false
  }
}

export async function getCacheStats() {
  try {
    const cache = await getCollection('dwc2json', 'occurrenceCache')
    if (!cache) return null

    const totalEntries = await cache.countDocuments()
    const recentEntries = await cache.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 3600000) } // Last hour
    })

    return {
      totalEntries,
      recentEntries,
      hitRate: recentEntries / Math.max(totalEntries, 1)
    }
  } catch (error) {
    console.error('❌ Failed to get cache stats:', error)
    return null
  }
}
