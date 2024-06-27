import { getFamilyPerKingdom } from '../../../lib/mongo'

export const GET = async ({ params }) => {
  const { kingdom } = params
  const data = await getFamilyPerKingdom(kingdom)
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
