import { getTaxon } from '../../lib/mongo.ts'

type Params = {
  taxonId: string
}
export async function GET({ params: { taxonId } }: { params: Params }) {
  const taxon = await getTaxon(taxonId)
  return new Response(JSON.stringify(taxon, null, 2), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
