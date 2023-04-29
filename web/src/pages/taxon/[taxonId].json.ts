import { getTaxon } from '../../lib/mongo'

type Params = {
  taxonId: string
}
export async function get({ params: { taxonId } }: { params: Params }) {
  const taxon = await getTaxon(taxonId)
  return new Response(JSON.stringify(taxon, null, 2), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
