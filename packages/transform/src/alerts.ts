/**
 * Transformation Alerts and Monitoring
 * Monitors transformation processes and triggers alerts
 */

import { logger } from '@/lib/logger'

export interface TransformationMetrics {
  duration: number // milliseconds
  recordsProcessed: number
  recordsError: number
  errorRate: number // percentage
  startTime: Date
  endTime: Date
}

export interface AlertCondition {
  name: string
  check: (metrics: TransformationMetrics) => boolean
  severity: 'info' | 'warning' | 'critical'
  message: (metrics: TransformationMetrics) => string
}

/**
 * Default alert conditions
 */
export const DEFAULT_ALERTS: AlertCondition[] = [
  {
    name: 'TIMEOUT',
    check: (m) => m.duration > 2 * 60 * 60 * 1000, // 2 hours
    severity: 'critical',
    message: () => 'Transformation timeout (>2 hours)'
  },
  {
    name: 'HIGH_ERROR_RATE',
    check: (m) => m.errorRate > 5, // 5%
    severity: 'critical',
    message: (m) =>
      `High error rate: ${m.errorRate.toFixed(2)}% (${m.recordsError}/${m.recordsProcessed})`
  },
  {
    name: 'MODERATE_ERROR_RATE',
    check: (m) => m.errorRate > 1, // 1%
    severity: 'warning',
    message: (m) =>
      `Moderate error rate: ${m.errorRate.toFixed(2)}% (${m.recordsError}/${m.recordsProcessed})`
  },
  {
    name: 'NO_RECORDS_PROCESSED',
    check: (m) => m.recordsProcessed === 0,
    severity: 'critical',
    message: () => 'No records processed in transformation'
  },
  {
    name: 'SLOW_PROCESSING',
    check: (m) => m.duration > 90 * 60 * 1000, // 90 minutes
    severity: 'warning',
    message: (m) =>
      `Slow transformation: ${Math.floor(m.duration / 60000)} minutes`
  }
]

/**
 * Check metrics against alert conditions
 */
export function checkAlerts(
  metrics: TransformationMetrics,
  conditions: AlertCondition[] = DEFAULT_ALERTS
): AlertCondition[] {
  const triggeredAlerts = conditions.filter((condition) => {
    const triggered = condition.check(metrics)
    if (triggered) {
      const message = condition.message(metrics)
      logger.warn(`Alert triggered: ${condition.name}`, {
        severity: condition.severity,
        message,
        duration: metrics.duration,
        errorRate: metrics.errorRate,
        recordsProcessed: metrics.recordsProcessed,
        recordsError: metrics.recordsError
      })
    }
    return triggered
  })

  return triggeredAlerts
}

/**
 * Generate alert report
 */
export function generateAlertReport(
  metrics: TransformationMetrics,
  triggeredAlerts: AlertCondition[]
): string {
  const lines = [
    '=== Transformation Alert Report ===',
    `Duration: ${Math.floor(metrics.duration / 1000)}s`,
    `Records Processed: ${metrics.recordsProcessed}`,
    `Records Error: ${metrics.recordsError}`,
    `Error Rate: ${metrics.errorRate.toFixed(2)}%`,
    ''
  ]

  if (triggeredAlerts.length === 0) {
    lines.push('✓ No alerts triggered')
  } else {
    lines.push(`⚠ ${triggeredAlerts.length} alert(s) triggered:`)
    triggeredAlerts.forEach((alert) => {
      lines.push(`  - [${alert.severity.toUpperCase()}] ${alert.name}`)
      lines.push(`    ${alert.message(metrics)}`)
    })
  }

  return lines.join('\n')
}

/**
 * Send alert notification (stub - implement with your notification service)
 */
export async function sendAlert(
  condition: AlertCondition,
  metrics: TransformationMetrics
): Promise<void> {
  const message = condition.message(metrics)

  logger.warn(`Sending alert notification: ${condition.name}`, {
    severity: condition.severity,
    message,
    metrics
  })

  // TODO: Implement actual notification service
  // - Email notifications
  // - Slack webhooks
  // - GitHub issue creation
  // - PagerDuty integration
}

/**
 * Send alert notifications for all triggered alerts
 */
export async function sendAlertNotifications(
  triggeredAlerts: AlertCondition[],
  metrics: TransformationMetrics
): Promise<void> {
  for (const alert of triggeredAlerts) {
    await sendAlert(alert, metrics)
  }
}

/**
 * Calculate metrics from transformation result
 */
export function calculateMetrics(
  startTime: Date,
  endTime: Date,
  recordsProcessed: number,
  recordsError: number
): TransformationMetrics {
  const duration = endTime.getTime() - startTime.getTime()
  const errorRate =
    recordsProcessed > 0 ? (recordsError / recordsProcessed) * 100 : 0

  return {
    duration,
    recordsProcessed,
    recordsError,
    errorRate,
    startTime,
    endTime
  }
}
