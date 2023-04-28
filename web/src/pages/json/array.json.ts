export const prerender = true

import { getJson } from '../../lib/json.ts'

export async function get() {
  return { body: JSON.stringify(Object.values(await getJson())) }
}
