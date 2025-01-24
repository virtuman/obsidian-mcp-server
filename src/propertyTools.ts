import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { ObsidianClient } from "./obsidian.js";
import { BaseToolHandler } from "./tools.js";
import { PropertyManager } from "./properties.js";
import { ObsidianProperties } from "./propertyTypes.js";

const TOOL_NAMES = {
  GET_PROPERTIES: "obsidian_get_properties",
  UPDATE_PROPERTIES: "obsidian_update_properties"
} as const;

interface GetPropertiesArgs {
  filepath: string;
}

interface UpdatePropertiesArgs {
  filepath: string;
  properties: Partial<ObsidianProperties>;
}

export class GetPropertiesToolHandler extends BaseToolHandler<GetPropertiesArgs> {
  private propertyManager: PropertyManager;

  constructor(client: ObsidianClient) {
    super(TOOL_NAMES.GET_PROPERTIES, client);
    this.propertyManager = new PropertyManager(client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "Get properties from an Obsidian note's frontmatter.",
      examples: [
        {
          description: "Get properties from a note",
          args: {
            filepath: "path/to/note.md"
          }
        }
      ],
      inputSchema: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "Path to the note file (relative to vault root)",
            format: "path"
          }
        },
        required: ["filepath"]
      }
    };
  }

  async runTool(args: GetPropertiesArgs): Promise<Array<TextContent>> {
    try {
      const result = await this.propertyManager.getProperties(args.filepath);
      return this.createResponse(result);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export class UpdatePropertiesToolHandler extends BaseToolHandler<UpdatePropertiesArgs> {
  private propertyManager: PropertyManager;

  constructor(client: ObsidianClient) {
    super(TOOL_NAMES.UPDATE_PROPERTIES, client);
    this.propertyManager = new PropertyManager(client);
  }

  getToolDescription(): Tool {
    return {
      name: this.name,
      description: "Update properties in an Obsidian note's frontmatter.",
      examples: [
        {
          description: "Update note properties",
          args: {
            filepath: "path/to/note.md",
            properties: {
              title: "New Title",
              tags: ["#tag1", "#tag2"],
              status: ["in-progress"]
            }
          }
        }
      ],
      inputSchema: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "Path to the note file (relative to vault root)",
            format: "path"
          },
          properties: {
            type: "object",
            description: "Properties to update",
            properties: {
              title: { type: "string" },
              created: { type: "string", format: "date-time" },
              modified: { type: "string", format: "date-time" },
              author: { type: "string" },
              type: {
                type: "array",
                items: {
                  type: "string",
                  enum: [
                    "concept",
                    "architecture",
                    "specification",
                    "protocol",
                    "api",
                    "research",
                    "implementation",
                    "guide",
                    "reference"
                  ]
                }
              },
              tags: {
                type: "array",
                items: { type: "string", pattern: "^#" }
              },
              status: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["draft", "in-progress", "review", "complete"]
                }
              },
              version: { type: "string" },
              platform: { type: "string" },
              repository: { type: "string", format: "uri" },
              dependencies: {
                type: "array",
                items: { type: "string" }
              },
              sources: {
                type: "array",
                items: { type: "string" }
              },
              urls: {
                type: "array",
                items: { type: "string", format: "uri" }
              },
              papers: {
                type: "array",
                items: { type: "string" }
              },
              custom: {
                type: "object",
                additionalProperties: true
              }
            },
            additionalProperties: false
          }
        },
        required: ["filepath", "properties"]
      }
    };
  }

  async runTool(args: UpdatePropertiesArgs): Promise<Array<TextContent>> {
    try {
      const result = await this.propertyManager.updateProperties(
        args.filepath,
        args.properties
      );
      return this.createResponse(result);
    } catch (error) {
      return this.handleError(error);
    }
  }
}