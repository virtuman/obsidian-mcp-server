/**
 * Search tools exports
 */
export * from './simple.js';
export * from './complex.js';

import { ObsidianClient } from '../../obsidian/client.js';
import { FindInFileToolHandler } from './simple.js';
import { ComplexSearchToolHandler, GetTagsToolHandler } from './complex.js';

/**
 * Create all search-related tool handlers
 * @param client The ObsidianClient instance
 * @returns Array of search tool handlers
 */
export function createSearchToolHandlers(client: ObsidianClient) {
  return [
    new FindInFileToolHandler(client),
    new ComplexSearchToolHandler(client),
    new GetTagsToolHandler(client)
  ];
}