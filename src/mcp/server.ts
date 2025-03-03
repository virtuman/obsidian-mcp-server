/**
 * MCP server implementation
 */
import { config } from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLogger } from "../utils/logging.js";
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
import { McpServerConfig, ResourceMap } from "./types.js";

// Create a logger for the server
const logger = createLogger('McpServer');

// Load environment variables
config();

/**
 * Initialize MCP server components
 */
export async function initializeServer(): Promise<Server> {
  // Verify API key exists
  const API_KEY = process.env.OBSIDIAN_API_KEY;
  if (!API_KEY) {
    throw new Error("OBSIDIAN_API_KEY environment variable is required");
  }

  // Initialize Obsidian client with environment configuration
  logger.info('Initializing Obsidian client');
  const client = new ObsidianClient({
    apiKey: API_KEY,
    verifySSL: process.env.VERIFY_SSL === 'true',
    timeout: parseInt(process.env.REQUEST_TIMEOUT || '5000'),
    maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH || String(50 * 1024 * 1024)),
    maxBodyLength: parseInt(process.env.MAX_BODY_LENGTH || String(50 * 1024 * 1024))
  });

  // Initialize tool handlers
  logger.info('Initializing tool handlers');
  const toolHandlers = createToolHandlers(client);
  const toolHandlerMap = createToolHandlerMap(toolHandlers);

  // Initialize resources
  logger.info('Initializing resources');
  const tagResource = createTagResource(client);
  const resources: ResourceMap = {
    [tagResource.getResourceDescription().uri]: tagResource
  };

  // Create MCP server
  const serverConfig: McpServerConfig = {
    name: "obsidian-mcp-server",
    version: process.env.npm_package_version ?? "1.1.0" // Use version from package.json
  };

  logger.info(`Creating MCP server: ${serverConfig.name} v${serverConfig.version}`);
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
  setupToolListingHandler(server, toolHandlerMap);
  setupToolCallingHandler(server, toolHandlerMap);
  setupResourceListingHandler(server, resources);
  setupResourceReadingHandler(server, resources);

  // Set up error handler
  server.onerror = (error) => {
    logger.error("[MCP Error]", error);
  };

  return server;
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
  const cleanup = async () => {
    logger.info('Shutting down server...');
    
    // Run cleanup handlers
    for (const handler of cleanupHandlers) {
      try {
        await handler();
      } catch (error) {
        logger.error('Error during cleanup:', error);
      }
    }
    
    // Dispose rate limiter
    rateLimiter.dispose();
    
    // Close server
    await server.close();
    
    process.exit(0);
  };

  // Handle various termination signals
  process.on('SIGINT', cleanup);  // Ctrl+C on all platforms
  process.on('SIGTERM', cleanup); // Termination request
  
  if (process.platform === 'win32') {
    // Windows-specific handling
    process.on('SIGHUP', cleanup);  // Terminal closed
  } else {
    // Unix-specific signals
    process.on('SIGUSR1', cleanup);
    process.on('SIGUSR2', cleanup);
  }

  // Handle uncaught errors
  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception:', error);
    await cleanup();
  });

  process.on('unhandledRejection', async (error) => {
    logger.error('Unhandled rejection:', error);
    await cleanup();
  });
}

/**
 * Run the MCP server
 */
export async function run(): Promise<void> {
  try {
    const server = await initializeServer();
    setupShutdownHandling(server, []);
    
    // Connect to transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info("Obsidian MCP server running on stdio");
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}