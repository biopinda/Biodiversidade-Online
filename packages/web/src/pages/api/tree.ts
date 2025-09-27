import { getTree } from '../../lib/mongo'

export async function GET() {
  return new Response(JSON.stringify(await getTree()), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
