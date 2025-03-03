/**
 * Simple search tool implementation
 */
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ObsidianClient } from "../../obsidian/client.js";
import { BaseToolHandler } from "../base.js";
import { createLogger } from "../../utils/logging.js";

// Create a logger for search operations
const logger = createLogger('SimpleSearchTools');

/**
 * Tool name for simple search
 */
export const SIMPLE_SEARCH_TOOL_NAME = "obsidian_find_in_file";

/**
 * Arguments for simple search operations
 */
export interface SearchArgs {
  query: string;
  contextLength?: number;
}

/**
 * Tool handler for simple text search across files
 */
export class FindInFileToolHandler extends BaseToolHandler<SearchArgs> {
  constructor(client: ObsidianClient) {
    super(SIMPLE_SEARCH_TOOL_NAME, client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "Full-text search across all files in the vault. Returns matching files with surrounding context for each match. For results with more than 5 matching files, returns only file names and match counts to prevent overwhelming responses. Useful for finding specific content, references, or patterns across notes.",
      examples: [
        {
          description: "Search for a specific term",
          args: {
            query: "neural networks",
            contextLength: 20
          }
        },
        {
          description: "Search with default context",
          args: {
            query: "#todo"
          },
          response: {
            "message": "Found 1 file with matches:",
            "results": [
              {
                "filename": "Projects/AI.md",
                "matches": [
                  {
                    "context": "Research needed:\n#todo Implement transformer architecture\nDeadline: Next week",
                    "match": { "start": 15, "end": 45 }
                  }
                ]
              }
            ]
          }
        },
        {
          description: "Example response with many matches (file-only format)",
          args: {
            query: "API"
          },
          response: {
            "message": "Found 92 files with matches. Showing file names only:",
            "results": [
              {
                "filename": "Developer/Documentation/API.md",
                "matchCount": 43
              },
              {
                "filename": "Projects/API_Design.md",
                "matchCount": 34
              }
            ]
          }
        }
      ],
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Text pattern to search for. Can include tags, keywords, or phrases."
          },
          contextLength: {
            type: "integer",
            description: "Number of characters to include before and after each match for context (default: 10)",
            default: 10
          }
        },
        required: ["query"]
      }
    };
  }

  async runTool(args: SearchArgs): Promise<Array<any>> {
    try {
      logger.debug(`Searching for "${args.query}" with context length: ${args.contextLength || 100}`);
      const results = await this.client.search(args.query, args.contextLength ?? 100);
      
      // If more than 5 results, only return filenames and match counts to prevent overwhelming responses
      if (results.length > 5) {
        const fileOnlyResults = results.map(result => ({
          filename: result.filename,
          matchCount: result.matches.length
        }));
        
        logger.debug(`Found ${results.length} files with matches, returning file-only format`);
        return this.createResponse({
          message: `Found ${results.length} files with matches. Showing file names only:`,
          results: fileOnlyResults
        });
      }

      // Otherwise return full context as before
      const formattedResults = results.map(result => ({
        filename: result.filename,
        matches: result.matches.map(match => ({
          context: match.context,
          match: {
            text: match.context.substring(match.match.start, match.match.end),
            position: {
              start: match.match.start,
              end: match.match.end
            }
          }
        })),
        score: result.score
      }));

      logger.debug(`Found ${results.length} files with matches, returning with context`);
      return this.createResponse({
        message: `Found ${results.length} file(s) with matches:`,
        results: formattedResults
      });
    } catch (error) {
      return this.handleError(error);
    }
  }
}