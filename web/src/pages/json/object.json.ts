export const prerender = true

import { getRawJson } from '../../lib/json.ts'

export async function get() {
  return {
    body: await getRawJson()
  }
}
