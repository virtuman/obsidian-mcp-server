/**
 * Token counting utilities for the Obsidian MCP Server
 */
import { encoding_for_model } from "tiktoken";

// Load token limits from environment or use defaults
export const MAX_TOKENS = parseInt(process.env.MAX_TOKENS ?? '20000');
export const TRUNCATION_MESSAGE = "\n\n[Response truncated due to length]";

/**
 * Handles token counting and text truncation to stay within token limits
 */
export class TokenCounter {
  private tokenizer = encoding_for_model("gpt-4"); // This is strictly for token counting, not for LLM inference
  private isShuttingDown = false;

  constructor() {
    // Clean up tokenizer when process exits
    const cleanup = () => {
      if (!this.isShuttingDown) {
        this.isShuttingDown = true;
        if (this.tokenizer) {
          this.tokenizer.free();
        }
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', cleanup);
  }

  /**
   * Count the number of tokens in a string
   */
  countTokens(text: string): number {
    return this.tokenizer.encode(text).length;
  }

  /**
   * Truncate text to stay within token limit
   */
  truncateToTokenLimit(text: string, limit: number = MAX_TOKENS): string {
    const tokens = this.tokenizer.encode(text);
    if (tokens.length <= limit) {
      return text;
    }

    // Reserve tokens for truncation message
    const messageTokens = this.tokenizer.encode(TRUNCATION_MESSAGE);
    const availableTokens = limit - messageTokens.length;
    
    // Decode truncated tokens back to text
    const truncatedText = this.tokenizer.decode(tokens.slice(0, availableTokens));
    return truncatedText + TRUNCATION_MESSAGE;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.tokenizer && !this.isShuttingDown) {
      this.isShuttingDown = true;
      this.tokenizer.free();
    }
  }
}

// Export a singleton instance
export const tokenCounter = new TokenCounter();