/**
 * Property manager for Obsidian notes
 */
import { EOL } from 'os';
import { parse, stringify } from 'yaml';
import { ObsidianClient } from '../../obsidian/client.js';
import { createLogger } from '../../utils/logging.js';
import {
  ObsidianProperties,
  ObsidianPropertiesSchema,
  PropertyManagerResult,
  PropertyUpdateSchema,
  ValidationResult
} from './types.js';

// Create a logger for property operations
const logger = createLogger('PropertyManager');

/**
 * Manages YAML frontmatter properties in Obsidian notes
 */
export class PropertyManager {
  constructor(private client: ObsidianClient) {}

  /**
   * Parse YAML frontmatter from note content
   * @param content The note content
   * @returns Extracted properties
   */
  parseProperties(content: string): ObsidianProperties {
    try {
      // Extract frontmatter between --- markers (handles both \n and \r\n)
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) {
        logger.debug('No frontmatter found in content');
        return {};
      }

      const frontmatter = match[1];
      const properties = parse(frontmatter);
      
      // Handle tags - don't add # prefix in frontmatter
      if (properties.tags && Array.isArray(properties.tags)) {
        properties.tags = properties.tags.map((tag: string) =>
          tag.startsWith('#') ? tag.substring(1) : tag
        );
      }

      // Validate against schema
      const result = ObsidianPropertiesSchema.safeParse(properties);
      if (!result.success) {
        logger.warn('Property validation warnings:', { validationError: result.error });
        // Return the properties with fixed tags
        return properties;
      }

      return result.data;
    } catch (error) {
      logger.error('Error parsing properties:', error instanceof Error ? error : { error: String(error) });
      return {};
    }
  }

  /**
   * Generate YAML frontmatter from properties
   * @param properties The properties to convert to YAML
   * @returns YAML frontmatter string
   */
  generateProperties(properties: Partial<ObsidianProperties>): string {
    try {
      // Remove undefined values
      const cleanProperties = Object.fromEntries(
        Object.entries(properties).filter(([_, v]) => v !== undefined)
      );

      // Generate YAML with platform-specific line endings
      const yaml = stringify(cleanProperties);
      return `---${EOL}${yaml}---${EOL}`;
    } catch (error) {
      logger.error('Error generating properties:', error instanceof Error ? error : { error: String(error) });
      throw error;
    }
  }

  /**
   * Validate property values against schema
   * @param properties The properties to validate
   * @returns Validation result
   */
  validateProperties(properties: Partial<ObsidianProperties>): ValidationResult {
    const result = PropertyUpdateSchema.safeParse(properties);
    
    if (result.success) {
      return { valid: true, errors: [] };
    }

    return {
      valid: false,
      errors: result.error.errors.map(err =>
        `${err.path.join('.')}: ${err.message}`
      )
    };
  }

  /**
   * Merge new properties with existing ones
   * @param existing The existing properties
   * @param updates The new properties to merge
   * @param replace Whether to replace arrays instead of merging them
   * @returns The merged properties
   */
  mergeProperties(
    existing: ObsidianProperties,
    updates: Partial<ObsidianProperties>,
    replace: boolean = false
  ): ObsidianProperties {
    const merged = { ...existing };

    for (const [key, value] of Object.entries(updates)) {
      // Skip undefined values and timestamp fields
      if (value === undefined || key === 'created' || key === 'modified') continue;

      const currentValue = merged[key as keyof ObsidianProperties];

      // Handle arrays based on replace flag
      if (Array.isArray(value) && Array.isArray(currentValue)) {
        merged[key as keyof ObsidianProperties] = replace ?
          value :
          [...new Set([...currentValue, ...value])] as any;
      }
      // Special handling for custom object - deep merge
      else if (key === 'custom' && typeof value === 'object' && value !== null) {
        merged.custom = {
          ...merged.custom,
          ...value
        };
      }
      // Default case - replace value
      else {
        merged[key as keyof ObsidianProperties] = value as any;
      }
    }

    // Always update modified date (this is the only place we set it)
    merged.modified = new Date().toISOString();

    return merged;
  }

  /**
   * Get properties from a note
   * @param filepath Path to the note
   * @returns The properties from the note
   */
  async getProperties(filepath: string): Promise<PropertyManagerResult> {
    try {
      logger.debug(`Getting properties from file: ${filepath}`);
      const content = await this.client.getFileContents(filepath);
      const properties = this.parseProperties(content);

      return {
        success: true,
        message: 'Properties retrieved successfully',
        properties
      };
    } catch (error) {
      logger.error(`Failed to get properties from ${filepath}:`, error instanceof Error ? error : { error: String(error) });
      return {
        success: false,
        message: `Failed to get properties: ${error instanceof Error ? error.message : String(error)}`,
        errors: [String(error)]
      };
    }
  }

  /**
   * Update properties of a note
   * @param filepath Path to the note
   * @param newProperties The new properties to apply
   * @param replace Whether to replace arrays instead of merging them
   * @returns The result of the update operation
   */
  async updateProperties(
    filepath: string,
    newProperties: Partial<ObsidianProperties>,
    replace: boolean = false
  ): Promise<PropertyManagerResult> {
    try {
      // Validate new properties
      const validation = this.validateProperties(newProperties);
      if (!validation.valid) {
        logger.warn(`Invalid properties for ${filepath}:`, { errors: validation.errors });
        return {
          success: false,
          message: 'Invalid properties',
          errors: validation.errors
        };
      }

      // Get existing content and properties
      logger.debug(`Updating properties for file: ${filepath}`);
      const content = await this.client.getFileContents(filepath);
      const existingProperties = this.parseProperties(content);

      // Merge properties
      const mergedProperties = this.mergeProperties(existingProperties, newProperties, replace);

      // Generate new frontmatter
      const newFrontmatter = this.generateProperties(mergedProperties);

      // Replace existing frontmatter or prepend to file (handles both \n and \r\n)
      const newContent = content.replace(/^---[\s\S]*?---\r?\n/, '') || '';
      const updatedContent = newFrontmatter + newContent;

      // Update file
      await this.client.updateContent(filepath, updatedContent);
      logger.debug(`Successfully updated properties for ${filepath}`);

      return {
        success: true,
        message: 'Properties updated successfully',
        properties: mergedProperties
      };
    } catch (error) {
      logger.error(`Failed to update properties for ${filepath}:`, error instanceof Error ? error : { error: String(error) });
      return {
        success: false,
        message: `Failed to update properties: ${error instanceof Error ? error.message : String(error)}`,
        errors: [String(error)]
      };
    }
  }
}