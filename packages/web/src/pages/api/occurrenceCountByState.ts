import type { APIRoute } from 'astro'
import { countOccurrenceRegions, type TaxaFilter } from '@/lib/mongo'

export const GET: APIRoute = async ({ url }) => {
  try {
    const params = url.searchParams
    const filter: TaxaFilter = {}

    for (const [key, value] of params.entries()) {
      if (value.trim()) {
        filter[key] = value.trim()
      }
    }

    const regions = await countOccurrenceRegions(filter)

    if (!regions) {
      return new Response(
        JSON.stringify({ error: 'Falha ao conectar ao banco de dados' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    return new Response(JSON.stringify(regions), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}