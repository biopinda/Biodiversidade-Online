import { getMongoDatabase } from '@/lib/mongo'
import type { APIContext } from 'astro'
import { ObjectId } from 'mongodb'

export async function GET({ params }: APIContext) {
  try {
    const { occurrenceID } = params

    if (!occurrenceID) {
      return new Response(
        JSON.stringify({
          error: 'Bad request',
          message: 'occurrenceID parameter is required'
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
    const collection = db.collection('occurrences')

    // Try to find by _id, handling both ObjectId and string formats
    let occurrence = null
    if (ObjectId.isValid(occurrenceID)) {
      occurrence = await collection.findOne({ _id: new ObjectId(occurrenceID) })
    }
    if (!occurrence) {
      // Fallback to string search
      occurrence = await collection.findOne({ _id: occurrenceID } as any)
    }

    if (!occurrence) {
      return new Response(
        JSON.stringify({
          error: 'Not found',
          message: `Occurrence with ID '${occurrenceID}' not found`
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    return new Response(JSON.stringify(occurrence), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error in /api/occurrences/[occurrenceID]:', error)
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
