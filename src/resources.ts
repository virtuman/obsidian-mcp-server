import { Resource, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { ObsidianClient } from "./obsidian.js";
import { TagResponse, SearchMatch, SimpleSearchResult, SearchResponse } from "./types.js";

export class TagResource {
  private static readonly TAG_PATTERN = /#[a-zA-Z0-9_-]+/g;

  constructor(private client: ObsidianClient) {}

  getResourceDescription(): Resource {
    return {
      uri: "obsidian://tags",
      name: "Obsidian Tags",
      description: "List of all tags used across the Obsidian vault with their usage counts",
      mimeType: "application/json"
    };
  }

  async getContent(): Promise<TextContent[]> {
    try {
      // Search for files containing #
      const query = {
        "contains": [{ "var": "content" }, "#"]
      };

      const results = await this.client.searchJson(query);

      // Process results to extract tags
      const tagMap = new Map<string, Set<string>>();
      let totalOccurrences = 0;
      let scannedFiles = 0;

      results.forEach((result: SearchResponse) => {
        scannedFiles++;
        if ('matches' in result) {
          result.matches.forEach((match: SearchMatch) => {
            const tags = match.context.match(TagResource.TAG_PATTERN);
            if (tags) {
              tags.forEach((tag: string) => {
                if (!tagMap.has(tag)) {
                  tagMap.set(tag, new Set());
                }
                tagMap.get(tag)!.add(result.filename);
                totalOccurrences++;
              });
            }
          });
        }
      });

      // Convert to sorted response format
      const response: TagResponse = {
        tags: Array.from(tagMap.entries())
          .map(([name, files]) => ({
            name,
            count: files.size,
            files: Array.from(files).sort()
          }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
        metadata: {
          totalOccurrences,
          uniqueTags: tagMap.size,
          scannedFiles
        }
      };

      return [{
        type: "text",
        text: JSON.stringify(response, null, 2)
      }];
    } catch (error) {
      console.error("Failed to fetch tags:", error);
      throw error;
    }
  }
}