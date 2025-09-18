import { getTree } from '../../lib/mongo.ts'

export async function GET() {
  return new Response(JSON.stringify(await getTree()), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
