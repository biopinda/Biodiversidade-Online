import { getFamilyPerKingdom } from '@/lib/mongo'
import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ params }) => {
  const { kingdom } = params
  const data = await getFamilyPerKingdom(kingdom!)
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
