import { listOccurrences } from './mongo.ts'

type OccurrenceQuery = {
  canonicalName?: string
  country?: string
  stateProvince?: string
  county?: string
  recordedBy?: string
  eventDate?: string
  catalogNumber?: string
  lat?: number
  long?: number
  maxDistance?: number
}
export const getOccurrencePlot = async (query: OccurrenceQuery) => {
  const { canonicalName, lat, long, maxDistance } = query
  const filter: Record<string, unknown> = {}
  if (canonicalName) filter.canonicalName = new RegExp(canonicalName, 'i')
  if (lat && long) {
    filter.geoPoint = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [long, lat]
        },
        $maxDistance: maxDistance ?? 1000
      }
    }
  } else if (!canonicalName) {
    return null
  }

  type Occurrence = {
    [key: string]: unknown
    geoPoint?: {
      type: 'Point'
      coordinates: [number, number]
    }
  }
  const data = (await listOccurrences(filter)) as Occurrence[]
  return data.reduce<{
    type: 'FeatureCollection'
    features: Record<string, unknown>[]
  }>(
    (acc, cur) => {
      if (cur.geoPoint) {
        acc.features.push({
          type: 'Feature',
          properties: {
            scientificName: cur.scientificName,
            locality: cur.locality,
            country: cur.country,
            stateProvince: cur.stateProvince,
            county: cur.county,
            recordedBy: cur.recordedBy,
            eventDate: cur.eventDate,
            catalogNumber: cur.catalogNumber,
            decimalLatitude: cur.decimalLatitude,
            decimalLongitude: cur.decimalLongitude
          },
          geometry: cur.geoPoint
        })
      }
      return acc
    },
    {
      type: 'FeatureCollection',
      features: []
    }
  )
}
