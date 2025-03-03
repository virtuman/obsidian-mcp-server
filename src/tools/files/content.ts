/**
 * File content manipulation tools implementation
 */
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ObsidianClient } from "../../obsidian/client.js";
import { BaseToolHandler } from "../base.js";
import { createLogger } from "../../utils/logging.js";

// Create a logger for file content operations
const logger = createLogger('FileContentTools');

/**
 * Tool names for file content operations
 */
export const FILE_CONTENT_TOOL_NAMES = {
  GET_FILE_CONTENTS: "obsidian_get_file_contents",
  APPEND_CONTENT: "obsidian_append_content",
  PATCH_CONTENT: "obsidian_patch_content"
} as const;

/**
 * Arguments for file content operations
 */
export interface FileContentsArgs {
  filepath: string;
}

/**
 * Arguments for appending content to a file
 */
export interface AppendContentArgs {
  filepath: string;
  content: string;
}

/**
 * Arguments for updating content of a file
 */
export interface PatchContentArgs {
  filepath: string;
  content: string;
}

/**
 * Tool handler for getting file contents
 */
export class GetFileContentsToolHandler extends BaseToolHandler<FileContentsArgs> {
  constructor(client: ObsidianClient) {
    super(FILE_CONTENT_TOOL_NAMES.GET_FILE_CONTENTS, client);
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

  async runTool(args: FileContentsArgs): Promise<Array<any>> {
    try {
      logger.debug(`Getting contents of file: ${args.filepath}`);
      const content = await this.client.getFileContents(args.filepath);
      return this.createResponse(content);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

/**
 * Tool handler for appending content to a file
 */
export class AppendContentToolHandler extends BaseToolHandler<AppendContentArgs> {
  constructor(client: ObsidianClient) {
    super(FILE_CONTENT_TOOL_NAMES.APPEND_CONTENT, client);
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

  async runTool(args: AppendContentArgs): Promise<Array<any>> {
    try {
      logger.debug(`Appending content to file: ${args.filepath}`);
      await this.client.appendContent(args.filepath, args.content);
      return this.createResponse({ 
        message: `Successfully appended content to ${args.filepath}`,
        success: true
      });
    } catch (error) {
      return this.handleError(error);
    }
  }
}

/**
 * Tool handler for updating file content
 */
export class PatchContentToolHandler extends BaseToolHandler<PatchContentArgs> {
  constructor(client: ObsidianClient) {
    super(FILE_CONTENT_TOOL_NAMES.PATCH_CONTENT, client);
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

  async runTool(args: PatchContentArgs): Promise<Array<any>> {
    try {
      logger.debug(`Updating content of file: ${args.filepath}`);
      await this.client.updateContent(args.filepath, args.content);
      return this.createResponse({ 
        message: `Successfully updated content in ${args.filepath}`,
        success: true
      });
    } catch (error) {
      return this.handleError(error);
    }
  }
}