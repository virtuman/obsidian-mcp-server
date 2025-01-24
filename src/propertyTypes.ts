import { z } from "zod";

// Define validation schemas
export const PropertyTypeEnum = z.enum([
  "concept",
  "architecture",
  "specification",
  "protocol",
  "api",
  "research",
  "implementation",
  "guide",
  "reference"
]);

export const StatusEnum = z.enum([
  "draft",
  "in-progress",
  "review",
  "complete"
]);

export const ObsidianPropertiesSchema = z.object({
  // Basic Metadata
  title: z.string().optional(),
  created: z.string().datetime().optional(),
  modified: z.string().datetime().optional(),
  author: z.string().optional(),

  // Classification
  type: z.array(PropertyTypeEnum).optional(),

  // Organization
  tags: z.array(z.string().startsWith("#")).optional(),

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

export type ObsidianProperties = z.infer<typeof ObsidianPropertiesSchema>;

export interface PropertyOperation {
  operation: 'get' | 'update' | 'patch';
  filepath: string;
  properties?: Partial<ObsidianProperties>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PropertyManagerResult {
  success: boolean;
  message: string;
  properties?: ObsidianProperties;
  errors?: string[];
}