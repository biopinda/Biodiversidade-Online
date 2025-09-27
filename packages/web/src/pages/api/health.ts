import type { APIRoute } from 'astro'
import { getCollection } from '@/lib/mongo'

export const GET: APIRoute = async () => {
  try {
    // Test MongoDB connection
    const taxa = await getCollection('dwc2json', 'taxa')
    const mongoStatus = taxa ? 'healthy' : 'unavailable'

    const healthCheck = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoStatus
      }
    }

    const statusCode = mongoStatus === 'healthy' ? 200 : 503

    return new Response(JSON.stringify(healthCheck), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    console.error('Health check failed:', error)

    return new Response(
      JSON.stringify({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        services: {
          mongodb: 'error'
        }
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    )
  }
}
