import axios from "axios";
import type { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import { ObsidianConfig, ObsidianError, ObsidianFile, SearchResult, DEFAULT_OBSIDIAN_CONFIG, ObsidianServerConfig, JsonLogicQuery } from "./types.js";
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
      throw new ObsidianError("API key is required", 401);
    }

    // Combine defaults with provided config
    this.config = {
      ...DEFAULT_OBSIDIAN_CONFIG,
      verifySSL: config.verifySSL ?? process.env.NODE_ENV === 'production', // Enable SSL verification in production by default
      apiKey: config.apiKey,
      timeout: config.timeout ?? 5000,
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
      throw new ObsidianError('Invalid file path: Path traversal not allowed', 400);
    }
    
    // Additional path validations
    if (normalizedPath.startsWith('/') || /^[a-zA-Z]:/.test(normalizedPath)) {
      throw new ObsidianError('Invalid file path: Absolute paths not allowed', 400);
    }
  }

  private async safeRequest<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ errorCode?: number; message?: string }>;
        const response = axiosError.response;
        const errorData = response?.data;
        const code = errorData?.errorCode ?? response?.status ?? 500;
        const message = errorData?.message ?? axiosError.message ?? "Unknown error";
        throw new ObsidianError(message, code, errorData);
      }
      throw error;
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

  async search(query: string, contextLength: number = 100): Promise<SearchResult[]> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Performing simple search: ${query}`);
      const response = await this.client.post<SearchResult[]>("/search/simple/", undefined, {
        params: {
          query,
          contextLength
        }
      });
      return response.data;
    });
  }

  async appendContent(filepath: string, content: string): Promise<void> {
    this.validateFilePath(filepath);
    if (!content || typeof content !== 'string') {
      throw new ObsidianError('Invalid content: Content must be a non-empty string', 400);
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
      throw new ObsidianError('Invalid content: Content must be a non-empty string', 400);
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

  async searchJson(query: JsonLogicQuery): Promise<SearchResult[]> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Performing complex search with query:`, JSON.stringify(query));
      const response = await this.client.post<SearchResult[]>(
        "/search/",
        query,
        {
          headers: {
            "Content-Type": "application/vnd.olrapi.jsonlogic+json",
            "Accept": "application/json"
          }
        }
      );
      return response.data;
    });
  }
}
