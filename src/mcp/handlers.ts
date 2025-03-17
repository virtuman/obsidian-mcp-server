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
import { 
  createLogger, 
  ErrorCategoryType
} from "../utils/logging.js";
import { 
  DEFAULT_TIMEOUT_CONFIG, 
  McpErrorCode,
  createFailureResult, 
  createSuccessResult
} from "./types.js";
import { BaseToolHandler } from "../tools/base.js";

// Create a logger for request handlers
const logger = createLogger('McpHandlers');

/**
 * Helper function to safely mask sensitive data
 */
function maskSensitiveData(data: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!data) return {};
  
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    const isSensitive = sensitiveFields.some(field => 
      key.toLowerCase().includes(field.toLowerCase())
    );
    
    if (isSensitive) {
      result[key] = '********';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = maskSensitiveData(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

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
    // Start performance timing
    logger.startTimer('list_tools');
    
    try {
      const tools: Tool[] = [];
      for (const handler of toolHandlers.values()) {
        tools.push(handler.getToolDescription());
      }
      
      // Log success and timing information
      const elapsedMs = logger.endTimer('list_tools', 'Listed tools');
      logger.logOperationResult(true, 'list_tools', elapsedMs, {
        toolCount: tools.length
      });
      
      return { tools };
    } catch (error) {
      // Log failure with timing information
      const elapsedMs = logger.endTimer('list_tools', 'Failed to list tools');
      logger.logOperationResult(false, 'list_tools', elapsedMs);
      logger.error('Failed to list available tools', error instanceof Error ? error : undefined);
      throw error;
    }
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
    const operationId = `call_tool_${name}_${Date.now()}`;
    logger.debug(`Handling CallToolRequest for tool: ${name}`, { 
      toolName: name,
      operationId
    });
    
    // Start performance timing
    logger.startTimer(operationId);
    
    // Handle unknown tool
    const handler = toolHandlers.get(name);
    if (!handler) {
      const errorInfo = {
        toolName: name,
        errorCode: McpErrorCode.NOT_FOUND,
        errorCategory: ErrorCategoryType.CATEGORY_VALIDATION
      };
      
      logger.error(`Unknown tool requested: ${name}`, errorInfo);
      const elapsedMs = logger.endTimer(operationId);
      logger.logOperationResult(false, 'call_tool', elapsedMs, errorInfo);
      
      throw new ObsidianError(
        `Unknown tool: ${name}`, 
        McpErrorCode.NOT_FOUND
      );
    }

    // Check rate limit
    try {
      rateLimiter.enforceRateLimit(name);
    } catch (error) {
      const errorInfo = {
        toolName: name,
        errorCode: McpErrorCode.RATE_LIMIT_EXCEEDED,
        errorCategory: ErrorCategoryType.CATEGORY_SYSTEM
      };
      
      logger.warn(`Rate limit exceeded for tool: ${name}`, errorInfo);
      const elapsedMs = logger.endTimer(operationId);
      logger.logOperationResult(false, 'call_tool', elapsedMs, errorInfo);
      
      throw new ObsidianError(
        `Rate limit exceeded for tool: ${name}`, 
        McpErrorCode.RATE_LIMIT_EXCEEDED
      );
    }

    // Add timeout handling
    const timeoutMs = DEFAULT_TIMEOUT_CONFIG.toolExecutionMs;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const errorInfo = {
          toolName: name,
          timeoutMs,
          errorCode: McpErrorCode.TIMEOUT,
          errorCategory: ErrorCategoryType.CATEGORY_SYSTEM
        };
        
        logger.error(`Tool execution timed out after ${timeoutMs}ms`, errorInfo);
        
        reject(new ObsidianError(
          `Tool execution timed out after ${timeoutMs}ms`, 
          McpErrorCode.TIMEOUT
        ));
      }, timeoutMs);
    });

    try {
      // Validate arguments against tool's schema
      const toolDescription = handler.getToolDescription();
      const validationResult = validateToolArguments(args, toolDescription.inputSchema);
      if (!validationResult.valid) {
        const errorInfo = { 
          toolName: name, 
          validationErrors: validationResult.errors,
          providedArgs: maskSensitiveData(args),
          errorCode: McpErrorCode.BAD_REQUEST,
          errorCategory: ErrorCategoryType.CATEGORY_VALIDATION
        };
        
        logger.error(`Invalid tool arguments for ${name}:`, errorInfo);
        const elapsedMs = logger.endTimer(operationId);
        logger.logOperationResult(false, 'call_tool', elapsedMs, errorInfo);
        
        throw new ObsidianError(
          `Invalid tool arguments: ${validationResult.errors.join(', ')}`, 
          McpErrorCode.BAD_REQUEST
        );
      }

      // Log the tool execution
      logger.info(`Executing tool: ${name}`, { 
        toolName: name,
        args: maskSensitiveData(args)
      });

      // Race between tool execution and timeout
      const content = await Promise.race([
        handler.runTool(args),
        timeoutPromise
      ]);
      
      // Log successful execution
      const elapsedMs = logger.endTimer(operationId);
      logger.logOperationResult(true, 'call_tool', elapsedMs, { 
        toolName: name,
        contentLength: content.reduce((sum, item) => {
          return sum + (item.type === 'text' ? item.text.length : 0);
        }, 0)
      });
      
      return { content };
    } catch (error) {
      // Handle ObsidianError
      if (error instanceof ObsidianError) {
        // Check if the operation actually succeeded despite the error
        if (error.errorCode === McpErrorCode.SUCCESS_NO_CONTENT) {
          const elapsedMs = logger.endTimer(operationId);
          logger.logOperationResult(true, 'call_tool', elapsedMs, { 
            toolName: name,
            status: 'success_no_content'
          });
          
          return {
            content: [{
              type: "text",
              text: "Operation completed successfully"
            }]
          };
        }
        
        // Log failure for other ObsidianErrors
        const errorInfo = {
          toolName: name,
          errorMessage: error.message,
          errorCode: error.errorCode,
          errorCategory: ErrorCategoryType.CATEGORY_BUSINESS_LOGIC,
          details: error.details ? JSON.stringify(error.details) : undefined
        };
        
        const elapsedMs = logger.endTimer(operationId);
        logger.logOperationResult(false, 'call_tool', elapsedMs, errorInfo);
        
        throw error;
      }
      
      // Enhanced error logging for other errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      const errorInfo = {
        toolName: name,
        errorMessage,
        errorStack,
        errorCategory: ErrorCategoryType.CATEGORY_SYSTEM
      };
      
      logger.error("Tool execution error:", errorInfo);
      const elapsedMs = logger.endTimer(operationId);
      logger.logOperationResult(false, 'call_tool', elapsedMs, errorInfo);

      throw new ObsidianError(
        `Tool '${name}' execution failed: ${errorMessage}`,
        McpErrorCode.INTERNAL_SERVER_ERROR,
        { originalError: errorMessage, stack: errorStack }
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
    // Start performance timing
    logger.startTimer('list_resources');
    
    try {
      const resourceList = Object.values(resources).map(resource => 
        resource.getResourceDescription());
      
      // Log success with timing information
      const elapsedMs = logger.endTimer('list_resources', 'Listed resources');
      logger.logOperationResult(true, 'list_resources', elapsedMs, {
        resourceCount: resourceList.length
      });
      
      return { resources: resourceList };
    } catch (error) {
      // Log failure with timing information
      const elapsedMs = logger.endTimer('list_resources', 'Failed to list resources');
      logger.logOperationResult(false, 'list_resources', elapsedMs);
      logger.error('Failed to list available resources', error instanceof Error ? error : undefined);
      throw error;
    }
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
    const operationId = `read_resource_${Date.now()}`;
    
    logger.debug(`Handling ReadResourceRequest for URI: ${uri}`, { 
      resourceUri: uri,
      operationId
    });
    
    // Start performance timing
    logger.startTimer(operationId);
    
    const resource = resources[uri];
    if (!resource) {
      const errorInfo = {
        resourceUri: uri,
        errorCode: McpErrorCode.NOT_FOUND,
        errorCategory: ErrorCategoryType.CATEGORY_DATA_ACCESS
      };
      
      logger.error(`Resource not found: ${uri}`, errorInfo);
      const elapsedMs = logger.endTimer(operationId);
      logger.logOperationResult(false, 'read_resource', elapsedMs, errorInfo);
      
      throw new ObsidianError(
        `Resource not found: ${uri}`, 
        McpErrorCode.NOT_FOUND
      );
    }
    
    try {
      logger.debug(`Found resource for URI: ${uri}`);
      const contents = await resource.getContent();
      
      // Log success with timing information
      const elapsedMs = logger.endTimer(operationId);
      logger.logOperationResult(true, 'read_resource', elapsedMs, {
        resourceUri: uri,
        contentItems: contents.length
      });
      
      return { contents };
    } catch (error) {
      // Log failure with timing information
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      const errorInfo = {
        resourceUri: uri,
        errorMessage,
        errorStack,
        errorCategory: ErrorCategoryType.CATEGORY_DATA_ACCESS
      };
      
      logger.error(`Error reading resource: ${uri}`, errorInfo);
      const elapsedMs = logger.endTimer(operationId);
      logger.logOperationResult(false, 'read_resource', elapsedMs, errorInfo);
      
      throw new ObsidianError(
        `Failed to read resource: ${errorMessage}`,
        McpErrorCode.INTERNAL_SERVER_ERROR,
        { originalError: errorMessage, stack: errorStack }
      );
    }
  });
}