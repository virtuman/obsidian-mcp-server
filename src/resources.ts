import { Resource, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { ObsidianClient } from "./obsidian.js";
import { TagResponse, ObsidianFile, JsonLogicQuery } from "./types.js";
import { PropertyManager } from "./properties.js";
import { join, sep } from "path";

export class TagResource {
  private static readonly TAG_PATTERN = /#[a-zA-Z0-9_-]+/g;
  private tagCache: Map<string, Set<string>> = new Map();
  private propertyManager: PropertyManager;
  private isInitialized = false;
  private lastUpdate = 0;
  private updateInterval = 5000; // 5 seconds

  constructor(private client: ObsidianClient) {
    this.propertyManager = new PropertyManager(client);
    this.initializeCache();
  }

  getResourceDescription(): Resource {
    return {
      uri: "obsidian://tags",
      name: "Obsidian Tags",
      description: "List of all tags used across the Obsidian vault with their usage counts",
      mimeType: "application/json"
    };
  }

  private async initializeCache() {
    try {
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
          
          // Extract tags from frontmatter
          const properties = this.propertyManager.parseProperties(content);
          if (properties.tags) {
            properties.tags.forEach((tag: string) => {
              this.addTag(tag, result.filename);
            });
          }
          
          // Extract inline tags
          const inlineTags = content.match(TagResource.TAG_PATTERN) || [];
          inlineTags.forEach(tag => {
            this.addTag(tag, result.filename);
          });
        } catch (error) {
          console.error(`Failed to process file ${result.filename}:`, error);
        }
      }

      this.isInitialized = true;
      this.lastUpdate = Date.now();
    } catch (error) {
      console.error("Failed to initialize tag cache:", error);
      throw error;
    }
  }

  private addTag(tag: string, filepath: string) {
    if (!this.tagCache.has(tag)) {
      this.tagCache.set(tag, new Set());
    }
    this.tagCache.get(tag)!.add(filepath);
  }

  private async updateCacheIfNeeded() {
    const now = Date.now();
    if (now - this.lastUpdate > this.updateInterval) {
      await this.initializeCache();
    }
  }

  async getContent(): Promise<TextContent[]> {
    try {
      if (!this.isInitialized) {
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

      return [{
        type: "text",
        text: JSON.stringify(response, null, 2),
        uri: this.getResourceDescription().uri
      }];
    } catch (error) {
      console.error("Failed to get tags:", error);
      throw error;
    }
  }
}