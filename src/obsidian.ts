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
      throw new ObsidianError(
        "Missing API key. To fix this:\n" +
        "1. Install the 'Local REST API' plugin in Obsidian\n" +
        "2. Enable the plugin in Obsidian Settings\n" +
        "3. Copy your API key from Obsidian Settings > Local REST API\n" +
        "4. Provide the API key in your configuration",
        40100 // Unauthorized
      );
    }

    // Combine defaults with provided config
    this.config = {
      ...DEFAULT_OBSIDIAN_CONFIG,
      verifySSL: config.verifySSL ?? true, // Default to true as required by Obsidian REST API plugin
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
        "WARNING: SSL verification is disabled. The Obsidian REST API plugin requires HTTPS by default.\n" +
        "Make sure you have configured the certificate as a trusted certificate authority.\n" +
        "See Obsidian Settings > Local REST API > 'How to Access' for setup instructions."
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
      throw new ObsidianError('Invalid file path: Path traversal not allowed', 40001);
    }
    
    // Additional path validations
    if (normalizedPath.startsWith('/') || /^[a-zA-Z]:/.test(normalizedPath)) {
      throw new ObsidianError('Invalid file path: Absolute paths not allowed', 40002);
    }
  }

  private getErrorCode(status: number): number {
    switch (status) {
      case 400: return 40000; // Bad request
      case 401: return 40100; // Unauthorized
      case 403: return 40300; // Forbidden
      case 404: return 40400; // Not found
      case 405: return 40500; // Method not allowed
      case 409: return 40900; // Conflict
      case 429: return 42900; // Too many requests
      case 500: return 50000; // Internal server error
      case 501: return 50100; // Not implemented
      case 502: return 50200; // Bad gateway
      case 503: return 50300; // Service unavailable
      case 504: return 50400; // Gateway timeout
      default:
        if (status >= 400 && status < 500) return 40000 + (status - 400) * 100;
        if (status >= 500 && status < 600) return 50000 + (status - 500) * 100;
        return 50000;
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

        // Handle common connection errors with helpful messages
        if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
          throw new ObsidianError(
            `SSL certificate verification failed. You have two options:\n\n` +
            `Option 1 - Enable HTTP (not recommended for production):\n` +
            `1. Go to Obsidian Settings > Local REST API\n` +
            `2. Enable "Enable Non-encrypted (HTTP) Server"\n` +
            `3. Update your client config to use "http" protocol\n\n` +
            `Option 2 - Configure HTTPS (recommended):\n` +
            `1. Go to Obsidian Settings > Local REST API\n` +
            `2. Under 'How to Access', copy the certificate\n` +
            `3. Add the certificate to your system's trusted certificates:\n` +
            `   - On macOS: Add to Keychain Access\n` +
            `   - On Windows: Add to Certificate Manager\n` +
            `   - On Linux: Add to ca-certificates\n` +
            `   For development only: Set verifySSL: false in client config\n\n` +
            `Original error: ${error.message}`,
            50001, // SSL error code
            { code: error.code, config: { verifySSL: this.config.verifySSL } }
          );
        }

        if (error.code === 'ECONNREFUSED') {
          throw new ObsidianError(
            `Connection refused. To fix this:\n` +
            `1. Ensure Obsidian is running\n` +
            `2. Verify the 'Local REST API' plugin is enabled in Obsidian Settings\n` +
            `3. Check that you're using the correct host (${this.config.host}) and port (${this.config.port})\n` +
            `4. Make sure HTTPS is enabled in the plugin settings`,
            50002, // Connection refused
            { code: error.code }
          );
        }

        if (response?.status === 401) {
          throw new ObsidianError(
            `Authentication failed. To fix this:\n` +
            `1. Go to Obsidian Settings > Local REST API\n` +
            `2. Copy your API key from the settings\n` +
            `3. Update your configuration with the new API key\n` +
            `Note: The API key changes when you regenerate certificates`,
            40100, // Unauthorized
            { code: error.code }
          );
        }

        // For other errors, use API error code if available
        const errorCode = errorData?.errorCode ?? this.getErrorCode(response?.status ?? 500);
        const message = errorData?.message ?? axiosError.message ?? "Unknown error";
        throw new ObsidianError(message, errorCode, errorData);
      }
      
      if (error instanceof Error) {
        throw new ObsidianError(error.message, 50000, error);
      }
      
      throw new ObsidianError("Unknown error occurred", 50000, error);
    }
  }

  async listFilesInVault(): Promise<ObsidianFile[]> {
    return this.safeRequest(async () => {
      const response = await this.client.get<{ files: ObsidianFile[] }>("/vault/");
      return response.data.files;
    });
  }

  async listFilesInDir(dirpath: string): Promise<ObsidianFile[]> {
    this.validateFilePath(dirpath);
    return this.safeRequest(async () => {
      const response = await this.client.get<{ files: ObsidianFile[] }>(`/vault/${dirpath}/`);
      return response.data.files;
    });
  }

  async getFileContents(filepath: string): Promise<string> {
    this.validateFilePath(filepath);
    return this.safeRequest(async () => {
      const response = await this.client.get<string>(`/vault/${filepath}`);
      return response.data;
    });
  }

  async search(query: string, contextLength: number = 100): Promise<SimpleSearchResult[]> {
    return this.safeRequest(async () => {
      const response = await this.client.post<SimpleSearchResult[]>(
        "/search/simple/",
        null,
        { params: { query, contextLength } }
      );
      return response.data;
    });
  }

  async appendContent(filepath: string, content: string): Promise<void> {
    this.validateFilePath(filepath);
    if (!content || typeof content !== 'string') {
      throw new ObsidianError('Invalid content: Content must be a non-empty string', 40003);
    }
    return this.safeRequest(async () => {
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
      throw new ObsidianError('Invalid content: Content must be a non-empty string', 40003);
    }

    return this.safeRequest(async () => {
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

      return isTagSearch ? response.data as SimpleSearchResult[] : response.data as SearchResult[];
    });
  }

  async getStatus(): Promise<ObsidianStatus> {
    return this.safeRequest(async () => {
      const response = await this.client.get<ObsidianStatus>("/");
      return response.data;
    });
  }

  async listCommands(): Promise<ObsidianCommand[]> {
    return this.safeRequest(async () => {
      const response = await this.client.get<{commands: ObsidianCommand[]}>("/commands/");
      return response.data.commands;
    });
  }

  async executeCommand(commandId: string): Promise<void> {
    return this.safeRequest(async () => {
      await this.client.post(`/commands/${commandId}/`);
    });
  }

  async openFile(filepath: string, newLeaf: boolean = false): Promise<void> {
    this.validateFilePath(filepath);
    return this.safeRequest(async () => {
      await this.client.post(`/open/${filepath}`, null, {
        params: { newLeaf }
      });
    });
  }

  async getActiveFile(): Promise<NoteJson> {
    return this.safeRequest(async () => {
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
      await this.client.put("/active/", content, {
        headers: {
          "Content-Type": "text/markdown"
        }
      });
    });
  }

  async deleteActiveFile(): Promise<void> {
    return this.safeRequest(async () => {
      await this.client.delete("/active/");
    });
  }

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
      await this.client.put(`/periodic/${period}/`, content, {
        headers: {
          "Content-Type": "text/markdown"
        }
      });
    });
  }

  async deletePeriodicNote(period: PeriodType["type"]): Promise<void> {
    return this.safeRequest(async () => {
      await this.client.delete(`/periodic/${period}/`);
    });
  }

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
