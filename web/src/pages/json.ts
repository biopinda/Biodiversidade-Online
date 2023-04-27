import { getRawJson } from '../lib/json'

export async function get() {
  // set as file download
  return new Response(await getRawJson(), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="flora.json"'
    }
  })
}
