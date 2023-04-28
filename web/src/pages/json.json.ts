// export const prerender = true

import { listTaxa } from '../lib/mongo'

export async function get() {
  return new Response(JSON.stringify(await listTaxa()), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
