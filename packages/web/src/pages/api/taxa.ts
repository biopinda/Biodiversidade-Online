import type { APIContext } from 'astro'
import { listTaxaPaginated } from '../../lib/mongo.ts'

export async function GET({ request: { url } }: APIContext) {
  const searchParams = new URL(url).searchParams
  const filter = Object.fromEntries(
    Array.from(searchParams.entries()).map(([key, value]) => {
      if (key.endsWith('[]')) {
        return [key.slice(0, -2), [value.split(',')]]
      }
      if (value.startsWith('[') || value.startsWith('{')) {
        return [key, JSON.parse(value)]
      }
      return [key, value]
    })
  )
  if (filter.scientificName) {
    filter.scientificName = new RegExp(filter.scientificName, 'i')
  }

  return new Response(JSON.stringify(await listTaxaPaginated(filter)), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
