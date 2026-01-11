/**
 * Comprehensive Logging Utility for AI-Agent Debugging
 *
 * This logger provides structured, contextual logging that helps AI agents
 * quickly identify and understand errors in the system.
 *
 * Design Principles:
 * - Single Responsibility: Each log level has a specific purpose
 * - Open/Closed: Easy to extend with new log levels or outputs
 * - Dependency Inversion: Depends on abstractions (LogLevel enum)
 */

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    FATAL = 'FATAL',
}

export enum LogCategory {
    AUDIO = 'AUDIO',
    VIDEO = 'VIDEO',
    EXPORT = 'EXPORT',
    UI = 'UI',
    STATE = 'STATE',
    NETWORK = 'NETWORK',
    FILESYSTEM = 'FILESYSTEM',
    PERFORMANCE = 'PERFORMANCE',
}

interface LogContext {
    timestamp: string;
    level: LogLevel;
    category: LogCategory;
    operation: string;
    message: string;
    data?: Record<string, any>;
    error?: Error;
    stackTrace?: string;
    userId?: string;
    sessionId?: string;
}

interface LoggerConfig {
    minLevel: LogLevel;
    enableConsole: boolean;
    enableRemote: boolean;
    remoteEndpoint?: string;
}

class Logger {
    private config: LoggerConfig;
    private sessionId: string;
    private logBuffer: LogContext[] = [];
    private readonly MAX_BUFFER_SIZE = 100;

    constructor(config: Partial<LoggerConfig> = {}) {
        this.config = {
            minLevel: LogLevel.DEBUG,
            enableConsole: true,
            enableRemote: false,
            ...config,
        };
        this.sessionId = this.generateSessionId();
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private shouldLog(level: LogLevel): boolean {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
        return levels.indexOf(level) >= levels.indexOf(this.config.minLevel);
    }

    private formatLogContext(context: LogContext): string {
        const { timestamp, level, category, operation, message, data, error } = context;

        let formattedLog = `[${timestamp}] [${level}] [${category}] ${operation}: ${message}`;

        if (data && Object.keys(data).length > 0) {
            formattedLog += `\n  Data: ${JSON.stringify(data, null, 2)}`;
        }

        if (error) {
            formattedLog += `\n  Error: ${error.name} - ${error.message}`;
            if (error.stack) {
                formattedLog += `\n  Stack: ${error.stack}`;
            }
        }

        return formattedLog;
    }

    private log(
        level: LogLevel,
        category: LogCategory,
        operation: string,
        message: string,
        data?: Record<string, any>,
        error?: Error
    ): void {
        if (!this.shouldLog(level)) return;

        const context: LogContext = {
            timestamp: new Date().toISOString(),
            level,
            category,
            operation,
            message,
            data,
            error,
            stackTrace: error?.stack,
            sessionId: this.sessionId,
        };

        // Add to buffer
        this.logBuffer.push(context);
        if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
            this.logBuffer.shift();
        }

        // Console output
        if (this.config.enableConsole) {
            const formattedLog = this.formatLogContext(context);

            switch (level) {
                case LogLevel.DEBUG:
                    console.debug(formattedLog);
                    break;
                case LogLevel.INFO:
                    console.info(formattedLog);
                    break;
                case LogLevel.WARN:
                    console.warn(formattedLog);
                    break;
                case LogLevel.ERROR:
                case LogLevel.FATAL:
                    console.error(formattedLog);
                    break;
            }
        }

        // Remote logging (for production)
        if (this.config.enableRemote && this.config.remoteEndpoint) {
            this.sendToRemote(context).catch(err => {
                console.error('Failed to send log to remote endpoint:', err);
            });
        }
    }

    private async sendToRemote(context: LogContext): Promise<void> {
        if (!this.config.remoteEndpoint) return;

        try {
            await fetch(this.config.remoteEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(context),
            });
        } catch (error) {
            // Silent fail - don't want logging to break the app
        }
    }

    /**
     * DEBUG: Detailed information for diagnosing problems
     * Use for: Variable values, state changes, function entry/exit
     */
    debug(category: LogCategory, operation: string, message: string, data?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, category, operation, message, data);
    }

    /**
     * INFO: General informational messages
     * Use for: Successful operations, state transitions, milestones
     */
    info(category: LogCategory, operation: string, message: string, data?: Record<string, any>): void {
        this.log(LogLevel.INFO, category, operation, message, data);
    }

    /**
     * WARN: Warning messages for potentially harmful situations
     * Use for: Deprecated features, performance issues, recoverable errors
     */
    warn(category: LogCategory, operation: string, message: string, data?: Record<string, any>): void {
        this.log(LogLevel.WARN, category, operation, message, data);
    }

    /**
     * ERROR: Error events that might still allow the app to continue
     * Use for: Expected errors, validation failures, user input errors
     */
    error(category: LogCategory, operation: string, message: string, error?: Error, data?: Record<string, any>): void {
        this.log(LogLevel.ERROR, category, operation, message, data, error);
    }

    /**
     * FATAL: Severe errors causing premature termination
     * Use for: Unrecoverable errors, critical system failures
     */
    fatal(category: LogCategory, operation: string, message: string, error?: Error, data?: Record<string, any>): void {
        this.log(LogLevel.FATAL, category, operation, message, data, error);
    }

    /**
     * Get recent logs for debugging
     */
    getRecentLogs(count: number = 50): LogContext[] {
        return this.logBuffer.slice(-count);
    }

    /**
     * Export logs for bug reports
     */
    exportLogs(): string {
        return JSON.stringify(this.logBuffer, null, 2);
    }

    /**
     * Clear log buffer
     */
    clearLogs(): void {
        this.logBuffer = [];
    }

    /**
     * Performance measurement utility
     */
    measurePerformance<T>(
        category: LogCategory,
        operation: string,
        fn: () => T | Promise<T>
    ): T | Promise<T> {
        const startTime = performance.now();

        try {
            const result = fn();

            if (result instanceof Promise) {
                return result.then(
                    (value) => {
                        const duration = performance.now() - startTime;
                        this.info(LogCategory.PERFORMANCE, operation, `Completed in ${duration.toFixed(2)}ms`, {
                            duration,
                            success: true,
                        });
                        return value;
                    },
                    (error) => {
                        const duration = performance.now() - startTime;
                        this.error(LogCategory.PERFORMANCE, operation, `Failed after ${duration.toFixed(2)}ms`, error, {
                            duration,
                            success: false,
                        });
                        throw error;
                    }
                ) as Promise<T>;
            } else {
                const duration = performance.now() - startTime;
                this.info(LogCategory.PERFORMANCE, operation, `Completed in ${duration.toFixed(2)}ms`, {
                    duration,
                    success: true,
                });
                return result;
            }
        } catch (error) {
            const duration = performance.now() - startTime;
            this.error(LogCategory.PERFORMANCE, operation, `Failed after ${duration.toFixed(2)}ms`, error as Error, {
                duration,
                success: false,
            });
            throw error;
        }
    }
}

// Singleton instance
export const logger = new Logger({
    minLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
    enableConsole: true,
    enableRemote: false, // Enable in production with proper endpoint
});

// Helper function for creating scoped loggers
export function createScopedLogger(defaultCategory: LogCategory, defaultOperation: string) {
    return {
        debug: (message: string, data?: Record<string, any>) =>
            logger.debug(defaultCategory, defaultOperation, message, data),
        info: (message: string, data?: Record<string, any>) =>
            logger.info(defaultCategory, defaultOperation, message, data),
        warn: (message: string, data?: Record<string, any>) =>
            logger.warn(defaultCategory, defaultOperation, message, data),
        error: (message: string, error?: Error, data?: Record<string, any>) =>
            logger.error(defaultCategory, defaultOperation, message, error, data),
        fatal: (message: string, error?: Error, data?: Record<string, any>) =>
            logger.fatal(defaultCategory, defaultOperation, message, error, data),
    };
}
