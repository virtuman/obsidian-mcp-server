/**
 * Standardized Logging System for the Obsidian MCP Server
 * 
 * This module provides structured logging capabilities aligned with MCP best practices.
 * It supports categorized errors, severity levels, context tracking, performance
 * monitoring, and secure logging patterns.
 * 
 * @module utils/logging
 */

import fs from "fs";
import path from "path";
import process from "process";
import winston from "winston";

/**
 * Error categories following MCP standards
 */
export enum ErrorCategoryType {
  CATEGORY_VALIDATION = 'VALIDATION',
  CATEGORY_AUTHENTICATION = 'AUTHENTICATION',
  CATEGORY_AUTHORIZATION = 'AUTHORIZATION',
  CATEGORY_BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  CATEGORY_DATA_ACCESS = 'DATA_ACCESS',
  CATEGORY_EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  CATEGORY_SYSTEM = 'SYSTEM',
  CATEGORY_UNKNOWN = 'UNKNOWN'
}

/**
 * Log levels aligned with MCP's ErrorSeverityLevel 
 */
export enum LogLevel {
  /** Critical errors that require immediate attention */
  ERROR = 0, 
  /** Potentially harmful situations that should be reviewed */
  WARN = 1, 
  /** General informational messages about system operation */
  INFO = 2,
  /** Detailed information for debugging purposes */
  DEBUG = 3,
  /** Highly detailed tracing information */
  TRACE = 4
}

/**
 * Maps LogLevel to MCP severity level for integration with MCP error handling
 */
export const logLevelToMcpSeverity = {
  [LogLevel.ERROR]: 3, // SEVERITY_ERROR
  [LogLevel.WARN]: 2,  // SEVERITY_WARN
  [LogLevel.INFO]: 1,  // SEVERITY_INFO
  [LogLevel.DEBUG]: 0, // SEVERITY_DEBUG
  [LogLevel.TRACE]: 0  // Also maps to SEVERITY_DEBUG
};

/**
 * Structured log entry interface that follows MCP standards
 */
export interface StructuredLogEntry {
  /** Timestamp when the log was created */
  timestamp: string;
  /** Log message */
  message: string;
  /** Component that generated the log */
  component: string;
  /** Log level */
  level: LogLevel;
  /** Optional context data for the log entry */
  context?: Record<string, unknown>;
  /** Optional error information */
  error?: StandardizedErrorObject;
  /** Optional processing time in milliseconds */
  processingTimeMs?: number;
}

/**
 * Standardized error object following MCP conventions
 */
export interface StandardizedErrorObject {
  /** Human-readable error message */
  errorMessage: string;
  /** Machine-readable error code */
  errorCode: string;
  /** System area affected by the error */
  errorCategory: ErrorCategoryType;
  /** How critical the error is */
  errorSeverity: LogLevel;
  /** When the error occurred */
  errorTimestamp: string;
  /** Additional relevant data */
  errorContext?: Record<string, unknown>;
  /** Stack trace if available */
  errorStack?: string;
}

/**
 * Winston-compatible log levels
 */
const winstonLogLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to display */
  level: LogLevel;
  /** Whether to include timestamps in log output */
  includeTimestamps: boolean;
  /** Whether to include level in log output */
  includeLevel: boolean;
  /** Whether to mask sensitive data in logs */
  maskSensitiveData: boolean;
  /** List of field names to consider sensitive */
  sensitiveFields: string[];
  /** Directory for log files */
  logDir?: string;
  /** Whether to log to files */
  files?: boolean;
  /** Custom file names for log files */
  fileNames?: {
    combined?: string;
    error?: string;
    warn?: string;
    info?: string;
    debug?: string;
  };
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' 
    ? LogLevel.INFO 
    : LogLevel.DEBUG,
  includeTimestamps: true,
  includeLevel: true,
  maskSensitiveData: true,
  sensitiveFields: ['password', 'token', 'secret', 'key', 'auth', 'credential'],
  logDir: "logs",
  files: true,
  fileNames: {
    combined: "combined.log",
    error: "error.log",
    warn: "warn.log",
    info: "info.log",
    debug: "debug.log"
  }
};

/**
 * Enhanced logger for MCP server operations with structured logging support
 * Implements file-based logging with zero console output
 */
export class Logger {
  private config: LoggerConfig;
  private timers: Map<string, number> = new Map();
  private logger: winston.Logger;

  /**
   * Creates a new logger instance
   * 
   * @param name - Component name for this logger
   * @param config - Optional configuration overrides
   */
  constructor(
    private name: string, 
    config: Partial<LoggerConfig> = {}
  ) {
    this.config = { 
      ...DEFAULT_CONFIG, 
      ...config,
      fileNames: {
        ...DEFAULT_CONFIG.fileNames,
        ...config.fileNames
      }
    };
    
    // Initialize logger with silent transport as fallback
    this.logger = winston.createLogger({
      levels: winstonLogLevels,
      defaultMeta: { component: this.name },
      transports: [
        // Silent transport to prevent "no transports" warning
        new winston.transports.Console({
          silent: true
        })
      ]
    });
    
    this.initializeLogger();
  }

  /**
   * Initialize or reinitialize the Winston logger
   */
  private initializeLogger(): void {
    if (this.config.files && this.config.logDir) {
      if (!fs.existsSync(this.config.logDir)) {
        try {
          fs.mkdirSync(this.config.logDir, { recursive: true });
        } catch (error) {
          // Silently continue - we have a silent transport as fallback
        }
      }
    }

    // Create log format
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );
    
    // Initialize transports array with a silent transport to avoid "no transports" warning
    const transports: winston.transport[] = [
      new winston.transports.Console({
        silent: true, // Silent transport that doesn't output logs
        format: logFormat
      })
    ];
    
    // Add file transports if enabled
    if (this.config.files && this.config.logDir) {
      try {
        const fileNames = this.config.fileNames || DEFAULT_CONFIG.fileNames;
        
        // Combined log file
        if (fileNames?.combined) {
          transports.push(new winston.transports.File({
            filename: path.join(this.config.logDir, fileNames.combined),
            format: logFormat
          }));
        }
        
        // Level-specific log files
        if (fileNames?.error) {
          transports.push(new winston.transports.File({
            filename: path.join(this.config.logDir, fileNames.error),
            level: 'error',
            format: logFormat
          }));
        }
        
        if (fileNames?.warn) {
          transports.push(new winston.transports.File({
            filename: path.join(this.config.logDir, fileNames.warn),
            level: 'warn',
            format: logFormat
          }));
        }
        
        if (fileNames?.info) {
          transports.push(new winston.transports.File({
            filename: path.join(this.config.logDir, fileNames.info),
            level: 'info',
            format: logFormat
          }));
        }
        
        if (fileNames?.debug) {
          transports.push(new winston.transports.File({
            filename: path.join(this.config.logDir, fileNames.debug),
            level: 'debug',
            format: logFormat
          }));
        }
      } catch (error) {
        // Silently continue with just the silent transport if file transports fail
      }
    }

    // Replace logger configuration
    this.logger.configure({
      levels: winstonLogLevels,
      level: LogLevel[this.config.level].toLowerCase(),
      defaultMeta: { component: this.name },
      transports
    });
  }

  /**
   * Maps internal LogLevel to Winston log level
   */
  private levelToWinstonLevel(level: LogLevel): string {
    const levelName = LogLevel[level].toLowerCase();
    return levelName === 'trace' ? 'debug' : levelName;
  }

  /**
   * Creates a standardized error object for MCP compatibility
   * 
   * @param message - Human-readable error description
   * @param code - Machine-readable error identifier
   * @param category - Type of error
   * @param context - Additional error context
   * @returns Standardized error object
   */
  createStandardizedError(
    message: string,
    code: string,
    category: ErrorCategoryType = ErrorCategoryType.CATEGORY_UNKNOWN,
    context?: Record<string, unknown>
  ): StandardizedErrorObject {
    return {
      errorMessage: message,
      errorCode: code,
      errorCategory: category,
      errorSeverity: LogLevel.ERROR,
      errorTimestamp: new Date().toISOString(),
      errorContext: context ? this.processSensitiveData(context) : undefined,
      errorStack: new Error().stack
    };
  }

  /**
   * Wraps an exception as a standardized error
   * 
   * @param error - Original error object
   * @param message - Optional override message
   * @param category - Error category
   * @returns Standardized error object
   */
  wrapExceptionAsStandardizedError(
    error: unknown,
    message?: string,
    category: ErrorCategoryType = ErrorCategoryType.CATEGORY_UNKNOWN
  ): StandardizedErrorObject {
    const errorObject = error instanceof Error ? error : new Error(String(error));
    
    return {
      errorMessage: message || errorObject.message,
      errorCode: errorObject.name || 'UNKNOWN_ERROR',
      errorCategory: category,
      errorSeverity: LogLevel.ERROR,
      errorTimestamp: new Date().toISOString(),
      errorStack: errorObject.stack
    };
  }

  /**
   * Masks sensitive data in objects before logging
   * 
   * @param data - Data object to process
   * @returns Processed data with sensitive fields masked
   */
  private processSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    if (!this.config.maskSensitiveData) return data;
    
    const result: Record<string, unknown> = {};
    const sensitiveFields = this.config.sensitiveFields;
    
    for (const [key, value] of Object.entries(data)) {
      // Check if key contains any sensitive field name
      const isSensitive = sensitiveFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      );
      
      if (isSensitive) {
        // Mask sensitive values
        result[key] = '********';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively process nested objects
        result[key] = this.processSensitiveData(value as Record<string, unknown>);
      } else {
        // Pass through non-sensitive values
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Internal method to log a message using Winston
   * 
   * @param level - Log level
   * @param message - Log message
   * @param context - Optional context data
   */
  private log(
    level: LogLevel, 
    message: string, 
    context?: Record<string, unknown>
  ): void {
    if (level > this.config.level) return;
    
    const winstonLevel = this.levelToWinstonLevel(level);
    const processedContext = context ? this.processSensitiveData(context) : undefined;
    
    this.logger.log(winstonLevel, message, { context: processedContext });
  }

  /**
   * Log an error message with optional error object and context
   * 
   * @param message - Error message
   * @param errorOrContext - Error object or context
   * @param context - Additional context
   */
  error(
    message: string, 
    errorOrContext?: Error | Record<string, unknown>,
    context?: Record<string, unknown>
  ): void {
    if (errorOrContext instanceof Error) {
      const errorObj = this.wrapExceptionAsStandardizedError(errorOrContext);
      const combinedContext = {
        ...(context || {}),
        error: errorObj
      };
      this.log(LogLevel.ERROR, message, combinedContext);
    } else {
      this.log(LogLevel.ERROR, message, errorOrContext || context);
    }
  }

  /**
   * Log a warning message
   * 
   * @param message - Warning message
   * @param context - Optional context data
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an info message
   * 
   * @param message - Info message
   * @param context - Optional context data
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a debug message
   * 
   * @param message - Debug message
   * @param context - Optional context data
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log a trace message
   * 
   * @param message - Trace message
   * @param context - Optional context data
   */
  trace(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.TRACE, message, context);
  }

  /**
   * Set the log level
   * 
   * @param level - New log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
    this.logger.level = this.levelToWinstonLevel(level);
  }

  /**
   * Start a timer for performance tracking
   * 
   * @param id - Timer identifier
   */
  startTimer(id: string): void {
    this.timers.set(id, performance.now());
  }

  /**
   * End a timer and log the elapsed time
   * 
   * @param id - Timer identifier
   * @param message - Log message prefix
   * @param level - Log level for the timing message
   */
  endTimer(
    id: string, 
    message: string = 'Operation completed', 
    level: LogLevel = LogLevel.DEBUG
  ): number {
    const startTime = this.timers.get(id);
    if (startTime === undefined) {
      this.warn(`Timer "${id}" does not exist`, { action: 'endTimer' });
      return 0;
    }
    
    const endTime = performance.now();
    const elapsedMs = endTime - startTime;
    
    this.log(level, `${message} in ${elapsedMs.toFixed(2)}ms`, {
      timerId: id,
      processingTimeMs: elapsedMs
    });
    
    this.timers.delete(id);
    return elapsedMs;
  }

  /**
   * Log the result of an operation with timing information
   * 
   * @param success - Whether the operation was successful
   * @param operation - Operation name
   * @param elapsedMs - Processing time in milliseconds
   * @param context - Optional operation context
   */
  logOperationResult(
    success: boolean,
    operation: string,
    elapsedMs: number,
    context?: Record<string, unknown>
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const status = success ? 'succeeded' : 'failed';
    
    this.log(level, `Operation ${operation} ${status}`, {
      ...(context || {}),
      operation,
      success,
      processingTimeMs: elapsedMs
    });
  }
}

/**
 * Create and return a namespaced logger
 * 
 * @param name - Component name for the logger
 * @param config - Optional configuration overrides
 * @returns Configured logger instance
 */
export function createLogger(
  name: string, 
  config?: Partial<LoggerConfig>
): Logger {
  return new Logger(name, config);
}

// Create a global root logger
export const rootLogger = createLogger('obsidian-mcp-server', {
  files: true,
  logDir: "logs"
});