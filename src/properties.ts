import { parse, stringify } from 'yaml';
import { ObsidianClient } from './obsidian.js';
import { 
  ObsidianProperties, 
  ObsidianPropertiesSchema, 
  PropertyManagerResult,
  ValidationResult 
} from './propertyTypes.js';

export class PropertyManager {
  constructor(private client: ObsidianClient) {}

  /**
   * Parse YAML frontmatter from note content
   */
  parseProperties(content: string): ObsidianProperties {
    try {
      // Extract frontmatter between --- markers
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match) {
        return {};
      }

      const frontmatter = match[1];
      const properties = parse(frontmatter);
      
      // Validate against schema
      const result = ObsidianPropertiesSchema.safeParse(properties);
      if (!result.success) {
        console.warn('Property validation warnings:', result.error);
        // Return partial valid properties rather than throwing
        return properties;
      }

      return result.data;
    } catch (error) {
      console.error('Error parsing properties:', error);
      return {};
    }
  }

  /**
   * Generate YAML frontmatter from properties
   */
  generateProperties(properties: Partial<ObsidianProperties>): string {
    try {
      // Remove undefined values
      const cleanProperties = Object.fromEntries(
        Object.entries(properties).filter(([_, v]) => v !== undefined)
      );

      // Generate YAML
      const yaml = stringify(cleanProperties);
      return `---\n${yaml}---\n`;
    } catch (error) {
      console.error('Error generating properties:', error);
      throw error;
    }
  }

  /**
   * Validate property values
   */
  validateProperties(properties: Partial<ObsidianProperties>): ValidationResult {
    const result = ObsidianPropertiesSchema.safeParse(properties);
    
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
   */
  mergeProperties(
    existing: ObsidianProperties,
    updates: Partial<ObsidianProperties>
  ): ObsidianProperties {
    const merged = { ...existing };

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;

      const currentValue = merged[key as keyof ObsidianProperties];

      // Special handling for arrays - merge rather than replace
      if (Array.isArray(value) && Array.isArray(currentValue)) {
        merged[key as keyof ObsidianProperties] = [
          ...new Set([...currentValue, ...value])
        ] as any;
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

    // Always update modified date
    merged.modified = new Date().toISOString();

    return merged;
  }

  /**
   * Get properties from a note
   */
  async getProperties(filepath: string): Promise<PropertyManagerResult> {
    try {
      const content = await this.client.getFileContents(filepath);
      const properties = this.parseProperties(content);

      return {
        success: true,
        message: 'Properties retrieved successfully',
        properties
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get properties: ${error instanceof Error ? error.message : String(error)}`,
        errors: [String(error)]
      };
    }
  }

  /**
   * Update properties of a note
   */
  async updateProperties(
    filepath: string,
    newProperties: Partial<ObsidianProperties>
  ): Promise<PropertyManagerResult> {
    try {
      // Validate new properties
      const validation = this.validateProperties(newProperties);
      if (!validation.valid) {
        return {
          success: false,
          message: 'Invalid properties',
          errors: validation.errors
        };
      }

      // Get existing content and properties
      const content = await this.client.getFileContents(filepath);
      const existingProperties = this.parseProperties(content);

      // Merge properties
      const mergedProperties = this.mergeProperties(existingProperties, newProperties);

      // Generate new frontmatter
      const newFrontmatter = this.generateProperties(mergedProperties);

      // Replace existing frontmatter or prepend to file
      const newContent = content.replace(/^---[\s\S]*?---\n/, '') || '';
      const updatedContent = newFrontmatter + newContent;

      // Update file
      await this.client.updateContent(filepath, updatedContent);

      return {
        success: true,
        message: 'Properties updated successfully',
        properties: mergedProperties
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update properties: ${error instanceof Error ? error.message : String(error)}`,
        errors: [String(error)]
      };
    }
  }
}