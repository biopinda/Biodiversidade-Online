import { getMongoDatabase } from '@/lib/mongo'
import type { APIContext } from 'astro'
import type { Filter } from 'mongodb'

interface GeoJSONFeature {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: Record<string, any>
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

function buildMongoFilter(searchParams: URLSearchParams): Filter<any> {
  const filter: Filter<any> = {
    country: 'Brasil',
    geoPoint: { $exists: true, $ne: null } // Only records with coordinates
  }

  // bbox is required for GeoJSON endpoint
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

  if (searchParams.has('scientificName')) {
    filter.scientificName = new RegExp(searchParams.get('scientificName')!, 'i')
  }
  if (searchParams.has('kingdom')) {
    filter.iptKingdoms = searchParams.get('kingdom')!
  }
  if (searchParams.has('year')) {
    const year = parseInt(searchParams.get('year')!, 10)
    if (!isNaN(year)) {
      filter.year = year
    }
  }

  return filter
}

export async function GET({ request: { url } }: APIContext) {
  try {
    const searchParams = new URL(url).searchParams

    // Validate bbox parameter
    if (!searchParams.has('bbox')) {
      return new Response(
        JSON.stringify({
          error: 'Missing required parameter',
          message: "Parameter 'bbox' is required for GeoJSON endpoint"
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    const filter = buildMongoFilter(searchParams)

    // Limit to max 10,000 features for performance
    const limitStr = searchParams.get('limit')
    const limit = limitStr ? Math.min(parseInt(limitStr, 10), 10000) : 1000

    const db = await getMongoDatabase()
    const collection = db.collection('occurrences')

    const occurrences = await collection.find(filter).limit(limit).toArray()

    // Transform to GeoJSON FeatureCollection
    const featureCollection: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: occurrences
        .filter((occ) => occ.geoPoint && occ.geoPoint.coordinates)
        .map((occ) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: occ.geoPoint.coordinates
          },
          properties: {
            occurrenceID: occ.occurrenceID || occ._id,
            scientificName: occ.scientificName,
            taxonID: occ.taxonID,
            year: occ.year,
            stateProvince: occ.stateProvince,
            county: occ.county,
            family: occ.family,
            genus: occ.genus,
            basisOfRecord: occ.basisOfRecord
          }
        }))
    }

    return new Response(JSON.stringify(featureCollection), {
      status: 200,
      headers: {
        'Content-Type': 'application/geo+json'
      }
    })
  } catch (error) {
    console.error('Error in /api/occurrences/geojson:', error)
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
