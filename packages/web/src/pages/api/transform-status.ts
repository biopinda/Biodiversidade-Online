/**
 * Transformation Status Endpoint
 * Returns current state of data transformation process
 *
 * GET /api/transform-status
 * Returns: { status, lastRun, nextScheduled, errorCount, message }
 */

import { getMongoDatabase } from '@/lib/mongo'
import { logger } from '@/lib/logger'
import type { APIContext } from 'astro'

interface TransformStatus {
  status: 'idle' | 'running' | 'failed' | 'success'
  lastRun?: string
  nextScheduled?: string
  duration?: number
  recordsProcessed?: number
  recordsError?: number
  errorCount: number
  message: string
}

export async function GET(context: APIContext): Promise<Response> {
  try {
    context.response.headers.set('Cache-Control', 'public, max-age=300')

    const db = await getMongoDatabase()
    const metricsCollection = db.collection('process_metrics')

    // Get latest transformation status
    const latestMetric = await metricsCollection
      .find({})
      .sort({ startTime: -1 })
      .limit(1)
      .toArray()

    if (latestMetric.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'idle',
          errorCount: 0,
          message: 'No transformation has been run yet'
        } as TransformStatus),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const metric = latestMetric[0]

    // Calculate next scheduled time (weekly, Monday at 04:00 UTC)
    const now = new Date()
    const nextMonday = new Date(now)
    nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7))
    nextMonday.setHours(4, 0, 0, 0)

    const status: TransformStatus = {
      status: metric.status === 'failed' ? 'failed' : metric.status || 'idle',
      lastRun: metric.endTime?.toISOString(),
      nextScheduled: nextMonday.toISOString(),
      duration: metric.duration,
      recordsProcessed: metric.recordsProcessed,
      recordsError: metric.recordsError,
      errorCount: metric.recordsError || 0,
      message:
        metric.status === 'success'
          ? 'Last transformation completed successfully'
          : metric.status === 'failed'
            ? `Transformation failed: ${metric.errorLog || 'Unknown error'}`
            : 'Transformation in progress'
    }

    logger.info('Transform status retrieved', {
      status: status.status,
      recordsProcessed: status.recordsProcessed
    })

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    logger.error(
      'Error fetching transformation status',
      error instanceof Error ? error : undefined,
      { endpoint: '/api/transform-status' }
    )

    return new Response(
      JSON.stringify({
        status: 'failed',
        errorCount: 1,
        message: 'Error fetching transformation status'
      } as TransformStatus),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
