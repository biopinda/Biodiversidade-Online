import { getMongoDatabase } from '@/lib/mongo'
import type { APIContext } from 'astro'
import type { Filter } from 'mongodb'

const VALID_RANKS = ['ESPECIE', 'VARIEDADE', 'FORMA', 'SUB_ESPECIE']
const VALID_KINGDOMS = ['Animalia', 'Plantae', 'Fungi']

function buildMongoFilter(searchParams: URLSearchParams): Filter<any> {
  const filter: Filter<any> = {
    taxonRank: { $in: VALID_RANKS },
    kingdom: { $in: VALID_KINGDOMS }
  }

  if (searchParams.has('scientificName')) {
    filter.scientificName = new RegExp(searchParams.get('scientificName')!, 'i')
  }
  if (searchParams.has('kingdom')) {
    filter.kingdom = searchParams.get('kingdom')!
  }
  if (searchParams.has('family')) {
    filter.family = searchParams.get('family')!
  }
  if (searchParams.has('genus')) {
    filter.genus = searchParams.get('genus')!
  }
  if (searchParams.has('taxonRank')) {
    filter.taxonRank = searchParams.get('taxonRank')!
  }
  if (searchParams.has('threatStatus')) {
    filter.threatStatus = { $exists: true, $ne: null }
  }
  if (searchParams.has('invasive') && searchParams.get('invasive') === 'true') {
    filter['invasiveStatus.isInvasive'] = true
  }

  return filter
}

export async function GET({ request: { url } }: APIContext) {
  try {
    const searchParams = new URL(url).searchParams
    const filter = buildMongoFilter(searchParams)

    const db = await getMongoDatabase()
    const collection = db.collection('taxa')

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
    console.error('Error in /api/taxa/count:', error)
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
