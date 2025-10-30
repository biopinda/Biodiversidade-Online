import { getMongoDatabase } from '@/lib/mongo'
import type { APIContext } from 'astro'
import type { Filter } from 'mongodb'

interface OccurrencesQueryParams {
  scientificName?: string
  canonicalName?: string
  taxonID?: string
  kingdom?: string
  family?: string
  genus?: string
  stateProvince?: string
  county?: string
  bbox?: string
  year?: number
  month?: number
  yearFrom?: number
  yearTo?: number
  iptId?: string
  basisOfRecord?: string
  hasCoordinates?: boolean
  limit?: number
  offset?: number
}

function parseQueryParams(
  searchParams: URLSearchParams
): OccurrencesQueryParams {
  const params: OccurrencesQueryParams = {}

  if (searchParams.has('scientificName')) {
    params.scientificName = searchParams.get('scientificName')!
  }
  if (searchParams.has('canonicalName')) {
    params.canonicalName = searchParams.get('canonicalName')!
  }
  if (searchParams.has('taxonID')) {
    params.taxonID = searchParams.get('taxonID')!
  }
  if (searchParams.has('kingdom')) {
    params.kingdom = searchParams.get('kingdom')!
  }
  if (searchParams.has('family')) {
    params.family = searchParams.get('family')!
  }
  if (searchParams.has('genus')) {
    params.genus = searchParams.get('genus')!
  }
  if (searchParams.has('stateProvince')) {
    params.stateProvince = searchParams.get('stateProvince')!
  }
  if (searchParams.has('county')) {
    params.county = searchParams.get('county')!
  }
  if (searchParams.has('bbox')) {
    params.bbox = searchParams.get('bbox')!
  }
  if (searchParams.has('year')) {
    params.year = parseInt(searchParams.get('year')!, 10)
  }
  if (searchParams.has('month')) {
    params.month = parseInt(searchParams.get('month')!, 10)
  }
  if (searchParams.has('yearFrom')) {
    params.yearFrom = parseInt(searchParams.get('yearFrom')!, 10)
  }
  if (searchParams.has('yearTo')) {
    params.yearTo = parseInt(searchParams.get('yearTo')!, 10)
  }
  if (searchParams.has('iptId')) {
    params.iptId = searchParams.get('iptId')!
  }
  if (searchParams.has('basisOfRecord')) {
    params.basisOfRecord = searchParams.get('basisOfRecord')!
  }
  if (searchParams.has('hasCoordinates')) {
    params.hasCoordinates = searchParams.get('hasCoordinates') === 'true'
  }

  const limitStr = searchParams.get('limit')
  const offsetStr = searchParams.get('offset')

  params.limit = limitStr
    ? Math.min(Math.max(parseInt(limitStr, 10), 1), 1000)
    : 100
  params.offset = offsetStr ? Math.max(parseInt(offsetStr, 10), 0) : 0

  return params
}

function buildMongoFilter(params: OccurrencesQueryParams): Filter<any> {
  const filter: Filter<any> = {
    country: 'Brasil' // Always filter to Brasil
  }

  if (params.scientificName) {
    filter.scientificName = new RegExp(params.scientificName, 'i')
  }
  if (params.canonicalName) {
    filter.canonicalName = params.canonicalName
  }
  if (params.taxonID) {
    filter.taxonID = params.taxonID
  }
  if (params.kingdom) {
    filter.iptKingdoms = params.kingdom
  }
  if (params.family) {
    filter.family = params.family
  }
  if (params.genus) {
    filter.genus = params.genus
  }
  if (params.stateProvince) {
    filter.stateProvince = params.stateProvince
  }
  if (params.county) {
    filter.county = params.county
  }
  if (params.bbox) {
    // Parse bbox: minLon,minLat,maxLon,maxLat
    const coords = params.bbox.split(',').map(parseFloat)
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
  if (params.year !== undefined && !isNaN(params.year)) {
    filter.year = params.year
  }
  if (params.month !== undefined && !isNaN(params.month)) {
    filter.month = params.month
  }
  if (params.yearFrom !== undefined && params.yearTo !== undefined) {
    filter.year = {
      $gte: params.yearFrom,
      $lte: params.yearTo
    }
  } else if (params.yearFrom !== undefined) {
    filter.year = { $gte: params.yearFrom }
  } else if (params.yearTo !== undefined) {
    filter.year = { $lte: params.yearTo }
  }
  if (params.iptId) {
    filter.iptId = params.iptId
  }
  if (params.basisOfRecord) {
    filter.basisOfRecord = params.basisOfRecord
  }
  if (params.hasCoordinates) {
    filter.geoPoint = { $exists: true, $ne: null }
  }

  return filter
}

export async function GET({ request: { url } }: APIContext) {
  try {
    const searchParams = new URL(url).searchParams
    const params = parseQueryParams(searchParams)
    const filter = buildMongoFilter(params)

    const db = await getMongoDatabase()
    const collection = db.collection('occurrences')

    const [data, total] = await Promise.all([
      collection
        .find(filter)
        .skip(params.offset!)
        .limit(params.limit!)
        .toArray(),
      collection.countDocuments(filter)
    ])

    const response = {
      data,
      pagination: {
        total,
        limit: params.limit!,
        offset: params.offset!,
        hasMore: params.offset! + params.limit! < total
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error in /api/occurrences:', error)
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
