/**
 * Validation utilities for the Obsidian MCP Server
 */

/**
 * Validates a file path to prevent path traversal attacks and other security issues
 * @param filepath The path to validate
 * @throws Error if the path is invalid
 */
export function validateFilePath(filepath: string): void {
  // Prevent path traversal attacks
  const normalizedPath = filepath.replace(/\\/g, '/');
  if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
    throw new Error('Invalid file path: Path traversal not allowed');
  }
  
  // Additional path validations
  if (normalizedPath.startsWith('/') || /^[a-zA-Z]:/.test(normalizedPath)) {
    throw new Error('Invalid file path: Absolute paths not allowed');
  }
}

/**
 * Sanitizes a header value to prevent header injection attacks
 * @param value The header value to sanitize
 * @returns The sanitized header value
 */
export function sanitizeHeader(value: string): string {
  // Remove any potentially harmful characters from header values
  return value.replace(/[^\w\s\-\._~:/?#\[\]@!$&'()*+,;=]/g, '');
}

/**
 * Validates tool arguments against a JSON schema
 * @param args The arguments to validate
 * @param schema The JSON schema to validate against
 * @returns Validation result with errors if any
 */
export function validateToolArguments(args: unknown, schema: any): { valid: boolean; errors: string[] } {
  if (typeof args !== 'object' || args === null) {
    return { valid: false, errors: ['Arguments must be an object'] };
  }

  const errors: string[] = [];
  const required = schema.required || [];
  
  // Check required fields
  for (const field of required) {
    if (!(field in (args as Record<string, unknown>))) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check field types
  const properties = schema.properties || {};
  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    const propSchema = properties[key];
    if (!propSchema) {
      errors.push(`Unknown field: ${key}`);
      continue;
    }

    // Skip validation for undefined optional fields
    if (value === undefined && !required.includes(key)) {
      continue;
    }

    // Type validation
    if (propSchema.type === 'string' && typeof value !== 'string') {
      errors.push(`Field ${key} must be a string`);
    } else if (propSchema.type === 'number' && typeof value !== 'number') {
      errors.push(`Field ${key} must be a number`);
    } else if (propSchema.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Field ${key} must be a boolean`);
    } else if (propSchema.type === 'array' && !Array.isArray(value)) {
      errors.push(`Field ${key} must be an array`);
    }

    // Enum validation
    if (propSchema.enum && value !== undefined && !propSchema.enum.includes(value)) {
      errors.push(`Field ${key} must be one of: ${propSchema.enum.join(', ')}`);
    }

    // Format validation for paths
    if (propSchema.format === 'path' && typeof value === 'string') {
      try {
        validateFilePath(value);
      } catch (error) {
        errors.push(`Field ${key}: ${(error as Error).message}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}