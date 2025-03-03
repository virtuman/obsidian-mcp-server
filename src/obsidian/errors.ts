/**
 * Error handling for Obsidian client
 */
import { AxiosError } from "axios";
import { ObsidianError, getErrorCodeFromStatus } from '../utils/errors.js';
import type { ApiError } from '../utils/errors.js';

/**
 * Helper function to create a descriptive error message for SSL certificate issues
 */
export function createSSLErrorMessage(error: Error, config: { verifySSL: boolean }): string {
  return (
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
    `Original error: ${error.message}`
  );
}

/**
 * Helper function to create a descriptive error message for connection refused issues
 */
export function createConnectionRefusedMessage(host: string, port: number): string {
  return (
    `Connection refused. To fix this:\n` +
    `1. Ensure Obsidian is running\n` +
    `2. Verify the 'Local REST API' plugin is enabled in Obsidian Settings\n` +
    `3. Check that you're using the correct host (${host}) and port (${port})\n` +
    `4. Make sure HTTPS is enabled in the plugin settings`
  );
}

/**
 * Helper function to create a descriptive error message for authentication failures
 */
export function createAuthFailedMessage(): string {
  return (
    `Authentication failed. To fix this:\n` +
    `1. Go to Obsidian Settings > Local REST API\n` +
    `2. Copy your API key from the settings\n` +
    `3. Update your configuration with the new API key\n` +
    `Note: The API key changes when you regenerate certificates`
  );
}

/**
 * Helper function to create a descriptive error message for missing API key
 */
export function createMissingAPIKeyMessage(): string {
  return (
    `Missing API key. To fix this:\n` +
    `1. Install the 'Local REST API' plugin in Obsidian\n` +
    `2. Enable the plugin in Obsidian Settings\n` +
    `3. Copy your API key from Obsidian Settings > Local REST API\n` +
    `4. Provide the API key in your configuration`
  );
}

/**
 * Helper function to handle Axios errors consistently
 */
export function handleAxiosError(error: AxiosError<ApiError>, host: string, port: number): ObsidianError {
  const response = error.response;
  const errorData = response?.data;
    
  // Handle common connection errors with helpful messages
  if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    return new ObsidianError(
      createSSLErrorMessage(error, { verifySSL: true }),
      50001, // SSL error code
      { code: error.code }
    );
  }

  if (error.code === 'ECONNREFUSED') {
    return new ObsidianError(
      createConnectionRefusedMessage(host, port),
      50002, // Connection refused
      { code: error.code }
    );
  }

  if (response?.status === 401) {
    return new ObsidianError(
      createAuthFailedMessage(),
      40100, // Unauthorized
      { code: error.code }
    );
  }

  // For other errors, use API error code if available
  const errorCode = errorData?.errorCode ?? getErrorCodeFromStatus(response?.status ?? 500);
  const message = errorData?.message ?? error.message ?? "Unknown error";
  return new ObsidianError(message, errorCode, errorData);
}