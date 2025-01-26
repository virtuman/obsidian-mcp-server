import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { ObsidianClient } from "./obsidian.js";
import { encoding_for_model } from "tiktoken";
import { join } from "path";
import { EOL } from "os";
import {
  ToolHandler,
  PatchContentArgs,
  AppendContentArgs,
  SearchArgs,
  ComplexSearchArgs,
  FileContentsArgs,
  ListFilesArgs,
  GetTagsArgs,
  TagResponse,
  ObsidianError,
  JsonLogicQuery,
  SearchResult,
  SimpleSearchResult,
  SearchMatch,
  ObsidianFile,
  PeriodType
} from "./types.js";
import { PropertyManager } from "./properties.js";

const TOOL_NAMES = {
  LIST_FILES_IN_VAULT: "obsidian_list_files_in_vault",
  LIST_FILES_IN_DIR: "obsidian_list_files_in_dir",
  GET_FILE_CONTENTS: "obsidian_get_file_contents",
  FIND_IN_FILE: "obsidian_find_in_file",
  APPEND_CONTENT: "obsidian_append_content",
  PATCH_CONTENT: "obsidian_patch_content",
  COMPLEX_SEARCH: "obsidian_complex_search",
  GET_TAGS: "obsidian_get_tags"
} as const;

// Load token limits from environment or use defaults
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS ?? '20000');
const TRUNCATION_MESSAGE = "\n\n[Response truncated due to length]";

export abstract class BaseToolHandler<T = Record<string, unknown>> implements ToolHandler<T> {
  private tokenizer = encoding_for_model("gpt-4"); // This is strictly for token counting, not for LLM inference
  private isShuttingDown = false;

  constructor(
    public readonly name: string,
    protected client: ObsidianClient
  ) {
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

  protected countTokens(text: string): number {
    return this.tokenizer.encode(text).length;
  }

  protected truncateToTokenLimit(text: string): string {
    const tokens = this.tokenizer.encode(text);
    if (tokens.length <= MAX_TOKENS) {
      return text;
    }

    // Reserve tokens for truncation message
    const messageTokens = this.tokenizer.encode(TRUNCATION_MESSAGE);
    const availableTokens = MAX_TOKENS - messageTokens.length;
    
    // Decode truncated tokens back to text
    const truncatedText = this.tokenizer.decode(tokens.slice(0, availableTokens));
    return truncatedText + TRUNCATION_MESSAGE;
  }

  abstract getToolDescription(): Tool;
  abstract runTool(args: T): Promise<Array<TextContent>>;

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
    const originalTokenCount = this.countTokens(text);
    const truncatedText = this.truncateToTokenLimit(text);
    const finalTokenCount = this.countTokens(truncatedText);
    
    if (originalTokenCount > MAX_TOKENS) {
      console.debug(
        `[${this.name}] Response truncated:`,
        `original tokens=${originalTokenCount}`,
        `truncated tokens=${finalTokenCount}`
      );
    }
    
    return [{
      type: "text",
      text: truncatedText
    }];
  }

  protected handleError(error: unknown): never {
    if (error instanceof ObsidianError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new ObsidianError(
        `Tool '${this.name}' execution failed: ${error.message}`,
        500,
        { originalError: error.stack }
      );
    }
    throw new ObsidianError(
      `Tool '${this.name}' execution failed with unknown error`,
      500,
      { error }
    );
  }
}

export class ListFilesInVaultToolHandler extends BaseToolHandler<Record<string, never>> {
  constructor(client: ObsidianClient) {
    super(TOOL_NAMES.LIST_FILES_IN_VAULT, client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "Lists all files and directories in the root directory of your Obsidian vault. Returns a hierarchical structure of files and folders, including metadata like file type.",
      examples: [
        {
          description: "List all files in vault",
          args: {}
        },
        {
          description: "Example response",
          args: {},
          response: [
            {
              "path": "Daily Notes",
              "type": "folder",
              "children": [
                { "path": "Daily Notes/2025-01-24.md", "type": "file" }
              ]
            },
            {
              "path": "Projects",
              "type": "folder",
              "children": [
                { "path": "Projects/MCP.md", "type": "file" }
              ]
            }
          ]
        }
      ],
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    };
  }

  async runTool(): Promise<Array<TextContent>> {
    try {
      const files = await this.client.listFilesInVault();
      return this.createResponse(files);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export class ListFilesInDirToolHandler extends BaseToolHandler<ListFilesArgs> {
  constructor(client: ObsidianClient) {
    super(TOOL_NAMES.LIST_FILES_IN_DIR, client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "Lists all files and directories that exist in a specific Obsidian directory. Returns a hierarchical structure showing files, folders, and their relationships. Useful for exploring vault organization and finding specific files.",
      examples: [
        {
          description: "List files in Documents folder",
          args: {
            dirpath: "Documents"
          }
        },
        {
          description: "Example response structure",
          args: {
            dirpath: "Projects"
          },
          response: [
            {
              "path": "Projects/Active",
              "type": "folder",
              "children": [
                { "path": "Projects/Active/ProjectA.md", "type": "file" },
                { "path": "Projects/Active/ProjectB.md", "type": "file" }
              ]
            },
            {
              "path": "Projects/Archive",
              "type": "folder",
              "children": [
                { "path": "Projects/Archive/OldProject.md", "type": "file" }
              ]
            }
          ]
        }
      ],
      inputSchema: {
        type: "object",
        properties: {
          dirpath: {
            type: "string",
            description: "Path to list files from (relative to your vault root). Note that empty directories will not be returned.",
            format: "path"
          }
        },
        required: ["dirpath"]
      }
    };
  }

  async runTool(args: ListFilesArgs): Promise<Array<TextContent>> {
    try {
      const files = await this.client.listFilesInDir(args.dirpath);
      return this.createResponse(files);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export class GetFileContentsToolHandler extends BaseToolHandler<FileContentsArgs> {
  constructor(client: ObsidianClient) {
    super(TOOL_NAMES.GET_FILE_CONTENTS, client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "Return the content of a single file in your vault. Supports markdown files, text files, and other readable formats. Returns the raw content including any YAML frontmatter.",
      examples: [
        {
          description: "Get content of a markdown note",
          args: {
            filepath: "Projects/research.md"
          }
        },
        {
          description: "Get content of a configuration file",
          args: {
            filepath: "configs/settings.yml"
          }
        }
      ],
      inputSchema: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "Path to the relevant file (relative to your vault root).",
            format: "path"
          }
        },
        required: ["filepath"]
      }
    };
  }

  async runTool(args: FileContentsArgs): Promise<Array<TextContent>> {
    try {
      const content = await this.client.getFileContents(args.filepath);
      return this.createResponse(content);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export class FindInFileToolHandler extends BaseToolHandler<SearchArgs> {
  constructor(client: ObsidianClient) {
    super(TOOL_NAMES.FIND_IN_FILE, client);
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

  async runTool(args: SearchArgs): Promise<Array<TextContent>> {
    try {
      const results = await this.client.search(args.query, args.contextLength ?? 100) as SimpleSearchResult[];
      
      // If more than 5 results, only return filenames
      if (results.length > 5) {
        const fileOnlyResults = results.map(result => ({
          filename: result.filename,
          matchCount: result.matches.length
        }));
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
      return this.createResponse(formattedResults);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export class AppendContentToolHandler extends BaseToolHandler<AppendContentArgs> {
  constructor(client: ObsidianClient) {
    super(TOOL_NAMES.APPEND_CONTENT, client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "Append content to a new or existing file in the vault.",
      examples: [
        {
          description: "Append a new task",
          args: {
            filepath: "tasks.md",
            content: "- [ ] New task to complete"
          }
        },
        {
          description: "Append meeting notes",
          args: {
            filepath: "meetings/2025-01-23.md",
            content: "## Meeting Notes\n\n- Discussed project timeline\n- Assigned tasks"
          }
        }
      ],
      inputSchema: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "Path to the file (relative to vault root)",
            format: "path"
          },
          content: {
            type: "string",
            description: "Content to append to the file"
          }
        },
        required: ["filepath", "content"]
      }
    };
  }

  async runTool(args: AppendContentArgs): Promise<Array<TextContent>> {
    try {
      await this.client.appendContent(args.filepath, args.content);
      return this.createResponse({ message: `Successfully appended content to ${args.filepath}` });
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export class PatchContentToolHandler extends BaseToolHandler<PatchContentArgs> {
  constructor(client: ObsidianClient) {
    super(TOOL_NAMES.PATCH_CONTENT, client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "Update the entire content of an existing note or create a new one.",
      examples: [
        {
          description: "Update a note's content",
          args: {
            filepath: "project.md",
            content: "# Project Notes\n\nThis will replace the entire content of the note."
          }
        }
      ],
      inputSchema: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "Path to the file (relative to vault root)",
            format: "path"
          },
          content: {
            type: "string",
            description: "New content for the note (replaces existing content)"
          }
        },
        required: ["filepath", "content"]
      }
    };
  }

  async runTool(args: PatchContentArgs): Promise<Array<TextContent>> {
    try {
      await this.client.updateContent(args.filepath, args.content);
      return this.createResponse({ message: `Successfully updated content in ${args.filepath}` });
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export class ComplexSearchToolHandler extends BaseToolHandler<ComplexSearchArgs> {
  constructor(client: ObsidianClient) {
    super(TOOL_NAMES.COMPLEX_SEARCH, client);
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

  async runTool(args: ComplexSearchArgs): Promise<Array<TextContent>> {
    try {
      // Perform search
      const results = await this.client.searchJson(args.query);
      console.debug('Search results:', results);

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

      return this.createResponse(formattedResults);
    } catch (error) {
      console.error('Complex search error:', error);
      return this.handleError(error);
    }
  }
}

export class GetTagsToolHandler extends BaseToolHandler<GetTagsArgs> {
  private propertyManager: PropertyManager;

  constructor(client: ObsidianClient) {
    super(TOOL_NAMES.GET_TAGS, client);
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

  async runTool(args: GetTagsArgs): Promise<Array<TextContent>> {
    try {
      const tagMap = new Map<string, Set<string>>();
      const basePath = args.path || '';
      
      // Use searchJson to find files with tags in frontmatter
      const query: JsonLogicQuery = args.path
        ? { "glob": [join(args.path, "**/*.md").replace(/\\/g, '/'), { "var": "path" }] }
        : { "glob": ["**/*.md", { "var": "path" }] };

      const results = await this.client.searchJson(query);
      let scannedFiles = 0;

      // Process each file
      for (const result of results) {
        if (!('filename' in result)) continue;
        
        const content = await this.client.getFileContents(result.filename);
        const properties = this.propertyManager.parseProperties(content);
        
        if (properties.tags) {
          scannedFiles++;
          properties.tags.forEach((tag: string) => {
            if (!tagMap.has(tag)) {
              tagMap.set(tag, new Set());
            }
            tagMap.get(tag)!.add(result.filename);
          });
        }
      }
      
      // Calculate total occurrences
      const totalOccurrences = Array.from(tagMap.values())
        .reduce((sum, files) => sum + files.size, 0);

      const response: TagResponse = {
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
      };

      return this.createResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Export all handlers
export class ListCommandsToolHandler extends BaseToolHandler<Record<string, never>> {
  constructor(client: ObsidianClient) {
    super("obsidian_list_commands", client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "Get a list of available commands that can be executed in Obsidian.",
      examples: [
        {
          description: "List all available commands",
          args: {}
        }
      ],
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    };
  }

  async runTool(): Promise<Array<TextContent>> {
    try {
      const commands = await this.client.listCommands();
      return this.createResponse(commands);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export class ExecuteCommandToolHandler extends BaseToolHandler<{commandId: string}> {
  constructor(client: ObsidianClient) {
    super("obsidian_execute_command", client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "Execute a specific command in Obsidian by its ID.",
      examples: [
        {
          description: "Execute the graph view command",
          args: {
            commandId: "graph:open"
          }
        }
      ],
      inputSchema: {
        type: "object",
        properties: {
          commandId: {
            type: "string",
            description: "The ID of the command to execute"
          }
        },
        required: ["commandId"]
      }
    };
  }

  async runTool(args: {commandId: string}): Promise<Array<TextContent>> {
    try {
      await this.client.executeCommand(args.commandId);
      return this.createResponse({ message: `Successfully executed command: ${args.commandId}` });
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export class OpenFileToolHandler extends BaseToolHandler<{filepath: string; newLeaf?: boolean}> {
  constructor(client: ObsidianClient) {
    super("obsidian_open_file", client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "Open a specific file in Obsidian, optionally in a new leaf.",
      examples: [
        {
          description: "Open a file in the current leaf",
          args: {
            filepath: "Projects/research.md"
          }
        },
        {
          description: "Open a file in a new leaf",
          args: {
            filepath: "Projects/research.md",
            newLeaf: true
          }
        }
      ],
      inputSchema: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "Path to the file to open (relative to vault root)",
            format: "path"
          },
          newLeaf: {
            type: "boolean",
            description: "Whether to open the file in a new leaf",
            default: false
          }
        },
        required: ["filepath"]
      }
    };
  }

  async runTool(args: {filepath: string; newLeaf?: boolean}): Promise<Array<TextContent>> {
    try {
      await this.client.openFile(args.filepath, args.newLeaf);
      return this.createResponse({
        message: `Successfully opened ${args.filepath}${args.newLeaf ? ' in new leaf' : ''}`
      });
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export class GetActiveFileToolHandler extends BaseToolHandler<Record<string, never>> {
  constructor(client: ObsidianClient) {
    super("obsidian_get_active_file", client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "Get the content and metadata of the currently active file in Obsidian.",
      examples: [
        {
          description: "Get active file content",
          args: {}
        }
      ],
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    };
  }

  async runTool(): Promise<Array<TextContent>> {
    try {
      const activeFile = await this.client.getActiveFile();
      return this.createResponse(activeFile);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export class GetPeriodicNoteToolHandler extends BaseToolHandler<{period: PeriodType["type"]}> {
  constructor(client: ObsidianClient) {
    super("obsidian_get_periodic_note", client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "Get the content and metadata of a periodic note (daily, weekly, monthly, quarterly, or yearly).",
      examples: [
        {
          description: "Get today's daily note",
          args: {
            period: "daily"
          }
        }
      ],
      inputSchema: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
            description: "The type of periodic note to retrieve"
          }
        },
        required: ["period"]
      }
    };
  }

  async runTool(args: {period: PeriodType["type"]}): Promise<Array<TextContent>> {
    try {
      const note = await this.client.getPeriodicNote(args.period);
      return this.createResponse(note);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export const handlers = [
  ListFilesInVaultToolHandler,
  ListFilesInDirToolHandler,
  GetFileContentsToolHandler,
  FindInFileToolHandler,
  AppendContentToolHandler,
  PatchContentToolHandler,
  ComplexSearchToolHandler,
  GetTagsToolHandler,
  ListCommandsToolHandler,
  ExecuteCommandToolHandler,
  OpenFileToolHandler,
  GetActiveFileToolHandler,
  GetPeriodicNoteToolHandler
];
