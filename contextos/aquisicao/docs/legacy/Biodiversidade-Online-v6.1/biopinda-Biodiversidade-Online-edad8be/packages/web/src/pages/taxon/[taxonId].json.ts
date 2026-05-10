import { getTaxon } from '@/lib/mongo'

type Params = {
  taxonId: string
}
export async function GET({ params: { taxonId } }: { params: Params }) {
  const [kingdomId, id] = [taxonId[0], taxonId.slice(1)]
  const kingdom = {
    P: 'Plantae',
    F: 'Fungi',
    A: 'Animalia'
  }[kingdomId as string] as Parameters<typeof getTaxon>[0] | undefined

  const taxon = kingdom && (await getTaxon(kingdom, id))

  if (!taxon) {
    return new Response('Not found', { status: 404 })
  }

  return new Response(JSON.stringify(taxon, null, 2), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
