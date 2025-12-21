/**
 * Dashboard Summary API Endpoint
 * Returns key statistics for the Analytic Dashboard
 *
 * GET /api/dashboard/summary
 * Returns: { totalSpecies, threatenedCount, invasiveCount, totalOccurrences, lastUpdated }
 */

import { getMongoDatabase } from '@/lib/mongo'
import { logger } from '@/lib/logger'
import type { APIContext } from 'astro'

interface DashboardSummary {
  totalSpecies: number
  threatenedCount: number
  invasiveCount: number
  totalOccurrences: number
  lastUpdated: string
}

export async function GET(context: APIContext): Promise<Response> {
  try {
    // Set cache headers for 1 hour
    context.response.headers.set('Cache-Control', 'public, max-age=3600')

    const db = await getMongoDatabase()

    // Get taxa statistics
    const taxaCollection = db.collection('taxa')
    const occurrencesCollection = db.collection('occurrences')

    const [totalSpecies, threatenedCount, invasiveCount, totalOccurrences] =
      await Promise.all([
        taxaCollection.countDocuments(),
        taxaCollection.countDocuments({ threatStatus: 'threatened' }),
        taxaCollection.countDocuments({ invasiveStatus: 'invasive' }),
        occurrencesCollection.countDocuments()
      ])

    const summary: DashboardSummary = {
      totalSpecies,
      threatenedCount,
      invasiveCount,
      totalOccurrences,
      lastUpdated: new Date().toISOString()
    }

    logger.info('Dashboard summary retrieved', {
      totalSpecies,
      threatenedCount,
      invasiveCount,
      totalOccurrences
    })

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    logger.error(
      'Error fetching dashboard summary',
      error instanceof Error ? error : undefined,
      { endpoint: '/api/dashboard/summary' }
    )

    return new Response(
      JSON.stringify({
        status: 500,
        message: 'Error fetching dashboard summary',
        code: 'DASHBOARD_ERROR'
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
