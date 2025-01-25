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

export interface NoteJson {
  content: string;
  frontmatter: Record<string, unknown>;
  path: string;
  stat: {
    ctime: number;
    mtime: number;
    size: number;
  };
  tags: string[];
}

export interface ObsidianFile {
  path: string;
  type: "file" | "folder";
  children?: ObsidianFile[];
}

export interface ObsidianCommand {
  id: string;
  name: string;
}

export interface ObsidianStatus {
  authenticated: boolean;
  ok: string;
  service: string;
  versions: {
    obsidian: string;
    self: string;
  };
}

export interface PeriodType {
  type: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
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
  result: unknown;
}

export interface SimpleSearchResult {
  filename: string;
  score: number;
  matches: SearchMatch[];
}

export type SearchResponse = SearchResult | SimpleSearchResult;

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
  [operator: string]: unknown;
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

export interface GetTagsArgs {
  path?: string;
}

export interface TagInfo {
  name: string;
  count: number;
  files: string[];
}

export interface TagMetadata {
  totalOccurrences: number;
  uniqueTags: number;
  scannedFiles: number;
  lastUpdate: number;  // Timestamp of last cache update
}

export interface TagResponse {
  tags: TagInfo[];
  metadata: TagMetadata;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200
} as const;

export interface ApiError {
  errorCode: number;  // 5-digit error code
  message: string;    // Message describing the error
}

export class ObsidianError extends Error implements ApiError {
  public readonly errorCode: number;

  constructor(
    message: string,
    errorCode: number = 50000, // Default server error code
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ObsidianError";
    
    // Ensure 5-digit error code
    if (errorCode < 10000 || errorCode > 99999) {
      // Convert HTTP status codes to 5-digit codes
      // 4xx -> 4xxxx
      // 5xx -> 5xxxx
      this.errorCode = errorCode < 1000 ? errorCode * 100 : 50000;
    } else {
      this.errorCode = errorCode;
    }
  }

  // Convert to API error format
  toApiError(): ApiError {
    return {
      errorCode: this.errorCode,
      message: this.message
    };
  }
}
