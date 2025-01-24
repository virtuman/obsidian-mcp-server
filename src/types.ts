import { Tool, TextContent, ImageContent, EmbeddedResource } from "@modelcontextprotocol/sdk/types.js";

export interface ObsidianConfig {
  apiKey: string;
  verifySSL?: boolean;
}

export const DEFAULT_OBSIDIAN_CONFIG = {
  protocol: "https", // Use HTTPS with self-signed cert for local development
  host: "127.0.0.1",
  port: 27124
} as const;

export interface ObsidianFile {
  path: string;
  type: "file" | "folder";
  children?: ObsidianFile[];
}

export interface SearchMatch {
  context: string;
  match: {
    start: number;
    end: number;
  };
}

export interface SearchResult {
  filename: string;
  score: number;
  matches: SearchMatch[];
}

export interface ToolHandler<T = Record<string, unknown>> {
  name: string;
  getToolDescription(): Tool;
  runTool(args: T): Promise<Array<TextContent | ImageContent | EmbeddedResource>>;
}

export type PatchOperation = "append" | "prepend" | "replace";
export type TargetType = "heading" | "block" | "frontmatter";

export interface PatchContentArgs {
  filepath: string;
  operation: PatchOperation;
  targetType: TargetType;
  target: string;
  content: string;
}

export interface AppendContentArgs {
  filepath: string;
  content: string;
}

export interface SearchArgs {
  query: string;
  contextLength?: number;
}

export interface ComplexSearchArgs {
  query: Record<string, any>;
}

export interface FileContentsArgs {
  filepath: string;
}

export interface ListFilesArgs {
  dirpath: string;
}

export class ObsidianError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly details?: any
  ) {
    super(message);
    this.name = "ObsidianError";
  }
}
