import { getMongoDatabase } from '@/lib/mongo'
import type { APIContext } from 'astro'
import { ObjectId } from 'mongodb'

export async function GET({ params }: APIContext) {
  try {
    const { taxonID } = params

    if (!taxonID) {
      return new Response(
        JSON.stringify({
          error: 'Bad request',
          message: 'taxonID parameter is required'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    const db = await getMongoDatabase()
    const collection = db.collection('taxa')

    // Try to find by _id, handling both ObjectId and string formats
    let taxon = null
    if (ObjectId.isValid(taxonID)) {
      taxon = await collection.findOne({ _id: new ObjectId(taxonID) })
    }
    if (!taxon) {
      // Fallback to string search
      taxon = await collection.findOne({ _id: taxonID } as any)
    }

    if (!taxon) {
      return new Response(
        JSON.stringify({
          error: 'Not found',
          message: `Taxon with ID '${taxonID}' not found`
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    return new Response(JSON.stringify(taxon), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error in /api/taxa/[taxonID]:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }
}
