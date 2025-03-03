/**
 * Property types and schemas for Obsidian notes
 */
import { z } from "zod";

/**
 * Define validation schemas
 * Allow any string for type to be more flexible
 */
export const PropertyType = z.string();

/**
 * Valid status values for notes
 */
export const StatusEnum = z.enum([
  "draft",
  "in-progress",
  "review",
  "complete"
]);

/**
 * Schema for reading properties (includes timestamps)
 */
export const ObsidianPropertiesSchema = z.object({
  // Basic Metadata
  // Note: Timestamps are managed automatically
  title: z.string().optional(),
  modified: z.string().datetime().optional(), // Read-only, managed by MCP server
  author: z.string().optional(),

  // Classification
  type: z.array(PropertyType).optional(),

  // Organization
  tags: z.array(z.string()).optional(),

  // Technical Metadata
  status: z.array(StatusEnum).optional(),
  version: z.string().optional(),
  platform: z.string().optional(),
  repository: z.string().url().optional(),
  dependencies: z.array(z.string()).optional(),

  // References
  sources: z.array(z.string()).optional(),
  urls: z.array(z.string().url()).optional(),
  papers: z.array(z.string()).optional(),

  // Custom Fields
  custom: z.record(z.unknown()).optional()
});

/**
 * Schema for validating property updates (excludes timestamps)
 */
export const PropertyUpdateSchema = z.object({
  // Basic Metadata
  title: z.string().optional(),
  author: z.string().optional(),

  // Classification
  type: z.array(PropertyType).optional(),

  // Organization
  tags: z.array(z.string()).optional(),

  // Technical Metadata
  status: z.array(StatusEnum).optional(),
  version: z.string().optional(),
  platform: z.string().optional(),
  repository: z.string().url().optional(),
  dependencies: z.array(z.string()).optional(),

  // References
  sources: z.array(z.string()).optional(),
  urls: z.array(z.string().url()).optional(),
  papers: z.array(z.string()).optional(),

  // Custom Fields
  custom: z.record(z.unknown()).optional()
});

/**
 * Derived types from schemas
 */
export type ObsidianProperties = z.infer<typeof ObsidianPropertiesSchema>;
export type PropertyUpdate = z.infer<typeof PropertyUpdateSchema>;

/**
 * Property operation description
 */
export interface PropertyOperation {
  operation: 'get' | 'update' | 'patch';
  filepath: string;
  properties?: Partial<ObsidianProperties>;
  replace?: boolean;
}

/**
 * Result of property validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Result of property operations
 */
export interface PropertyManagerResult {
  success: boolean;
  message: string;
  properties?: ObsidianProperties;
  errors?: string[];
}