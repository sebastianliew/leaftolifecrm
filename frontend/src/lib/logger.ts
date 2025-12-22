import { format } from 'date-fns'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: string
  data?: unknown
  error?: Error
}

export interface LoggerConfig {
  enableConsole: boolean
  enableRemote: boolean
  minLevel: LogLevel
  context?: string
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class Logger {
  private config: LoggerConfig = {
    enableConsole: process.env.NODE_ENV !== 'production',
    enableRemote: process.env.NODE_ENV === 'production',
    minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  }

  private queue: LogEntry[] = []
  private isFlushScheduled = false

  constructor(context?: string) {
    if (context) {
      this.config.context = context
    }
  }

  setConfig(config: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...config }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel]
  }

  private formatMessage(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
    ]

    if (entry.context) {
      parts.push(`[${entry.context}]`)
    }

    parts.push(entry.message)

    return parts.join(' ')
  }

  private log(level: LogLevel, message: string, data?: unknown) {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      level,
      message,
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
      context: this.config.context,
      data,
    }

    if (data instanceof Error) {
      entry.error = data
      entry.data = {
        message: data.message,
        stack: data.stack,
        name: data.name,
      }
    }

    // Console output in development
    if (this.config.enableConsole) {
      const formattedMessage = this.formatMessage(entry)
      // eslint-disable-next-line no-console
      const consoleMethod = console[level] || console.log

      if (data !== undefined) {
        consoleMethod(formattedMessage, data)
      } else {
        consoleMethod(formattedMessage)
      }
    }

    // Queue for remote logging in production
    if (this.config.enableRemote) {
      this.queue.push(entry)
      this.scheduleFlush()
    }
  }

  private scheduleFlush() {
    if (this.isFlushScheduled) return

    this.isFlushScheduled = true
    setTimeout(() => {
      this.flush()
      this.isFlushScheduled = false
    }, 1000)
  }

  private async flush() {
    if (this.queue.length === 0) return

    const entries = [...this.queue]
    this.queue = []

    try {
      // TODO: Implement remote logging service integration
      // For now, we'll just log to console in production
      if (process.env.NODE_ENV === 'production') {
        entries.forEach(entry => {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(entry))
        })
      }
    } catch (error) {
      // Fallback to console if remote logging fails
      console.error('Failed to send logs to remote service:', error)
      entries.forEach(entry => {
        // eslint-disable-next-line no-console
        console.log(this.formatMessage(entry), entry.data)
      })
    }
  }

  debug(message: string, data?: unknown) {
    this.log('debug', message, data)
  }

  info(message: string, data?: unknown) {
    this.log('info', message, data)
  }

  warn(message: string, data?: unknown) {
    this.log('warn', message, data)
  }

  error(message: string, error?: Error | unknown) {
    this.log('error', message, error)
  }

  // Create a child logger with additional context
  child(context: string): Logger {
    const childLogger = new Logger(
      this.config.context ? `${this.config.context}:${context}` : context
    )
    childLogger.setConfig(this.config)
    return childLogger
  }

  // Utility method for timing operations
  time(label: string): () => void {
    const start = Date.now()
    return () => {
      const duration = Date.now() - start
      this.debug(`${label} took ${duration}ms`)
    }
  }

  // Utility method for logging async operations
  async withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const endTimer = this.time(label)
    try {
      const result = await fn()
      endTimer()
      return result
    } catch (error) {
      endTimer()
      this.error(`${label} failed`, error as Error)
      throw error
    }
  }
}

// Export a default logger instance
export const logger = new Logger()

// Export a factory function for creating contextual loggers
export function createLogger(context: string): Logger {
  return new Logger(context)
}

// Export the Logger class for testing
export { Logger }