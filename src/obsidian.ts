import axios from "axios";
import type { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import { ObsidianConfig, ObsidianError, ObsidianFile, SearchResult, DEFAULT_OBSIDIAN_CONFIG } from "./types.js";
import { Agent } from "node:https";

export class ObsidianClient {
  private client: AxiosInstance;
  private config: Required<ObsidianConfig> & typeof DEFAULT_OBSIDIAN_CONFIG;

  constructor(config: ObsidianConfig) {
    if (!config.apiKey) {
      throw new ObsidianError("API key is required", 401);
    }

    // Combine defaults with provided config
    this.config = {
      ...DEFAULT_OBSIDIAN_CONFIG,
      verifySSL: config.verifySSL ?? false, // Default to accepting self-signed certs for Obsidian
      apiKey: config.apiKey
    };

    // Configure HTTPS agent for self-signed certificates
    const httpsAgent = new Agent({
      rejectUnauthorized: this.config.verifySSL,
      requestCert: true,
      // Special handling for localhost/127.0.0.1
      checkServerIdentity: (host, cert) => {
        const localHosts = ['127.0.0.1', 'localhost'];
        if (localHosts.includes(host)) {
          return undefined; // Accept self-signed cert for local development
        }
        // For non-local hosts, perform normal certificate validation
        if (this.config.verifySSL) {
          const error = new Error('Invalid certificate');
          error.name = 'CertificateError';
          return error;
        }
        return undefined;
      }
    });

    const axiosConfig: AxiosRequestConfig = {
      baseURL: this.getBaseUrl(),
      headers: {
        ...this.getHeaders(),
        // Add security headers
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      },
      validateStatus: (status) => {
        // Accept all 2xx status codes as success
        return status >= 200 && status < 300;
      },
      timeout: 6000, // 6 seconds
      maxRedirects: 5,
      maxContentLength: 50 * 1024 * 1024, // 50MB max response size
      maxBodyLength: 50 * 1024 * 1024, // 50MB max request body size
      httpsAgent,
      // Additional security configurations
      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',
      withCredentials: true, // Enable if using cookies/sessions
      decompress: true // Handle compressed responses
    };

    if (!this.config.verifySSL) {
      console.warn("WARNING: SSL verification is disabled. This is expected for local Obsidian development but not recommended for production use.");
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
      'Content-Type': 'application/json',
      'User-Agent': `obsidian-mcp-server/1.0.0` // Identify our client
    };

    // Sanitize headers
    Object.keys(headers).forEach(key => {
      headers[key] = this.sanitizeHeader(headers[key]);
    });

    return headers;
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
      if (error && typeof error === 'object' && 'isAxiosError' in error) {
        const axiosError = error as AxiosError;
        const response = axiosError.response;
        const errorData = response?.data as { errorCode?: number; message?: string } | undefined;
        const code = errorData?.errorCode ?? -1;
        const message = errorData?.message ?? axiosError.message ?? "Unknown error";
        throw new ObsidianError(message, code, errorData);
      }
      throw error;
    }
  }

  async listFilesInVault(): Promise<ObsidianFile[]> {
    return this.safeRequest(async () => {
      // Add request ID for tracing
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Listing vault files`);
      const response = await this.client.get("/vault/");
      if (response.status !== 200) {
        throw new ObsidianError("Failed to list files", response.status, response.data);
      }
      return response.data.files;
    });
  }

  async listFilesInDir(dirpath: string): Promise<ObsidianFile[]> {
    this.validateFilePath(dirpath);
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Listing files in directory: ${dirpath}`);
      const response = await this.client.get(`/vault/${dirpath}/`);
      if (response.status !== 200) {
        throw new ObsidianError("Failed to list files in directory", response.status, response.data);
      }
      return response.data.files;
    });
  }

  async getFileContents(filepath: string): Promise<string> {
    this.validateFilePath(filepath);
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Getting file contents: ${filepath}`);
      const response = await this.client.get(`/vault/${filepath}`);
      if (response.status !== 200) {
        throw new ObsidianError("Failed to get file contents", response.status, response.data);
      }
      return response.data;
    });
  }

  async search(query: string, contextLength: number = 100): Promise<SearchResult[]> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Performing simple search: ${query}`);
      const response = await this.client.post("/search/simple/", undefined, {
        params: {
          query,
          contextLength
        }
      });
      if (response.status !== 200) {
        throw new ObsidianError("Search failed", response.status, response.data);
      }
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
      const response = await this.client.post(
        `/vault/${filepath}`,
        content,
        {
          headers: {
            "Content-Type": "text/markdown"
          }
        }
      );
      // Accept both 200 OK and 201 Created as success
      if (response.status !== 200 && response.status !== 201) {
        throw new ObsidianError("Failed to append content", response.status, response.data);
      }
    });
  }

  async patchContent(
    filepath: string,
    operation: string,
    targetType: string,
    target: string,
    content: string
  ): Promise<void> {
    this.validateFilePath(filepath);
    if (!content || typeof content !== 'string') {
      throw new ObsidianError('Invalid content: Content must be a non-empty string', 400);
    }
    if (!['append', 'prepend', 'replace'].includes(operation)) {
      throw new ObsidianError('Invalid operation: Must be append, prepend, or replace', 400);
    }
    if (!['heading', 'block', 'frontmatter'].includes(targetType)) {
      throw new ObsidianError('Invalid target type: Must be heading, block, or frontmatter', 400);
    }
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Patching content in: ${filepath}`);
      const response = await this.client.patch(
        `/vault/${filepath}`,
        content,
        {
          headers: {
            "Content-Type": "text/markdown",
            Operation: operation,
            "Target-Type": targetType,
            Target: encodeURIComponent(target)
          }
        }
      );
      if (response.status !== 200) {
        throw new ObsidianError("Failed to patch content", response.status, response.data);
      }
    });
  }

  async searchJson(query: Record<string, any>): Promise<any> {
    return this.safeRequest(async () => {
      const requestId = crypto.randomUUID();
      console.debug(`[${requestId}] Performing complex search with query:`, JSON.stringify(query));
      const response = await this.client.post(
        "/search/",
        query,
        {
          headers: {
            "Content-Type": "application/vnd.olrapi.jsonlogic+json",
            "Accept": "application/json"
          }
        }
      );
      if (response.status !== 200) {
        throw new ObsidianError("Complex search failed", response.status, response.data);
      }
      return response.data;
    });
  }
}
