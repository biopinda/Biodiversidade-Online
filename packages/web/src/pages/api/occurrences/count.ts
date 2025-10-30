import { getMongoDatabase } from '@/lib/mongo'
import type { APIContext } from 'astro'
import type { Filter } from 'mongodb'

function buildMongoFilter(searchParams: URLSearchParams): Filter<any> {
  const filter: Filter<any> = {
    country: 'Brasil' // Always filter to Brasil
  }

  if (searchParams.has('scientificName')) {
    filter.scientificName = new RegExp(searchParams.get('scientificName')!, 'i')
  }
  if (searchParams.has('stateProvince')) {
    filter.stateProvince = searchParams.get('stateProvince')!
  }
  if (searchParams.has('bbox')) {
    const coords = searchParams.get('bbox')!.split(',').map(parseFloat)
    if (coords.length === 4 && coords.every((c) => !isNaN(c))) {
      const [minLon, minLat, maxLon, maxLat] = coords
      filter.geoPoint = {
        $geoWithin: {
          $box: [
            [minLon, minLat],
            [maxLon, maxLat]
          ]
        }
      }
    }
  }
  if (searchParams.has('year')) {
    const year = parseInt(searchParams.get('year')!, 10)
    if (!isNaN(year)) {
      filter.year = year
    }
  }
  if (searchParams.has('kingdom')) {
    filter.iptKingdoms = searchParams.get('kingdom')!
  }
  if (
    searchParams.has('hasCoordinates') &&
    searchParams.get('hasCoordinates') === 'true'
  ) {
    filter.geoPoint = { $exists: true, $ne: null }
  }

  return filter
}

export async function GET({ request: { url } }: APIContext) {
  try {
    const searchParams = new URL(url).searchParams
    const filter = buildMongoFilter(searchParams)

    const db = await getMongoDatabase()
    const collection = db.collection('occurrences')

    const count = await collection.countDocuments(filter)

    // Build applied filters object (exclude empty values)
    const appliedFilters: Record<string, any> = {}
    searchParams.forEach((value, key) => {
      if (value && key !== 'limit' && key !== 'offset') {
        appliedFilters[key] = value
      }
    })

    const response = {
      count,
      filters: appliedFilters
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error in /api/occurrences/count:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }
}
