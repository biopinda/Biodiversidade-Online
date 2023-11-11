import type { APIContext } from 'astro'

export async function GET({ request: { url } }: APIContext) {
  const searchParams = new URL(url).searchParams
  const scientificName = searchParams.get('scientificName')
  let json: unknown = []
  if (scientificName) {
    json = await fetch(
      `https://api.gbif.org/v1/occurrence/search?scientificName=${scientificName}`
    ).then((res) => res.json())
  }
  return new Response(JSON.stringify(json), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
