import type { APIContext } from 'astro'

import { getOccurrencePlot } from '@/lib/queries.ts'

export async function GET({ request: { url } }: APIContext) {
  const searchParams = new URL(url).searchParams
  const [canonicalName, lat, long, maxDistance] = [
    searchParams.get('canonicalName') ?? '',
    searchParams.get('lat'),
    searchParams.get('long'),
    searchParams.get('maxDistance')
  ]
  const data = await getOccurrencePlot({
    canonicalName,
    ...(lat && long ? { lat: +lat, long: +long } : {}),
    ...(maxDistance ? { maxDistance: +maxDistance } : {})
  })
  if (!data) {
    return new Response(
      'Either canonicalName or Latitude and longitude are required',
      {
        status: 400
      }
    )
  }

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
