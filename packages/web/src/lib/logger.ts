/**
 * Structured Logging Utility
 * Provides consistent logging across the application
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  code?: string
  dataSource?: string
  context?: Record<string, unknown>
  error?: string
}

class Logger {
  private isDevelopment: boolean

  constructor() {
    this.isDevelopment =
      typeof process !== 'undefined' && process.env.NODE_ENV === 'development'
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    }
  }

  private output(entry: LogEntry): void {
    const logMessage = [
      `[${entry.timestamp}]`,
      `[${entry.level}]`,
      entry.message
    ]

    if (entry.code) {
      logMessage.push(`(${entry.code})`)
    }

    if (entry.dataSource) {
      logMessage.push(`[source: ${entry.dataSource}]`)
    }

    if (entry.context && Object.keys(entry.context).length > 0) {
      logMessage.push(JSON.stringify(entry.context))
    }

    const logText = logMessage.join(' ')

    switch (entry.level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.log(logText)
        }
        break
      case LogLevel.INFO:
        console.log(logText)
        break
      case LogLevel.WARN:
        console.warn(logText)
        break
      case LogLevel.ERROR:
        console.error(logText)
        if (entry.error) {
          console.error('Stack trace:', entry.error)
        }
        break
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.output(this.formatEntry(LogLevel.DEBUG, message, context))
  }

  info(
    message: string,
    context?: Record<string, unknown>,
    dataSource?: string
  ): void {
    const entry = this.formatEntry(LogLevel.INFO, message, context)
    entry.dataSource = dataSource
    this.output(entry)
  }

  warn(
    message: string,
    context?: Record<string, unknown>,
    code?: string
  ): void {
    const entry = this.formatEntry(LogLevel.WARN, message, context)
    entry.code = code
    this.output(entry)
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    const entry = this.formatEntry(LogLevel.ERROR, message, context)
    if (error) {
      entry.error = error.stack
    }
    this.output(entry)
  }
}

export const logger = new Logger()
