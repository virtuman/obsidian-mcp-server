/**
 * Base class for all tool handlers
 */
import { Tool, TextContent, ImageContent, EmbeddedResource } from "@modelcontextprotocol/sdk/types.js";
import { ObsidianClient } from "../obsidian/client.js";
import { ObsidianError } from "../utils/errors.js";
import { tokenCounter } from "../utils/tokenization.js";
import { createLogger, ErrorCategoryType } from "../utils/logging.js";
import { McpErrorCode } from "../mcp/types.js";

// Create a logger for tool operations
const logger = createLogger('Tools');

/**
 * Interface that all tool handlers must implement
 */
export interface ToolHandler<T = any> {
  name: string;
  getToolDescription(): Tool;
  runTool(args: T): Promise<Array<TextContent>>;
}

/**
 * Base class for all tool handlers with common functionality
 */
export abstract class BaseToolHandler<T = Record<string, unknown>> implements ToolHandler<T> {
  /**
   * Create a new tool handler
   * @param name The name of the tool
   * @param client The ObsidianClient instance
   */
  constructor(
    public readonly name: string,
    protected client: ObsidianClient
  ) {}

  /**
   * Get the tool description for MCP server
   */
  abstract getToolDescription(): Tool;

  /**
   * Run the tool with the provided arguments
   */
  abstract runTool(args: T): Promise<Array<TextContent>>;

  /**
   * Create a standardized response from any content type
   * @param content The content to format for response
   * @returns An array of TextContent objects
   */
  protected createResponse(content: unknown): TextContent[] {
    let text: string;

    // Handle different content types
    if (typeof content === 'string') {
      text = content;
    } else if (content instanceof Buffer) {
      text = content.toString('utf-8');
    } else if (Array.isArray(content) && content.every(item => typeof item === 'string')) {
      text = content.join('\n');
    } else if (content instanceof Error) {
      text = `Error: ${content.message}\n${content.stack || ''}`;
    } else {
      try {
        text = JSON.stringify(content, null, 2);
      } catch (error) {
        text = String(content);
      }
    }

    // Count tokens and truncate if necessary
    const originalTokenCount = tokenCounter.countTokens(text);
    const truncatedText = tokenCounter.truncateToTokenLimit(text);
    const finalTokenCount = tokenCounter.countTokens(truncatedText);
    
    if (originalTokenCount > finalTokenCount) {
      logger.debug(`[${this.name}] Response truncated`, {
        toolName: this.name,
        originalTokens: originalTokenCount,
        truncatedTokens: finalTokenCount,
        truncationPercent: Math.round((1 - finalTokenCount / originalTokenCount) * 100)
      });
    }
    
    return [{
      type: "text",
      text: truncatedText
    }];
  }

  /**
   * Standard error handling for tool execution
   * @param error The error to handle
   * @throws ObsidianError
   */
  protected handleError(error: unknown): never {
    if (error instanceof ObsidianError) {
      throw error;
    }
    
    logger.error(`Tool '${this.name}' execution failed`, {
      toolName: this.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      errorCategory: ErrorCategoryType.CATEGORY_SYSTEM
    });
    
    if (error instanceof Error) {
      throw new ObsidianError(
        `Tool '${this.name}' execution failed: ${error.message}`,
        McpErrorCode.INTERNAL_SERVER_ERROR,
        { originalError: error.stack }
      );
    }
    
    throw new ObsidianError(
      `Tool '${this.name}' execution failed with unknown error`,
      McpErrorCode.INTERNAL_SERVER_ERROR,
      { error: String(error) }
    );
  }
}