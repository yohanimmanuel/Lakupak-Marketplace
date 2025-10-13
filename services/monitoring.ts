// Production monitoring and logging service
export interface LogEvent {
  level: 'info' | 'warn' | 'error'
  message: string
  data?: Record<string, unknown>
  timestamp: string
  userId?: number
}

export interface PerformanceMetric {
  operation: string
  duration: number
  timestamp: string
  userId?: number
}

class MonitoringService {
  private logs: LogEvent[] = []
  private metrics: PerformanceMetric[] = []
  private maxLogs = 100 // Keep last 100 logs in memory

  // Log events for debugging and monitoring
  log(level: LogEvent['level'], message: string, data?: Record<string, unknown>, userId?: number) {
    const event: LogEvent = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      userId,
    }
    
    this.logs.push(event)
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
    
    // In production, you would send this to your monitoring service
    if (__DEV__) {
    }
  }

  // Track performance metrics
  trackPerformance(operation: string, duration: number, userId?: number) {
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      userId,
    }
    
    this.metrics.push(metric)
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxLogs) {
      this.metrics = this.metrics.slice(-this.maxLogs)
    }
  }

  // Performance wrapper for async operations
  async trackAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    userId?: number
  ): Promise<T> {
    const start = Date.now()
    try {
      const result = await fn()
      const duration = Date.now() - start
      this.trackPerformance(operation, duration, userId)
      return result
    } catch (error) {
      const duration = Date.now() - start
      this.trackPerformance(operation, duration, userId)
      this.log('error', `Failed ${operation}`, error instanceof Error ? { message: error.message, stack: error.stack } : undefined, userId)
      throw error
    }
  }

  // Get recent logs for debugging
  getRecentLogs(count: number = 10): LogEvent[] {
    return this.logs.slice(-count)
  }

  // Get recent performance metrics
  getRecentMetrics(count: number = 10): PerformanceMetric[] {
    return this.metrics.slice(-count)
  }

  // Clear all logs and metrics
  clear() {
    this.logs = []
    this.metrics = []
  }
}

// Export singleton instance
export const monitoring = new MonitoringService()

// Convenience functions
export const logInfo = (message: string, data?: Record<string, unknown>, userId?: number) => 
  monitoring.log('info', message, data, userId)

export const logWarn = (message: string, data?: Record<string, unknown>, userId?: number) => 
  monitoring.log('warn', message, data, userId)

export const logError = (message: string, data?: Record<string, unknown>, userId?: number) => 
  monitoring.log('error', message, data, userId)

export const trackPerformance = (operation: string, duration: number, userId?: number) => 
  monitoring.trackPerformance(operation, duration, userId)

export const trackAsync = <T>(
  operation: string,
  fn: () => Promise<T>,
  userId?: number
): Promise<T> => monitoring.trackAsync(operation, fn, userId)
