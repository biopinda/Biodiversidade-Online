import { getRawJson } from '../../lib/json.ts'

export async function get() {
  return new Response(await getRawJson(), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="flora.object.json"'
    }
  })
}
