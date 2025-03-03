/**
 * File listing tools implementation
 */
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ObsidianClient } from "../../obsidian/client.js";
import { BaseToolHandler } from "../base.js";
import { createLogger } from "../../utils/logging.js";

// Create a logger for file operations
const logger = createLogger('FileTools');

/**
 * Tool names for file listing operations
 */
export const FILE_TOOL_NAMES = {
  LIST_FILES_IN_VAULT: "obsidian_list_files_in_vault",
  LIST_FILES_IN_DIR: "obsidian_list_files_in_dir"
} as const;

/**
 * Arguments for directory listing
 */
export interface ListFilesArgs {
  dirpath: string;
}

/**
 * Tool handler for listing all files in the vault
 */
export class ListFilesInVaultToolHandler extends BaseToolHandler<Record<string, never>> {
  constructor(client: ObsidianClient) {
    super(FILE_TOOL_NAMES.LIST_FILES_IN_VAULT, client);
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

  async runTool(): Promise<Array<any>> {
    try {
      logger.debug('Listing all files in vault');
      const files = await this.client.listFilesInVault();
      return this.createResponse(files);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

/**
 * Tool handler for listing files in a specific directory
 */
export class ListFilesInDirToolHandler extends BaseToolHandler<ListFilesArgs> {
  constructor(client: ObsidianClient) {
    super(FILE_TOOL_NAMES.LIST_FILES_IN_DIR, client);
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

  async runTool(args: ListFilesArgs): Promise<Array<any>> {
    try {
      logger.debug(`Listing files in directory: ${args.dirpath}`);
      const files = await this.client.listFilesInDir(args.dirpath);
      return this.createResponse(files);
    } catch (error) {
      return this.handleError(error);
    }
  }
}