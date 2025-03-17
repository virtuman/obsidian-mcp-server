/**
 * MCP server implementation
 */
import { config } from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLogger, ErrorCategoryType } from "../utils/logging.js";
import { rateLimiter } from "../utils/rate-limiting.js";
import { createTagResource } from "../resources/index.js";
import { createToolHandlers, createToolHandlerMap } from "../tools/index.js";
import { ObsidianClient } from "../obsidian/client.js";
import { 
  setupToolListingHandler, 
  setupToolCallingHandler, 
  setupResourceListingHandler, 
  setupResourceReadingHandler 
} from "./handlers.js";
import { 
  McpServerConfig, 
  ResourceMap,
  McpErrorCode 
} from "./types.js";

// Create a logger for the server
const logger = createLogger('McpServer');

// Load environment variables
config();

/**
 * Initialize MCP server components
 */
export async function initializeServer(): Promise<Server> {
  // Start initialization timer
  logger.startTimer('server_init');
  
  try {
    // Verify API key exists
    const API_KEY = process.env.OBSIDIAN_API_KEY;
    if (!API_KEY) {
      logger.error("Missing API key", {
        errorCategory: ErrorCategoryType.CATEGORY_AUTHENTICATION,
        errorCode: McpErrorCode.UNAUTHORIZED
      });
      throw new Error("OBSIDIAN_API_KEY environment variable is required");
    }

    // Initialize Obsidian client with environment configuration
    logger.info('Initializing Obsidian client', {
      verifySSL: process.env.VERIFY_SSL === 'true',
      timeout: parseInt(process.env.REQUEST_TIMEOUT || '5000'),
      maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH || String(50 * 1024 * 1024)),
      maxBodyLength: parseInt(process.env.MAX_BODY_LENGTH || String(50 * 1024 * 1024))
    });
    
    const client = new ObsidianClient({
      apiKey: API_KEY,
      verifySSL: process.env.VERIFY_SSL === 'true',
      timeout: parseInt(process.env.REQUEST_TIMEOUT || '5000'),
      maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH || String(50 * 1024 * 1024)),
      maxBodyLength: parseInt(process.env.MAX_BODY_LENGTH || String(50 * 1024 * 1024))
    });

    // Initialize tool handlers
    logger.startTimer('init_tools');
    logger.info('Initializing tool handlers');
    const toolHandlers = createToolHandlers(client);
    const toolHandlerMap = createToolHandlerMap(toolHandlers);
    const toolsElapsedMs = logger.endTimer('init_tools');
    logger.info(`Initialized ${toolHandlerMap.size} tool handlers`, { 
      processingTimeMs: toolsElapsedMs,
      toolCount: toolHandlerMap.size
    });

    // Initialize resources
    logger.startTimer('init_resources');
    logger.info('Initializing resources');
    const tagResource = createTagResource(client);
    const resources: ResourceMap = {
      [tagResource.getResourceDescription().uri]: tagResource
    };
    const resourcesElapsedMs = logger.endTimer('init_resources');
    logger.info(`Initialized ${Object.keys(resources).length} resources`, { 
      processingTimeMs: resourcesElapsedMs,
      resourceCount: Object.keys(resources).length
    });

    // Create MCP server
    const serverConfig: McpServerConfig = {
      name: "obsidian-mcp-server",
      version: process.env.npm_package_version ?? "1.1.0" // Use version from package.json
    };

    logger.info(`Creating MCP server: ${serverConfig.name} v${serverConfig.version}`, {
      serverName: serverConfig.name,
      serverVersion: serverConfig.version
    });
    
    const server = new Server(
      serverConfig,
      {
        capabilities: {
          tools: {},
          resources
        }
      }
    );

    // Set up request handlers
    logger.startTimer('setup_handlers');
    setupToolListingHandler(server, toolHandlerMap);
    setupToolCallingHandler(server, toolHandlerMap);
    setupResourceListingHandler(server, resources);
    setupResourceReadingHandler(server, resources);
    const handlersElapsedMs = logger.endTimer('setup_handlers');
    logger.info('Request handlers configured', { processingTimeMs: handlersElapsedMs });

    // Set up enhanced error handler
    server.onerror = (error) => {
      if (error instanceof Error) {
        logger.error("MCP Server Error", {
          name: error.name,
          message: error.message,
          stack: error.stack,
          errorCategory: ErrorCategoryType.CATEGORY_SYSTEM
        });
      } else {
        logger.error("MCP Server Error (Unknown)", {
          error: String(error),
          errorCategory: ErrorCategoryType.CATEGORY_UNKNOWN
        });
      }
    };

    // Log successful initialization
    const totalElapsedMs = logger.endTimer('server_init');
    logger.logOperationResult(true, 'server_initialization', totalElapsedMs, {
      toolCount: toolHandlerMap.size,
      resourceCount: Object.keys(resources).length
    });

    return server;
  } catch (error) {
    // Log initialization failure
    const totalElapsedMs = logger.endTimer('server_init');
    logger.logOperationResult(false, 'server_initialization', totalElapsedMs);
    
    // Enhance error reporting
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error("Failed to initialize server", {
      error: errorMessage,
      stack: errorStack,
      errorCategory: ErrorCategoryType.CATEGORY_SYSTEM
    });
    
    throw error;
  }
}

/**
 * Set up graceful shutdown handling
 * @param server The MCP server instance
 * @param cleanupHandlers Additional cleanup handlers to run on shutdown
 */
export function setupShutdownHandling(
  server: Server,
  cleanupHandlers: (() => Promise<void> | void)[] = []
): void {
  // Cleanup function for graceful shutdown
  const cleanup = async (signal?: string) => {
    logger.startTimer('server_shutdown');
    logger.info('Shutting down server...', { signal });
    
    try {
      // Run cleanup handlers
      logger.debug('Running cleanup handlers', { handlersCount: cleanupHandlers.length });
      for (const handler of cleanupHandlers) {
        try {
          await handler();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Error during cleanup handler execution', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            errorCategory: ErrorCategoryType.CATEGORY_SYSTEM
          });
        }
      }
      
      // Dispose rate limiter
      logger.debug('Disposing rate limiter');
      rateLimiter.dispose();
      
      // Close server
      logger.debug('Closing MCP server connection');
      await server.close();
      
      const elapsedMs = logger.endTimer('server_shutdown');
      logger.logOperationResult(true, 'server_shutdown', elapsedMs);
      logger.info('Server shutdown completed successfully');
      
      process.exit(0);
    } catch (error) {
      const elapsedMs = logger.endTimer('server_shutdown');
      logger.logOperationResult(false, 'server_shutdown', elapsedMs);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to shut down server gracefully', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        errorCategory: ErrorCategoryType.CATEGORY_SYSTEM
      });
      
      process.exit(1);
    }
  };

  // Handle various termination signals
  process.on('SIGINT', () => cleanup('SIGINT'));  // Ctrl+C on all platforms
  process.on('SIGTERM', () => cleanup('SIGTERM')); // Termination request
  
  if (process.platform === 'win32') {
    // Windows-specific handling
    process.on('SIGHUP', () => cleanup('SIGHUP'));  // Terminal closed
  } else {
    // Unix-specific signals
    process.on('SIGUSR1', () => cleanup('SIGUSR1'));
    process.on('SIGUSR2', () => cleanup('SIGUSR2'));
  }

  // Handle uncaught errors
  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      errorCategory: ErrorCategoryType.CATEGORY_SYSTEM
    });
    await cleanup('uncaughtException');
  });

  process.on('unhandledRejection', async (reason, promise) => {
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    logger.error('Unhandled promise rejection', {
      reason: errorMessage,
      stack: reason instanceof Error ? reason.stack : undefined,
      errorCategory: ErrorCategoryType.CATEGORY_SYSTEM
    });
    await cleanup('unhandledRejection');
  });
}

/**
 * Run the MCP server
 */
export async function run(): Promise<void> {
  try {
    logger.info("Starting Obsidian MCP server");
    logger.startTimer('server_startup');
    
    const server = await initializeServer();
    setupShutdownHandling(server, []);
    
    // Connect to transport
    logger.debug("Connecting to stdio transport");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    const elapsedMs = logger.endTimer('server_startup');
    logger.logOperationResult(true, 'server_startup', elapsedMs);
    logger.info("Obsidian MCP server running on stdio", {
      serverName: "obsidian-mcp-server",
      serverVersion: process.env.npm_package_version ?? "1.1.0",
      transport: "stdio"
    });
  } catch (error) {
    const elapsedMs = logger.endTimer('server_startup', 'Server startup failed');
    logger.logOperationResult(false, 'server_startup', elapsedMs);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to start server", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      errorCategory: ErrorCategoryType.CATEGORY_SYSTEM
    });
    
    process.exit(1);
  }
}