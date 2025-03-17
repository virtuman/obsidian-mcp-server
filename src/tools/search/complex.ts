/**
 * Complex search tool implementation
 */
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ObsidianClient } from "../../obsidian/client.js";
import { JsonLogicQuery } from "../../obsidian/types.js";
import { PropertyManager } from "../properties/manager.js";
import { BaseToolHandler } from "../base.js";
import { createLogger, ErrorCategoryType } from "../../utils/logging.js";

// Create a logger for complex search operations
const logger = createLogger('ComplexSearchTools');

/**
 * Helper function to safely convert any error to an object
 */
function errorToObject(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      errorCategory: ErrorCategoryType.CATEGORY_SYSTEM
    };
  } else if (typeof error === 'object' && error !== null) {
    return error as Record<string, unknown>;
  } else {
    return { 
      error: String(error),
      errorCategory: ErrorCategoryType.CATEGORY_UNKNOWN
    };
  }
}

/**
 * Tool name for complex search
 */
export const COMPLEX_SEARCH_TOOL_NAME = "obsidian_complex_search";

/**
 * Arguments for complex search operations
 */
export interface ComplexSearchArgs {
  query: JsonLogicQuery;
}

/**
 * Tool handler for complex JsonLogic searches
 */
export class ComplexSearchToolHandler extends BaseToolHandler<ComplexSearchArgs> {
  constructor(client: ObsidianClient) {
    super(COMPLEX_SEARCH_TOOL_NAME, client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "File path pattern matching using JsonLogic queries. Supported operations:\n- glob: Pattern matching for paths (e.g., \"*.md\")\n- Variable access: {\"var\": \"path\"}\n\nNote: For full-text content search, date-based searches, or other advanced queries, use obsidian_find_in_file instead.",
      examples: [
        {
          description: "Find markdown files in Projects folder",
          args: {
            query: {
              "glob": ["Projects/*.md", {"var": "path"}]
            }
          }
        },
        {
          description: "Find files in a specific subfolder",
          args: {
            query: {
              "glob": ["**/Test/*.md", {"var": "path"}]
            }
          }
        }
      ],
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "object",
            description: "JsonLogic query object. Example: {\"glob\": [\"*.md\", {\"var\": \"path\"}]} matches all markdown files"
          }
        },
        required: ["query"]
      }
    };
  }

  async runTool(args: ComplexSearchArgs): Promise<Array<any>> {
    logger.startTimer('complex_search');
    
    try {
      logger.debug(`Executing complex search with query: ${JSON.stringify(args.query)}`, {
        queryType: Object.keys(args.query)[0]
      });
      
      // Perform search
      const results = await this.client.searchJson(args.query);
      
      // Format response based on result type
      const formattedResults = results.map(result => {
        if ('matches' in result) {
          // SimpleSearchResult
          return {
            filename: result.filename,
            matches: result.matches,
            score: result.score
          };
        } else {
          // SearchResult
          return {
            filename: result.filename,
            result: result.result
          };
        }
      });

      const elapsedMs = logger.endTimer('complex_search');
      logger.logOperationResult(true, 'complex_search', elapsedMs, {
        resultCount: results.length,
        queryType: Object.keys(args.query)[0]
      });
      
      logger.debug(`Complex search found ${results.length} results`);
      return this.createResponse({
        message: `Found ${results.length} result(s)`,
        results: formattedResults
      });
    } catch (error) {
      const elapsedMs = logger.endTimer('complex_search');
      logger.logOperationResult(false, 'complex_search', elapsedMs, {
        queryType: Object.keys(args.query)[0]
      });
      
      logger.error(`Complex search error`, errorToObject(error));
      return this.handleError(error);
    }
  }
}

/**
 * Tool handler for getting all tags used in the vault
 */
export class GetTagsToolHandler extends BaseToolHandler<{path?: string}> {
  private propertyManager: PropertyManager;

  constructor(client: ObsidianClient) {
    super("obsidian_get_tags", client);
    this.propertyManager = new PropertyManager(client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "Get all tags used across the Obsidian vault with their usage counts. Optionally filter tags within a specific folder.",
      examples: [
        {
          description: "Get all tags in vault",
          args: {}
        },
        {
          description: "Get tags in Projects folder",
          args: {
            path: "Projects"
          }
        },
        {
          description: "Example response",
          args: {},
          response: {
            "tags": [
              {
                "name": "project",
                "count": 15,
                "files": [
                  "Projects/ProjectA.md",
                  "Projects/ProjectB.md"
                ]
              }
            ],
            "metadata": {
              "totalOccurrences": 45,
              "uniqueTags": 12,
              "scannedFiles": 30
            }
          }
        }
      ],
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Optional path to limit tag search to specific folder",
            format: "path"
          }
        }
      }
    };
  }

  async runTool(args: {path?: string}): Promise<Array<any>> {
    const operationId = `get_tags_${args.path || 'vault'}`;
    logger.startTimer(operationId);
    
    try {
      logger.debug(`Getting tags${args.path ? ` in path: ${args.path}` : ' in whole vault'}`);
      
      const tagMap = new Map<string, Set<string>>();
      
      // Use searchJson to find files with .md extension
      const query: JsonLogicQuery = args.path
        ? { "glob": [`${args.path}/**/*.md`.replace(/\\/g, '/'), { "var": "path" }] }
        : { "glob": ["**/*.md", { "var": "path" }] };
      
      const results = await this.client.searchJson(query);
      let scannedFiles = 0;
      let processedSuccessfully = 0;
      
      // Process each file to extract tags from frontmatter
      for (const result of results) {
        if (!('filename' in result)) continue;
        
        try {
          const content = await this.client.getFileContents(result.filename);
          scannedFiles++;
          
          // Use PropertyManager to properly parse frontmatter
          const properties = this.propertyManager.parseProperties(content);
          
          // Process tags if they exist
          if (properties.tags && Array.isArray(properties.tags)) {
            // Process each tag
            for (const tag of properties.tags) {
              const cleanTag = tag.replace(/^#/, ''); // Remove leading # if present
              if (!tagMap.has(cleanTag)) {
                tagMap.set(cleanTag, new Set());
              }
              tagMap.get(cleanTag)!.add(result.filename);
            }
          }
          processedSuccessfully++;
        } catch (error) {
          logger.error(`Failed to process file ${result.filename}:`, errorToObject(error));
        }
      }
      
      // Calculate total occurrences
      const totalOccurrences = Array.from(tagMap.values())
        .reduce((sum, files) => sum + files.size, 0);
      
      const elapsedMs = logger.endTimer(operationId);
      logger.logOperationResult(true, 'get_tags', elapsedMs, {
        uniqueTags: tagMap.size,
        totalOccurrences,
        scannedFiles,
        processedSuccessfully,
        searchPath: args.path || 'vault'
      });
      
      return this.createResponse({
        tags: Array.from(tagMap.entries())
          .map(([name, files]) => ({
            name,
            count: files.size,
            files: Array.from(files).sort()
          }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
        metadata: {
          totalOccurrences,
          uniqueTags: tagMap.size,
          scannedFiles,
          lastUpdate: Date.now()
        }
      });
    } catch (error) {
      const elapsedMs = logger.endTimer(operationId);
      logger.logOperationResult(false, 'get_tags', elapsedMs, {
        searchPath: args.path || 'vault',
        error: errorToObject(error)
      });
      
      return this.handleError(error);
    }
  }
}