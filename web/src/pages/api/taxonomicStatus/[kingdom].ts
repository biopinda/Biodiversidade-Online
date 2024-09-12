import type { APIRoute } from 'astro'
import { getTaxonomicStatusPerKingdom } from '../../../lib/mongo'

export const GET: APIRoute = async ({ params }) => {
  const { kingdom } = params
  const data = await getTaxonomicStatusPerKingdom(kingdom!)
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
