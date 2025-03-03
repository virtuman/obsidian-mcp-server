/**
 * Tag resource implementation
 */
import { Resource, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { ObsidianClient } from "../obsidian/client.js";
import { JsonLogicQuery } from "../obsidian/types.js";
import { PropertyManager } from "../tools/properties/manager.js";
import { join, sep } from "path";
import { createLogger } from "../utils/logging.js";
import { TagResponse } from "./types.js";

// Create a logger for tag resources
const logger = createLogger('TagResource');

/**
 * Resource for providing tags used in the Obsidian vault
 */
export class TagResource {
  private tagCache: Map<string, Set<string>> = new Map();
  private propertyManager: PropertyManager;
  private isInitialized = false;
  private lastUpdate = 0;
  private updateInterval = 5000; // 5 seconds

  constructor(private client: ObsidianClient) {
    this.propertyManager = new PropertyManager(client);
    this.initializeCache();
  }

  /**
   * Get resource description for the MCP server
   */
  getResourceDescription(): Resource {
    return {
      uri: "obsidian://tags",
      name: "Obsidian Tags",
      description: "List of all tags used across the Obsidian vault with their usage counts",
      mimeType: "application/json"
    };
  }

  /**
   * Initialize the tag cache
   */
  private async initializeCache() {
    try {
      logger.info('Initializing tag cache');
      
      // Get all markdown files using platform-agnostic path pattern
      const query: JsonLogicQuery = {
        "glob": [`**${sep}*.md`.replace(/\\/g, '/'), { "var": "path" }]
      };
      
      const results = await this.client.searchJson(query);
      this.tagCache.clear();

      // Process each file
      for (const result of results) {
        if (!('filename' in result)) continue;
        
        try {
          const content = await this.client.getFileContents(result.filename);
          
          // Only extract tags from frontmatter YAML
          const properties = this.propertyManager.parseProperties(content);
          if (properties.tags) {
            properties.tags.forEach((tag: string) => {
              this.addTag(tag, result.filename);
            });
          }
        } catch (error) {
          logger.error(`Failed to process file ${result.filename}:`, error);
        }
      }

      this.isInitialized = true;
      this.lastUpdate = Date.now();
      logger.info(`Tag cache initialized with ${this.tagCache.size} unique tags`);
    } catch (error) {
      logger.error("Failed to initialize tag cache:", error);
      throw error;
    }
  }

  /**
   * Add a tag to the cache
   */
  private addTag(tag: string, filepath: string) {
    if (!this.tagCache.has(tag)) {
      this.tagCache.set(tag, new Set());
    }
    this.tagCache.get(tag)!.add(filepath);
  }

  /**
   * Update the cache if needed
   */
  private async updateCacheIfNeeded() {
    const now = Date.now();
    if (now - this.lastUpdate > this.updateInterval) {
      logger.debug('Tag cache needs update, refreshing...');
      await this.initializeCache();
    }
  }

  /**
   * Get the content for the resource
   */
  async getContent(): Promise<TextContent[]> {
    try {
      if (!this.isInitialized) {
        logger.info('Tag cache not initialized, initializing now');
        await this.initializeCache();
      } else {
        await this.updateCacheIfNeeded();
      }

      const response: TagResponse = {
        tags: Array.from(this.tagCache.entries())
          .map(([name, files]) => ({
            name,
            count: files.size,
            files: Array.from(files).sort()
          }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
        metadata: {
          totalOccurrences: Array.from(this.tagCache.values())
            .reduce((sum, files) => sum + files.size, 0),
          uniqueTags: this.tagCache.size,
          scannedFiles: new Set(
            Array.from(this.tagCache.values())
              .flatMap(files => Array.from(files))
          ).size,
          lastUpdate: this.lastUpdate
        }
      };

      logger.debug(`Returning tag resource with ${response.tags.length} tags`);
      return [{
        type: "text",
        text: JSON.stringify(response, null, 2),
        uri: this.getResourceDescription().uri
      }];
    } catch (error) {
      logger.error("Failed to get tags:", error);
      throw error;
    }
  }
}