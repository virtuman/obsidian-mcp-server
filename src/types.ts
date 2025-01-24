import { Tool, TextContent, ImageContent, EmbeddedResource } from "@modelcontextprotocol/sdk/types.js";

export interface ObsidianConfig {
  apiKey: string;
  verifySSL?: boolean;
  timeout?: number;
  maxContentLength?: number;
  maxBodyLength?: number;
}

export interface ObsidianServerConfig {
  protocol: "http" | "https";
  host: string;
  port: number;
}

export const DEFAULT_OBSIDIAN_CONFIG: ObsidianServerConfig = {
  protocol: "https",
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

export interface PatchContentArgs {
  filepath: string;
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

export interface JsonLogicQuery {
  [operator: string]: unknown[];
}

export interface ComplexSearchArgs {
  query: JsonLogicQuery;
}

export interface FileContentsArgs {
  filepath: string;
}

export interface ListFilesArgs {
  dirpath: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200
} as const;

export class ObsidianError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ObsidianError";
  }
}
