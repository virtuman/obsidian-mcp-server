/**
 * MCP server type definitions
 */
import { TextContent, Tool } from "@modelcontextprotocol/sdk/types.js";
import { BaseToolHandler } from "../tools/base.js";
import { TagResource } from "../resources/tags.js";
import { ErrorCategoryType, LogLevel, StandardizedErrorObject } from "../utils/logging.js";

/**
 * MCP server configuration
 */
export interface McpServerConfig extends Record<string, unknown> {
  name: string;
  version: string;
}

/**
 * Timeout configuration for tool execution
 */
export interface TimeoutConfig {
  toolExecutionMs: number; // Default: 60000 (60 seconds)
}

/**
 * Map of resources by URI
 */
export interface ResourceMap {
  [uri: string]: {
    getContent(): Promise<TextContent[]>;
    getResourceDescription(): any;
  };
}

/**
 * Server capabilities configuration
 */
export interface ServerCapabilities {
  tools: Record<string, Tool>;
  resources: ResourceMap;
}

/**
 * Operation result interface following MCP best practices
 */
export interface OperationResultSuccess<DataType> {
  resultSuccessful: true;
  resultData: DataType;
}

export interface OperationResultFailure {
  resultSuccessful: false;
  resultError: StandardizedErrorObject;
}

export type OperationResult<DataType> = 
  | OperationResultSuccess<DataType>
  | OperationResultFailure;

/**
 * Error codes used in the MCP server
 */
export enum McpErrorCode {
  // Server errors (5xxxx)
  INTERNAL_SERVER_ERROR = 50000,
  SERVICE_UNAVAILABLE = 50300,
  TIMEOUT = 50800,
  
  // Client errors (4xxxx)
  BAD_REQUEST = 40000,
  UNAUTHORIZED = 40100,
  FORBIDDEN = 40300,
  NOT_FOUND = 40400,
  METHOD_NOT_ALLOWED = 40500,
  RATE_LIMIT_EXCEEDED = 40900,
  
  // Success with special handling
  SUCCESS_NO_CONTENT = 20400
}

/**
 * Default timeout configuration
 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  toolExecutionMs: parseInt(process.env.TOOL_TIMEOUT_MS ?? '60000') // 60 second default timeout
};

/**
 * Helper functions for creating operation results
 */
export function createSuccessResult<DataType>(data: DataType): OperationResultSuccess<DataType> {
  return { 
    resultSuccessful: true, 
    resultData: data 
  };
}

export function createFailureResult(
  message: string,
  code: string | McpErrorCode,
  category: ErrorCategoryType = ErrorCategoryType.CATEGORY_UNKNOWN,
  context?: Record<string, unknown>
): OperationResultFailure {
  return { 
    resultSuccessful: false, 
    resultError: {
      errorMessage: message,
      errorCode: typeof code === 'string' ? code : String(code),
      errorCategory: category,
      errorSeverity: LogLevel.ERROR,
      errorTimestamp: new Date().toISOString(),
      errorContext: context
    }
  };
}