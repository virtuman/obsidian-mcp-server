/**
 * MCP server request handlers
 */
import {
  Tool,
  TextContent,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ObsidianError } from "../utils/errors.js";
import { validateToolArguments } from "../utils/validation.js";
import { rateLimiter } from "../utils/rate-limiting.js";
import { createLogger } from "../utils/logging.js";
import { DEFAULT_TIMEOUT_CONFIG } from "./types.js";
import { BaseToolHandler } from "../tools/base.js";

// Create a logger for request handlers
const logger = createLogger('McpHandlers');

/**
 * Set up tool listing handler
 * @param server The MCP server instance
 * @param toolHandlers The tool handlers to register
 */
export function setupToolListingHandler(
  server: Server,
  toolHandlers: Map<string, BaseToolHandler<any>>
): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('Handling ListToolsRequest');
    const tools: Tool[] = [];
    for (const handler of toolHandlers.values()) {
      tools.push(handler.getToolDescription());
    }
    return { tools };
  });
}

/**
 * Set up tool calling handler
 * @param server The MCP server instance
 * @param toolHandlers The tool handlers to register
 */
export function setupToolCallingHandler(
  server: Server,
  toolHandlers: Map<string, BaseToolHandler<any>>
): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.debug(`Handling CallToolRequest for tool: ${name}`);

    const handler = toolHandlers.get(name);
    if (!handler) {
      logger.error(`Unknown tool requested: ${name}`);
      throw new ObsidianError(`Unknown tool: ${name}`, 40400); // 40400 = Not found
    }

    // Check rate limit
    try {
      rateLimiter.enforceRateLimit(name);
    } catch (error) {
      // If rate limit is exceeded, log and rethrow the error
      logger.warn(`Rate limit exceeded for tool: ${name}`);
      throw error;
    }

    // Add timeout handling
    const timeoutMs = DEFAULT_TIMEOUT_CONFIG.toolExecutionMs;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new ObsidianError(`Tool execution timed out after ${timeoutMs}ms`, 40800)); // 40800 = Request timeout
      }, timeoutMs);
    });

    try {
      // Validate arguments against tool's schema
      const toolDescription = handler.getToolDescription();
      const validationResult = validateToolArguments(args, toolDescription.inputSchema);
      if (!validationResult.valid) {
        logger.error(`Invalid tool arguments for ${name}:`, validationResult.errors);
        throw new ObsidianError(
          `Invalid tool arguments: ${validationResult.errors.join(', ')}`,
          40000 // 40000 = Bad request
        );
      }

      // Log the tool execution
      logger.info(`Executing tool: ${name}`);

      // Race between tool execution and timeout
      const content = await Promise.race([
        handler.runTool(args),
        timeoutPromise
      ]);
      
      logger.debug(`Tool execution completed successfully: ${name}`);
      
      return { content };
    } catch (error) {
      if (error instanceof ObsidianError) {
        // Check if the operation actually succeeded despite the error
        if (error.errorCode === 20400) { // 20400 = Success with no content
          return {
            content: [{
              type: "text",
              text: "Operation completed successfully"
            }]
          };
        }
        throw error;
      }
      
      // Enhanced error logging
      logger.error("Tool execution error:", {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        toolName: name
      });

      if (error instanceof Error) {
        throw new ObsidianError(
          `Tool '${name}' execution failed: ${error.message}`,
          50000, // 50000 = Internal server error
          { originalError: error.stack }
        );
      }
      
      throw new ObsidianError(
        "Tool execution failed with unknown error",
        50000, // 50000 = Internal server error
        { error }
      );
    }
  });
}

/**
 * Set up resource listing handler
 * @param server The MCP server instance
 * @param resources The resources to register
 */
export function setupResourceListingHandler(
  server: Server,
  resources: Record<string, any>
): void {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    logger.debug('Handling ListResourcesRequest');
    return {
      resources: Object.values(resources).map(resource => 
        resource.getResourceDescription())
    };
  });
}

/**
 * Set up resource reading handler
 * @param server The MCP server instance
 * @param resources The resources to register
 */
export function setupResourceReadingHandler(
  server: Server,
  resources: Record<string, any>
): void {
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    logger.debug(`Handling ReadResourceRequest for URI: ${uri}`);
    
    const resource = resources[uri];
    if (resource) {
      logger.debug(`Found resource for URI: ${uri}`);
      return {
        contents: await resource.getContent()
      };
    }
    
    logger.error(`Resource not found: ${uri}`);
    throw new ObsidianError(`Resource not found: ${uri}`, 40400); // 40400 = Not found
  });
}