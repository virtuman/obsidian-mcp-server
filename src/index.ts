#!/usr/bin/env node
import { run } from "./mcp/server.js";
import { createLogger } from "./utils/logging.js";

// Create a logger for the main entry point
const logger = createLogger('Main');

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  logger.info("Starting Obsidian MCP Server");
  run().catch((error) => {
    logger.error("Failed to start server:", error);
    process.exit(1);
  });
}

// Export the run function and other important modules
export { run } from "./mcp/server.js";
export * from "./obsidian/index.js";
export * from "./tools/index.js";
export * from "./resources/index.js";
export * from "./utils/index.js";
