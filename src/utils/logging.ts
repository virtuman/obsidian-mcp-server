/**
 * Logging utilities for the Obsidian MCP Server
 */

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  includeTimestamps: boolean;
  includeLevel: boolean;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' 
    ? LogLevel.INFO 
    : LogLevel.DEBUG,
  includeTimestamps: true,
  includeLevel: true
};

/**
 * Simple logger for MCP server operations
 */
export class Logger {
  private config: LoggerConfig;

  constructor(
    private name: string, 
    config: Partial<LoggerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Internal method to format and output a log message
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (level > this.config.level) return;
    
    const parts: string[] = [];
    
    // Add timestamp if configured
    if (this.config.includeTimestamps) {
      parts.push(`[${new Date().toISOString()}]`);
    }
    
    // Add level if configured
    if (this.config.includeLevel) {
      const levelStr = LogLevel[level] || 'UNKNOWN';
      parts.push(`[${levelStr}]`);
    }
    
    // Add component name
    parts.push(`[${this.name}]`);
    
    // Add message
    parts.push(message);
    
    // Output to console
    const output = parts.join(' ');
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(output, ...args);
        break;
      case LogLevel.WARN:
        console.warn(output, ...args);
        break;
      case LogLevel.INFO:
        console.info(output, ...args);
        break;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
      default:
        console.debug(output, ...args);
        break;
    }
  }

  /**
   * Log an error message
   */
  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  /**
   * Log an info message
   */
  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  /**
   * Log a debug message
   */
  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * Log a trace message
   */
  trace(message: string, ...args: any[]): void {
    this.log(LogLevel.TRACE, message, ...args);
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
}

/**
 * Create and return a namespaced logger
 */
export function createLogger(name: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger(name, config);
}

// Create a global root logger
export const rootLogger = createLogger('mcp-server');