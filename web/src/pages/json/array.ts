import { getJson } from '../../lib/json'

export async function get() {
  return new Response(JSON.stringify(Object.values(await getJson())), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="flora.array.json"'
    }
  })
}
