import { getMongoDatabase } from '@/lib/mongo'
import type { APIContext } from 'astro'
import type { Filter } from 'mongodb'

const VALID_RANKS = ['ESPECIE', 'VARIEDADE', 'FORMA', 'SUB_ESPECIE']
const VALID_KINGDOMS = ['Animalia', 'Plantae', 'Fungi']

interface TaxaQueryParams {
  scientificName?: string
  canonicalName?: string
  kingdom?: string
  family?: string
  genus?: string
  taxonRank?: string
  taxonomicStatus?: string
  threatStatus?: boolean
  invasive?: boolean
  limit?: number
  offset?: number
}

function parseQueryParams(searchParams: URLSearchParams): TaxaQueryParams {
  const params: TaxaQueryParams = {}

  if (searchParams.has('scientificName')) {
    params.scientificName = searchParams.get('scientificName')!
  }
  if (searchParams.has('canonicalName')) {
    params.canonicalName = searchParams.get('canonicalName')!
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
  if (searchParams.has('taxonRank')) {
    params.taxonRank = searchParams.get('taxonRank')!
  }
  if (searchParams.has('taxonomicStatus')) {
    params.taxonomicStatus = searchParams.get('taxonomicStatus')!
  }
  if (searchParams.has('threatStatus')) {
    params.threatStatus = searchParams.get('threatStatus') === 'true'
  }
  if (searchParams.has('invasive')) {
    params.invasive = searchParams.get('invasive') === 'true'
  }

  const limitStr = searchParams.get('limit')
  const offsetStr = searchParams.get('offset')

  params.limit = limitStr
    ? Math.min(Math.max(parseInt(limitStr, 10), 1), 1000)
    : 100
  params.offset = offsetStr ? Math.max(parseInt(offsetStr, 10), 0) : 0

  return params
}

function buildMongoFilter(params: TaxaQueryParams): Filter<any> {
  const filter: Filter<any> = {
    taxonRank: { $in: VALID_RANKS },
    kingdom: { $in: VALID_KINGDOMS }
  }

  if (params.scientificName) {
    filter.scientificName = new RegExp(params.scientificName, 'i')
  }
  if (params.canonicalName) {
    filter.canonicalName = params.canonicalName
  }
  if (params.kingdom) {
    filter.kingdom = params.kingdom
  }
  if (params.family) {
    filter.family = params.family
  }
  if (params.genus) {
    filter.genus = params.genus
  }
  if (params.taxonRank) {
    filter.taxonRank = params.taxonRank
  }
  if (params.taxonomicStatus) {
    filter.taxonomicStatus = params.taxonomicStatus
  }
  if (params.threatStatus) {
    filter.threatStatus = { $exists: true, $ne: null }
  }
  if (params.invasive) {
    filter['invasiveStatus.isInvasive'] = true
  }

  return filter
}

export async function GET({ request: { url } }: APIContext) {
  try {
    const searchParams = new URL(url).searchParams
    const params = parseQueryParams(searchParams)
    const filter = buildMongoFilter(params)

    const db = await getMongoDatabase()
    const collection = db.collection('taxa')

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
    console.error('Error in /api/taxa:', error)
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
