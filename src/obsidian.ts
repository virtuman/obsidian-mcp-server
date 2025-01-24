import axios from "axios";
import type { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import {
  ObsidianConfig,
  ObsidianError,
  ObsidianFile,
  SearchResult,
  SimpleSearchResult,
  SearchResponse,
  DEFAULT_OBSIDIAN_CONFIG,
  ObsidianServerConfig,
  JsonLogicQuery,
  ObsidianStatus,
  ObsidianCommand,
  NoteJson,
  PeriodType,
  ApiError
} from "./types.js";
import { Agent } from "node:https";
import { readFileSync } from "fs";
import { fileURLToPath } from 'url';
import { dirname, join } from "path";

// Get package version for user agent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = join(__dirname, '..', '..', 'package.json');
const VERSION = (() => {
  try {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return pkg.version;
  } catch (error) {
    console.warn('Could not read package.json version:', error);
    return '1.1.0'; // Fallback version
  }
})();

export class ObsidianClient {
  private client: AxiosInstance;
  private config: Required<ObsidianConfig> & ObsidianServerConfig;

  constructor(config: ObsidianConfig) {
    if (!config.apiKey) {
      throw new ObsidianError("API key is required", 40100); // 40100 = Unauthorized
    }

    // Combine defaults with provided config
    this.config = {
      ...DEFAULT_OBSIDIAN_CONFIG,
      verifySSL: config.verifySSL ?? process.env.NODE_ENV === 'production', // Enable SSL verification in production by default
      apiKey: config.apiKey,
      timeout: config.timeout ?? 5000, // 5 second default timeout
      maxContentLength: config.maxContentLength ?? 50 * 1024 * 1024, // 50MB
      maxBodyLength: config.maxBodyLength ?? 50 * 1024 * 1024 // 50MB
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
      console.warn(
        "WARNING: SSL verification is disabled. This is not recommended for production use.",
        process.env.NODE_ENV === 'production' ? "Consider enabling SSL verification." : "This is acceptable for local development only."
      );
    }

    this.client = axios.create(axiosConfig);
  }

  private getBaseUrl(): string {
    return `${this.config.protocol}://${this.config.host}:${this.config.port}`;
  }

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
        this.sanitizeHeader(value)
      ])
    );
  }

  private sanitizeHeader(value: string): string {
    // Remove any potentially harmful characters from header values
    return value.replace(/[^\w\s\-\._~:/?#\[\]@!$&'()*+,;=]/g, '');
  }

  private validateFilePath(filepath: string): void {
    // Prevent path traversal attacks
    const normalizedPath = filepath.replace(/\\/g, '/');
    if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
      throw new ObsidianError('Invalid file path: Path traversal not allowed', 40001); // 40001 = Path traversal error
    }
    
    // Additional path validations
    if (normalizedPath.startsWith('/') || /^[a-zA-Z]:/.test(normalizedPath)) {
      throw new ObsidianError('Invalid file path: Absolute paths not allowed', 40002); // 40002 = Invalid path format
    }
  }

  private getErrorCode(status: number): number {
    // Convert HTTP status codes to 5-digit error codes
    switch (status) {
      // Client errors (400-499)
      case 400: return 40000; // Bad request
      case 401: return 40100; // Unauthorized
      case 403: return 40300; // Forbidden
      case 404: return 40400; // Not found
      case 405: return 40500; // Method not allowed
      case 409: return 40900; // Conflict
      case 429: return 42900; // Too many requests
      
      // Server errors (500-599)
      case 500: return 50000; // Internal server error
      case 501: return 50100; // Not implemented
      case 502: return 50200; // Bad gateway
      case 503: return 50300; // Service unavailable
      case 504: return 50400; // Gateway timeout
      
      // Default cases
      default:
        if (status >= 400 && status < 500) return 40000 + (status - 400) * 100;
        if (status >= 500 && status < 600) return 50000 + (status - 500) * 100;
        return 50000; // Default to internal server error
    }
  }

  private async safeRequest<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        const response = axiosError.response;
        const errorData = response?.data;
        
        // If the API returns a proper 5-digit error code, use it
        // Otherwise, convert HTTP status to 5-digit code
        const errorCode = errorData?.errorCode ??
          this.getErrorCode(response?.status ?? 500);
        
        const message = errorData?.message ??
          axiosError.message ??
          "Unknown error";
        
        throw new ObsidianError(message, errorCode, errorData);
      }
      
      // For non-Axios errors, use a generic server error code
      if (error instanceof Error) {
        throw new ObsidianError(error.message, 50000, error);
      }
      
      throw new ObsidianError("Unknown error occurred", 50000, error);
    }
  }

  async listFilesInVault(): Promise<ObsidianFile[]> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Listing vault files`);
      const response = await this.client.get<{ files: ObsidianFile[] }>("/vault/");
      return response.data.files;
    });
  }

  async listFilesInDir(dirpath: string): Promise<ObsidianFile[]> {
    this.validateFilePath(dirpath);
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Listing files in directory: ${dirpath}`);
      const response = await this.client.get<{ files: ObsidianFile[] }>(`/vault/${dirpath}/`);
      return response.data.files;
    });
  }

  async getFileContents(filepath: string): Promise<string> {
    this.validateFilePath(filepath);
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Getting file contents: ${filepath}`);
      const response = await this.client.get<string>(`/vault/${filepath}`);
      return response.data;
    });
  }

  async search(query: string, contextLength: number = 100): Promise<SimpleSearchResult[]> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Performing simple search: ${query}`);
      const response = await this.client.post<SimpleSearchResult[]>(
        "/search/simple/",
        null,
        {
          params: { query, contextLength }
        }
      );
      return response.data;
    });
  }

  async appendContent(filepath: string, content: string): Promise<void> {
    this.validateFilePath(filepath);
    if (!content || typeof content !== 'string') {
      throw new ObsidianError('Invalid content: Content must be a non-empty string', 40003); // 40003 = Invalid content
    }
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Appending content to: ${filepath}`);
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

  async updateContent(filepath: string, content: string): Promise<void> {
    this.validateFilePath(filepath);
    if (!content || typeof content !== 'string') {
      throw new ObsidianError('Invalid content: Content must be a non-empty string', 40003); // 40003 = Invalid content
    }

    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Updating content in: ${filepath}`);
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

  async searchJson(query: JsonLogicQuery): Promise<SearchResponse[]> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Performing complex search with query:`, JSON.stringify(query));
      
      // Check if this is a tag-based search
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

      if (isTagSearch) {
        return response.data as SimpleSearchResult[];
      }
      return response.data as SearchResult[];
    });
  }

  async getStatus(): Promise<ObsidianStatus> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Getting server status`);
      const response = await this.client.get<ObsidianStatus>("/");
      return response.data;
    });
  }

  async listCommands(): Promise<ObsidianCommand[]> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Listing available commands`);
      const response = await this.client.get<{commands: ObsidianCommand[]}>("/commands/");
      return response.data.commands;
    });
  }

  async executeCommand(commandId: string): Promise<void> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Executing command: ${commandId}`);
      await this.client.post(`/commands/${commandId}/`);
    });
  }

  async openFile(filepath: string, newLeaf: boolean = false): Promise<void> {
    this.validateFilePath(filepath);
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Opening file: ${filepath}`);
      await this.client.post(`/open/${filepath}`, null, {
        params: { newLeaf }
      });
    });
  }

  async getActiveFile(): Promise<NoteJson> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Getting active file`);
      const response = await this.client.get<NoteJson>("/active/", {
        headers: {
          "Accept": "application/vnd.olrapi.note+json"
        }
      });
      return response.data;
    });
  }

  async updateActiveFile(content: string): Promise<void> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Updating active file`);
      await this.client.put("/active/", content, {
        headers: {
          "Content-Type": "text/markdown"
        }
      });
    });
  }

  async deleteActiveFile(): Promise<void> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Deleting active file`);
      await this.client.delete("/active/");
    });
  }

  async patchActiveFile(operation: "append" | "prepend" | "replace", targetType: "heading" | "block" | "frontmatter", target: string, content: string, options?: {
    delimiter?: string;
    trimWhitespace?: boolean;
    contentType?: "text/markdown" | "application/json";
  }): Promise<void> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Patching active file: ${operation} ${targetType} ${target}`);
      
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

  async getPeriodicNote(period: PeriodType["type"]): Promise<NoteJson> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Getting ${period} note`);
      const response = await this.client.get<NoteJson>(`/periodic/${period}/`, {
        headers: {
          "Accept": "application/vnd.olrapi.note+json"
        }
      });
      return response.data;
    });
  }

  async updatePeriodicNote(period: PeriodType["type"], content: string): Promise<void> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Updating ${period} note`);
      await this.client.put(`/periodic/${period}/`, content, {
        headers: {
          "Content-Type": "text/markdown"
        }
      });
    });
  }

  async deletePeriodicNote(period: PeriodType["type"]): Promise<void> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Deleting ${period} note`);
      await this.client.delete(`/periodic/${period}/`);
    });
  }

  async patchPeriodicNote(period: PeriodType["type"], operation: "append" | "prepend" | "replace", targetType: "heading" | "block" | "frontmatter", target: string, content: string, options?: {
    delimiter?: string;
    trimWhitespace?: boolean;
    contentType?: "text/markdown" | "application/json";
  }): Promise<void> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Patching ${period} note: ${operation} ${targetType} ${target}`);
      
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
