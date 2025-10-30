import { getCollection } from './connection'
import type { TaxaFilter } from './taxa'

const FALLBACK_SAMPLE_MULTIPLIER = 220
const FALLBACK_SAMPLE_SIZE_DASHBOARD = 50000
const FALLBACK_SAMPLE_SIZE_FILTERED = 10000

export async function getOccurrenceCountPerKingdom(kingdom: string) {
  const occurrences = await getCollection('dwc2json', 'occurrences')
  if (!occurrences) return null

  const result = await occurrences.countDocuments({
    iptKingdoms: kingdom[0]!.toUpperCase() + kingdom.slice(1).toLowerCase()
  })

  return result
}

export async function listOccurrences(
  filter: Record<string, unknown> = {},
  _projection: Record<string, unknown> = {}
) {
  try {
    const occurrences = await getCollection('dwc2json', 'occurrences')
    if (!occurrences) {
      console.warn('⚠️  Occurrences collection not available')
      return []
    }
    return await occurrences
      .find(filter)
      // .project(projection)
      .toArray()
  } catch (error) {
    console.error('❌ Error listing occurrences:', error)
    return []
  }
}

export async function countOccurrenceRegions(
  filter: TaxaFilter = {},
  forceRefresh = false
) {
  const startTime = Date.now()

  // Generate cache key based on filters
  const cacheKey = JSON.stringify(filter)
  const crypto = await import('crypto')
  const cacheKeyHash = crypto.createHash('md5').update(cacheKey).digest('hex')

  // Get cache collection reference
  const cache = await getCollection('dwc2json', 'occurrenceCache')

  // Try to get from cache first (unless force refresh is requested)
  if (!forceRefresh && cache) {
    try {
      const cached = await cache.findOne({ key: cacheKeyHash })
      if (cached && cached.data) {
        console.log(
          `⚡ Cache hit for occurrence query (${Date.now() - startTime}ms)`
        )
        return cached.data
      }
    } catch (cacheError) {
      console.warn(
        '⚠️ Failed to read from cache, proceeding with database query:',
        cacheError
      )
    }
  }

  const occurrences = await getCollection('dwc2json', 'occurrences')
  if (!occurrences) return null

  // Build optimized match stage
  const matchStage: Record<string, unknown> = {}

  // Add all filters with optimized regex patterns
  Object.entries(filter).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      const trimmedValue = value.trim()

      if (key === 'genus' || key === 'specificEpithet') {
        // Exact match for genus and specific epithet
        matchStage[key] = new RegExp(`^${trimmedValue}$`, 'i')
      } else {
        // Word boundary match for other taxonomic fields
        matchStage[key] = new RegExp(`\\b${trimmedValue}\\b`, 'i')
      }
    } else if (value instanceof RegExp) {
      matchStage[key] = value
    }
  })

  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Optimized aggregation pipeline with filters:', matchStage)
  }

  try {
    // Build the match conditions - now simplified since data is pre-normalized
    const baseConditions = [
      {
        country: 'Brasil' // Exact match since data is normalized
      },
      {
        stateProvince: { $exists: true, $nin: [null, '', 'Unknown'] } // Simple existence check
      }
    ]

    // Create the final match object
    const matchFilter =
      Object.keys(matchStage).length > 0
        ? { $and: [matchStage, ...baseConditions] }
        : { $and: baseConditions }

    const pipeline = [
      {
        $match: matchFilter
      },
      {
        $facet: {
          total: [{ $count: 'count' }],
          byRegion: [
            // No need for complex normalization - data is already normalized
            {
              $group: {
                _id: '$stateProvince', // Direct field reference
                count: { $sum: 1 }
              }
            },
            {
              $match: {
                _id: { $exists: true, $nin: [null, '', 'Unknown'] }
              }
            },
            { $sort: { count: -1 } }
          ]
        }
      }
    ]

    console.log(
      `🔍 Running aggregation ${Object.keys(matchStage).length === 0 ? 'without filters' : 'with filters'}`
    )

    const results = await occurrences
      .aggregate(pipeline, {
        maxTimeMS: 120000,
        allowDiskUse: true // Allow disk usage for large datasets
      })
      .toArray()

    const result = results[0]
    if (!result) {
      console.warn('⚠️ No result from aggregation pipeline')
      return { total: 0, regions: [] }
    }

    const total = result.total[0]?.count || 0
    const regions = result.byRegion || []

    const responseData = { total, regions }

    // Cache the result for future requests
    if (cache) {
      try {
        await cache.replaceOne(
          { key: cacheKeyHash },
          {
            key: cacheKeyHash,
            data: responseData,
            createdAt: new Date(),
            filters: filter
          },
          { upsert: true }
        )
      } catch (cacheError) {
        if (
          cacheError &&
          typeof cacheError === 'object' &&
          'message' in cacheError
        ) {
          console.warn(
            '⚠️ Failed to cache result:',
            (cacheError as { message?: string }).message
          )
        } else {
          console.warn('⚠️ Failed to cache result:', cacheError)
        }
      }
    } else {
      console.warn('⚠️ Cache collection not available, skipping cache write')
    }

    const queryTime = Date.now() - startTime
    console.log(
      `✅ Optimized aggregation completed: ${total} total, ${regions.length} regions (${queryTime}ms)`
    )

    return responseData
  } catch (error) {
    const queryTime = Date.now() - startTime
    console.error(`❌ Aggregation error (${queryTime}ms):`, error)

    // If timeout, try a simpler query
    if (
      typeof error === 'object' &&
      error !== null &&
      ('code' in error || 'message' in error)
    ) {
      const err = error as { code?: number; message?: string }
      if (err.code === 50 || (err.message && err.message.includes('timeout'))) {
        console.log('⏰ Query timeout, attempting fallback...')

        try {
          console.log('🚀 Attempting ultra-fast fallback with sampling...')

          // Ultra-fast fallback: use small sample for quick results
          const sampleSize =
            Object.keys(matchStage).length === 0
              ? FALLBACK_SAMPLE_SIZE_DASHBOARD
              : FALLBACK_SAMPLE_SIZE_FILTERED

          const fallbackPipeline = [
            {
              $match: {
                country: 'Brasil' // Exact match since data is normalized
              }
            },
            { $sample: { size: sampleSize } },
            {
              $facet: {
                total: [
                  {
                    $count: 'sampleCount'
                  },
                  {
                    $project: {
                      count: {
                        $multiply: [
                          '$sampleCount',
                          FALLBACK_SAMPLE_MULTIPLIER // More conservative estimate for fallback
                        ]
                      }
                    }
                  }
                ],
                byRegion: [
                  // No need for complex normalization - data is already normalized
                  {
                    $group: {
                      _id: '$stateProvince', // Direct field reference
                      count: { $sum: 1 }
                    }
                  },
                  {
                    $match: {
                      _id: { $exists: true, $nin: [null, '', 'Unknown'] }
                    }
                  },
                  {
                    $project: {
                      _id: 1,
                      count: {
                        $multiply: [
                          '$count',
                          FALLBACK_SAMPLE_MULTIPLIER // More conservative estimate for fallback
                        ]
                      }
                    }
                  },
                  { $sort: { count: -1 } },
                  { $limit: 27 }
                ]
              }
            }
          ]

          const fallbackResults = await occurrences
            .aggregate(fallbackPipeline, { maxTimeMS: 8000 })
            .toArray()

          const fallbackResult = fallbackResults[0]
          const totalCount = fallbackResult?.total[0]?.count || 0
          const topStates = fallbackResult?.byRegion || []

          const fallbackData = {
            total: totalCount,
            regions: topStates
          }

          console.log(
            `⚡ Fallback query completed: ${totalCount} total, ${topStates.length} regions`
          )
          return fallbackData
        } catch (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError)
          throw new Error(
            'Consulta demorou muito para responder. Tente filtros mais específicos.'
          )
        }
      }
    }

    throw error
  }
}
