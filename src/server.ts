import { config } from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  Tool,
  TextContent,
  ImageContent,
  EmbeddedResource,
  ListToolsRequestSchema,
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { ObsidianClient } from "./obsidian.js";
import { ObsidianError } from "./types.js";
import type { ToolHandler } from "./types.js";

// Rate limiting configuration
const RATE_LIMITS = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200 // Maximum requests per window
};

// Request tracking for rate limiting
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(toolName: string): boolean {
  const now = Date.now();
  const requestInfo = requestCounts.get(toolName);

  if (!requestInfo || now > requestInfo.resetTime) {
    // Reset counter for new window
    requestCounts.set(toolName, {
      count: 1,
      resetTime: now + RATE_LIMITS.windowMs
    });
    return true;
  }

  if (requestInfo.count >= RATE_LIMITS.maxRequests) {
    return false;
  }

  requestInfo.count++;
  return true;
}

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [tool, info] of requestCounts.entries()) {
    if (now > info.resetTime) {
      requestCounts.delete(tool);
    }
  }
}, 60000); // Clean up every minute
import {
  ListFilesInVaultToolHandler,
  ListFilesInDirToolHandler,
  GetFileContentsToolHandler,
  SearchToolHandler,
  AppendContentToolHandler,
  PatchContentToolHandler,
  ComplexSearchToolHandler
} from "./tools.js";

// Load environment variables
config();

const API_KEY = process.env.OBSIDIAN_API_KEY;
if (!API_KEY) {
  throw new Error("OBSIDIAN_API_KEY environment variable is required");
}

// Initialize Obsidian client
const client = new ObsidianClient({ 
  apiKey: API_KEY,
  verifySSL: false // Explicitly disable SSL verification for local development
});

// Initialize tool handlers
const toolHandlers = new Map<string, ToolHandler<any>>([
  new ListFilesInVaultToolHandler(client),
  new ListFilesInDirToolHandler(client),
  new GetFileContentsToolHandler(client),
  new SearchToolHandler(client),
  new AppendContentToolHandler(client),
  new PatchContentToolHandler(client),
  new ComplexSearchToolHandler(client)
].map(handler => [handler.name, handler]));

// Create MCP server
const server = new Server(
  {
    name: "obsidian-mcp-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools: Tool[] = [];
  for (const handler of toolHandlers.values()) {
    tools.push(handler.getToolDescription());
  }
  return { tools };
});

// Add validation helper
function validateToolArguments(args: unknown, schema: any): { valid: boolean; errors: string[] } {
  if (typeof args !== 'object' || args === null) {
    return { valid: false, errors: ['Arguments must be an object'] };
  }

  const errors: string[] = [];
  const required = schema.required || [];
  
  // Check required fields
  for (const field of required) {
    if (!(field in args)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check field types
  const properties = schema.properties || {};
  for (const [key, value] of Object.entries(args)) {
    const propSchema = properties[key];
    if (!propSchema) {
      errors.push(`Unknown field: ${key}`);
      continue;
    }

    // Type validation
    if (propSchema.type === 'string' && typeof value !== 'string') {
      errors.push(`Field ${key} must be a string`);
    } else if (propSchema.type === 'number' && typeof value !== 'number') {
      errors.push(`Field ${key} must be a number`);
    } else if (propSchema.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Field ${key} must be a boolean`);
    } else if (propSchema.type === 'array' && !Array.isArray(value)) {
      errors.push(`Field ${key} must be an array`);
    }

    // Enum validation
    if (propSchema.enum && !propSchema.enum.includes(value)) {
      errors.push(`Field ${key} must be one of: ${propSchema.enum.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const handler = toolHandlers.get(name);
  if (!handler) {
    throw new ObsidianError(`Unknown tool: ${name}`, 404);
  }

  // Check rate limit
  if (!checkRateLimit(name)) {
    throw new ObsidianError(
      `Rate limit exceeded for tool: ${name}. Please try again later.`,
      429
    );
  }

  // Add timeout handling
  const timeoutMs = 60000; // 60 second timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new ObsidianError(`Tool execution timed out after ${timeoutMs}ms`, 408));
    }, timeoutMs);
  });

  try {
    // Validate arguments against tool's schema
    const toolDescription = handler.getToolDescription();
    const validationResult = validateToolArguments(args, toolDescription.inputSchema);
    if (!validationResult.valid) {
      throw new ObsidianError(
        `Invalid tool arguments: ${validationResult.errors.join(', ')}`,
        400
      );
    }

    // Race between tool execution and timeout
    const content = await Promise.race([
      handler.runTool(args as any),
      timeoutPromise
    ]);
    return { content };
  } catch (error) {
    console.error("Tool execution failed:", error);
    
    // Log the error for debugging
    console.error(`Tool execution error details:`, {
      error,
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Check if the operation actually succeeded despite the error
    if (error instanceof ObsidianError && error.code === 204) {
      // Return success response since we know the operation worked
      return {
        content: [{
          type: "text",
          text: "Operation completed successfully"
        }]
      };
    }

    // Handle other errors
    if (error instanceof ObsidianError) {
      throw error;
    } else if (error instanceof Error) {
      throw new ObsidianError(
        `Tool '${name}' execution failed: ${error.message}`,
        500,
        { originalError: error.stack }
      );
    } else {
      throw new ObsidianError(
        "Tool execution failed with unknown error",
        500,
        { error }
      );
    }
  }
});

// Error handler
server.onerror = (error) => {
  console.error("[MCP Error]", error);
};

// Handle shutdown
process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});

// Export the run function
export async function run(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Obsidian MCP server running on stdio");
}
