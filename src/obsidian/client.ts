/**
 * Obsidian REST API client implementation
 */
import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { Agent } from "node:https";
import { readFileSync } from "fs";
import { fileURLToPath } from 'url';
import { dirname, join } from "path";

import { createLogger } from '../utils/logging.js';
import { ObsidianError } from '../utils/errors.js';
import { validateFilePath, sanitizeHeader } from '../utils/validation.js';
import { 
  ObsidianConfig, 
  ObsidianServerConfig, 
  DEFAULT_OBSIDIAN_CONFIG,
  NoteJson,
  ObsidianFile,
  SimpleSearchResult,
  SearchResponse,
  JsonLogicQuery,
  ObsidianStatus,
  ObsidianCommand,
  PeriodType
} from './types.js';
import { 
  createMissingAPIKeyMessage, 
  handleAxiosError 
} from './errors.js';

// Logger for the ObsidianClient
const logger = createLogger('ObsidianClient');

// Get package version for user agent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const VERSION = (() => {
  try {
    // Look for package.json in the same directory as the built files
    const packagePath = join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return pkg.version;
  } catch (error) {
    // Try alternative location for development
    try {
      const devPackagePath = join(__dirname, '..', '..', '..', 'package.json');
      const pkg = JSON.parse(readFileSync(devPackagePath, 'utf-8'));
      return pkg.version;
    } catch (devError) {
      logger.warn('Could not read package.json version, using fallback');
      return '1.1.0'; // Fallback version
    }
  }
})();

/**
 * Client for interacting with the Obsidian Local REST API
 */
export class ObsidianClient {
  private client: AxiosInstance;
  private config: Required<ObsidianConfig> & ObsidianServerConfig;

  /**
   * Create a new ObsidianClient
   * @param config Configuration for the client
   */
  constructor(config: ObsidianConfig) {
    if (!config.apiKey) {
      throw new ObsidianError(
        createMissingAPIKeyMessage(),
        40100 // Unauthorized
      );
    }

    // Determine if we're in a development environment
    const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

    // Read environment variables with fallbacks
    const envConfig = {
      protocol: process.env.OBSIDIAN_PROTOCOL as "http" | "https" || DEFAULT_OBSIDIAN_CONFIG.protocol,
      host: process.env.OBSIDIAN_HOST || DEFAULT_OBSIDIAN_CONFIG.host,
      port: parseInt(process.env.OBSIDIAN_PORT || String(DEFAULT_OBSIDIAN_CONFIG.port)),
      verifySSL: process.env.VERIFY_SSL ? process.env.VERIFY_SSL === 'true' : (isDev ? false : true),
      timeout: parseInt(process.env.REQUEST_TIMEOUT || '5000'),
      maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH || String(50 * 1024 * 1024)),
      maxBodyLength: parseInt(process.env.MAX_BODY_LENGTH || String(50 * 1024 * 1024))
    };

    // Combine defaults with provided config and environment variables
    this.config = {
      protocol: envConfig.protocol,
      host: envConfig.host,
      port: envConfig.port,
      verifySSL: config.verifySSL ?? envConfig.verifySSL,
      apiKey: config.apiKey,
      timeout: config.timeout ?? envConfig.timeout,
      maxContentLength: config.maxContentLength ?? envConfig.maxContentLength,
      maxBodyLength: config.maxBodyLength ?? envConfig.maxBodyLength
    };

    // Configure HTTPS agent
    const httpsAgent = new Agent({
      rejectUnauthorized: this.config.verifySSL
    });

    const axiosConfig: AxiosRequestConfig = {
      baseURL: this.getBaseUrl(),
      headers: {
        ...this.getHeaders(),
        // Security headers
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      },
      validateStatus: (status) => status >= 200 && status < 300,
      timeout: this.config.timeout,
      maxRedirects: 5,
      maxContentLength: this.config.maxContentLength,
      maxBodyLength: this.config.maxBodyLength,
      httpsAgent,
      // Additional security configurations
      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',
      withCredentials: true,
      decompress: true
    };

    if (!this.config.verifySSL) {
      logger.warn(
        "WARNING: SSL verification is disabled. While this works for development, it's not recommended for production.\n" +
        "To properly configure SSL certificates:\n" +
        "1. Go to Obsidian Settings > Local REST API\n" +
        "2. Under 'How to Access', copy the certificate\n" +
        "3. For Windows users:\n" +
        "   - Open 'certmgr.msc' (Windows Certificate Manager)\n" +
        "   - Go to 'Trusted Root Certification Authorities' > 'Certificates'\n" +
        "   - Right-click > 'All Tasks' > 'Import' and follow the wizard\n" +
        "   - Select the certificate file you copied from Obsidian\n" +
        "4. For other systems:\n" +
        "   - macOS: Add to Keychain Access\n" +
        "   - Linux: Add to ca-certificates"
      );
    }

    this.client = axios.create(axiosConfig);
  }

  /**
   * Get the base URL for the Obsidian API
   */
  private getBaseUrl(): string {
    return `${this.config.protocol}://${this.config.host}:${this.config.port}`;
  }

  /**
   * Get headers for requests to the Obsidian API
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Accept': 'application/json',
      'User-Agent': `obsidian-mcp-server/${VERSION}`
    };

    // Sanitize headers
    return Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [
        key,
        sanitizeHeader(value)
      ])
    );
  }

  /**
   * Safely execute an API request with error handling
   */
  private async safeRequest<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw handleAxiosError(error, this.config.host, this.config.port);
      }
      
      if (error instanceof Error) {
        throw new ObsidianError(error.message, 50000, error);
      }
      
      throw new ObsidianError("Unknown error occurred", 50000, error);
    }
  }

  /**
   * List all files in the vault
   */
  async listFilesInVault(): Promise<ObsidianFile[]> {
    return this.safeRequest(async () => {
      logger.debug('Listing all files in vault');
      const response = await this.client.get<{ files: ObsidianFile[] }>("/vault/");
      return response.data.files;
    });
  }

  /**
   * List files in a specific directory
   */
  async listFilesInDir(dirpath: string): Promise<ObsidianFile[]> {
    validateFilePath(dirpath);
    return this.safeRequest(async () => {
      logger.debug(`Listing files in directory: ${dirpath}`);
      const response = await this.client.get<{ files: ObsidianFile[] }>(`/vault/${dirpath}/`);
      return response.data.files;
    });
  }

  /**
   * Get the contents of a file
   */
  async getFileContents(filepath: string): Promise<string> {
    validateFilePath(filepath);
    return this.safeRequest(async () => {
      logger.debug(`Getting contents of file: ${filepath}`);
      const response = await this.client.get<string>(`/vault/${filepath}`);
      return response.data;
    });
  }

  /**
   * Search for a string across all files
   */
  async search(query: string, contextLength: number = 100): Promise<SimpleSearchResult[]> {
    return this.safeRequest(async () => {
      logger.debug(`Searching for: ${query} with context length: ${contextLength}`);
      const response = await this.client.post<SimpleSearchResult[]>(
        "/search/simple/",
        null,
        { params: { query, contextLength } }
      );
      return response.data;
    });
  }

  /**
   * Append content to a file
   */
  async appendContent(filepath: string, content: string): Promise<void> {
    validateFilePath(filepath);
    if (!content || typeof content !== 'string') {
      throw new ObsidianError('Invalid content: Content must be a non-empty string', 40003);
    }
    return this.safeRequest(async () => {
      logger.debug(`Appending content to file: ${filepath}`);
      await this.client.post(
        `/vault/${filepath}`,
        content,
        {
          headers: {
            "Content-Type": "text/markdown"
          }
        }
      );
    });
  }

  /**
   * Update the entire content of a file
   */
  async updateContent(filepath: string, content: string): Promise<void> {
    validateFilePath(filepath);
    if (!content || typeof content !== 'string') {
      throw new ObsidianError('Invalid content: Content must be a non-empty string', 40003);
    }

    return this.safeRequest(async () => {
      logger.debug(`Updating content of file: ${filepath}`);
      await this.client.put(
        `/vault/${filepath}`,
        content,
        { 
          headers: {
            "Content-Type": "text/markdown"
          }
        }
      );
    });
  }

  /**
   * Execute a complex search using JsonLogic query
   */
  async searchJson(query: JsonLogicQuery): Promise<SearchResponse[]> {
    return this.safeRequest(async () => {
      logger.debug(`Executing JSON search with query: ${JSON.stringify(query)}`);
      const isTagSearch = JSON.stringify(query).includes('"contains"') &&
                         JSON.stringify(query).includes('"#"');
      
      const response = await this.client.post(
        "/search/",
        query,
        {
          headers: {
            "Content-Type": "application/vnd.olrapi.jsonlogic+json",
            "Accept": "application/vnd.olrapi.note+json"
          }
        }
      );

      return response.data as SearchResponse[];
    });
  }

  /**
   * Get server status
   */
  async getStatus(): Promise<ObsidianStatus> {
    return this.safeRequest(async () => {
      logger.debug('Getting server status');
      const response = await this.client.get<ObsidianStatus>("/");
      return response.data;
    });
  }

  /**
   * List available commands
   */
  async listCommands(): Promise<ObsidianCommand[]> {
    return this.safeRequest(async () => {
      logger.debug('Listing commands');
      const response = await this.client.get<{commands: ObsidianCommand[]}>("/commands/");
      return response.data.commands;
    });
  }

  /**
   * Execute a command by ID
   */
  async executeCommand(commandId: string): Promise<void> {
    return this.safeRequest(async () => {
      logger.debug(`Executing command: ${commandId}`);
      await this.client.post(`/commands/${commandId}/`);
    });
  }

  /**
   * Open a file in Obsidian
   */
  async openFile(filepath: string, newLeaf: boolean = false): Promise<void> {
    validateFilePath(filepath);
    return this.safeRequest(async () => {
      logger.debug(`Opening file: ${filepath}, newLeaf: ${newLeaf}`);
      await this.client.post(`/open/${filepath}`, null, {
        params: { newLeaf }
      });
    });
  }

  /**
   * Get the currently active file
   */
  async getActiveFile(): Promise<NoteJson> {
    return this.safeRequest(async () => {
      logger.debug('Getting active file');
      const response = await this.client.get<NoteJson>("/active/", {
        headers: {
          "Accept": "application/vnd.olrapi.note+json"
        }
      });
      return response.data;
    });
  }

  /**
   * Update the active file
   */
  async updateActiveFile(content: string): Promise<void> {
    return this.safeRequest(async () => {
      logger.debug('Updating active file');
      await this.client.put("/active/", content, {
        headers: {
          "Content-Type": "text/markdown"
        }
      });
    });
  }

  /**
   * Delete the active file
   */
  async deleteActiveFile(): Promise<void> {
    return this.safeRequest(async () => {
      logger.debug('Deleting active file');
      await this.client.delete("/active/");
    });
  }

  /**
   * Patch the active file
   */
  async patchActiveFile(
    operation: "append" | "prepend" | "replace",
    targetType: "heading" | "block" | "frontmatter",
    target: string,
    content: string,
    options?: {
      delimiter?: string;
      trimWhitespace?: boolean;
      contentType?: "text/markdown" | "application/json";
    }
  ): Promise<void> {
    return this.safeRequest(async () => {
      logger.debug(`Patching active file: ${operation} ${targetType} "${target}"`);
      const headers: Record<string, string> = {
        "Operation": operation,
        "Target-Type": targetType,
        "Target": target,
        "Content-Type": options?.contentType || "text/markdown"
      };

      if (options?.delimiter) {
        headers["Target-Delimiter"] = options.delimiter;
      }
      if (options?.trimWhitespace !== undefined) {
        headers["Trim-Target-Whitespace"] = options.trimWhitespace.toString();
      }

      await this.client.patch("/active/", content, { headers });
    });
  }

  /**
   * Get a periodic note (e.g., daily, weekly)
   */
  async getPeriodicNote(period: PeriodType["type"]): Promise<NoteJson> {
    return this.safeRequest(async () => {
      logger.debug(`Getting ${period} periodic note`);
      const response = await this.client.get<NoteJson>(`/periodic/${period}/`, {
        headers: {
          "Accept": "application/vnd.olrapi.note+json"
        }
      });
      return response.data;
    });
  }

  /**
   * Update a periodic note
   */
  async updatePeriodicNote(period: PeriodType["type"], content: string): Promise<void> {
    return this.safeRequest(async () => {
      logger.debug(`Updating ${period} periodic note`);
      await this.client.put(`/periodic/${period}/`, content, {
        headers: {
          "Content-Type": "text/markdown"
        }
      });
    });
  }

  /**
   * Delete a periodic note
   */
  async deletePeriodicNote(period: PeriodType["type"]): Promise<void> {
    return this.safeRequest(async () => {
      logger.debug(`Deleting ${period} periodic note`);
      await this.client.delete(`/periodic/${period}/`);
    });
  }

  /**
   * Patch a periodic note
   */
  async patchPeriodicNote(
    period: PeriodType["type"],
    operation: "append" | "prepend" | "replace",
    targetType: "heading" | "block" | "frontmatter",
    target: string,
    content: string,
    options?: {
      delimiter?: string;
      trimWhitespace?: boolean;
      contentType?: "text/markdown" | "application/json";
    }
  ): Promise<void> {
    return this.safeRequest(async () => {
      logger.debug(`Patching ${period} periodic note: ${operation} ${targetType} "${target}"`);
      const headers: Record<string, string> = {
        "Operation": operation,
        "Target-Type": targetType,
        "Target": target,
        "Content-Type": options?.contentType || "text/markdown"
      };

      if (options?.delimiter) {
        headers["Target-Delimiter"] = options.delimiter;
      }
      if (options?.trimWhitespace !== undefined) {
        headers["Trim-Target-Whitespace"] = options.trimWhitespace.toString();
      }

      await this.client.patch(`/periodic/${period}/`, content, { headers });
    });
  }
}