/**
 * Type definitions for Obsidian client
 */

/**
 * Configuration for the Obsidian client
 */
export interface ObsidianConfig {
  apiKey: string;
  verifySSL?: boolean;
  timeout?: number;
  maxContentLength?: number;
  maxBodyLength?: number;
}

/**
 * Server configuration for Obsidian
 */
export interface ObsidianServerConfig {
  protocol: "http" | "https";
  host: string;
  port: number;
}

/**
 * Default configuration for Obsidian server
 */
export const DEFAULT_OBSIDIAN_CONFIG: ObsidianServerConfig = {
  protocol: "https", // HTTPS required by default in Obsidian REST API plugin
  host: "127.0.0.1",
  port: 27124
} as const;

/**
 * JSON representation of an Obsidian note
 */
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

/**
 * Obsidian file/folder information
 */
export interface ObsidianFile {
  path: string;
  type: "file" | "folder";
  children?: ObsidianFile[];
}

/**
 * Obsidian command
 */
export interface ObsidianCommand {
  id: string;
  name: string;
}

/**
 * Obsidian server status
 */
export interface ObsidianStatus {
  authenticated: boolean;
  ok: string;
  service: string;
  versions: {
    obsidian: string;
    self: string;
  };
}

/**
 * Period type for periodic notes
 */
export interface PeriodType {
  type: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
}

/**
 * Search match with context
 */
export interface SearchMatch {
  context: string;
  match: {
    start: number;
    end: number;
  };
}

/**
 * Standard search result
 */
export interface SearchResult {
  filename: string;
  result: unknown;
}

/**
 * Simple search result with context
 */
export interface SimpleSearchResult {
  filename: string;
  score: number;
  matches: SearchMatch[];
}

/**
 * Union type for search responses
 */
export type SearchResponse = SearchResult | SimpleSearchResult;

/**
 * JSON Logic query for complex searches
 */
export interface JsonLogicQuery {
  [operator: string]: unknown;
}