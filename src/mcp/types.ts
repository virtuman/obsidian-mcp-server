/**
 * MCP server type definitions
 */
import { TextContent, Tool } from "@modelcontextprotocol/sdk/types.js";
import { BaseToolHandler } from "../tools/base.js";
import { TagResource } from "../resources/tags.js";

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
 * Default timeout configuration
 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  toolExecutionMs: parseInt(process.env.TOOL_TIMEOUT_MS ?? '60000') // 60 second default timeout
};