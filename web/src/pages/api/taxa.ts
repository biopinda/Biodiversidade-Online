import type { APIContext } from 'astro'
import { listTaxa } from '../../lib/mongo'

export async function get({ request: { url } }: APIContext) {
  const searchParams = new URL(url).searchParams
  const filter = Object.fromEntries(searchParams.entries())
  return new Response(JSON.stringify(await listTaxa(filter)), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
