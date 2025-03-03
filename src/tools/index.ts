/**
 * Tools module exports
 */
import { BaseToolHandler } from './base.js';
import { createFileToolHandlers } from './files/index.js';
import { createSearchToolHandlers } from './search/index.js';
import { createPropertyToolHandlers } from './properties/index.js';
import { ObsidianClient } from '../obsidian/client.js';

// Export the base handler and all submodules
export * from './base.js';
export * from './files/index.js';
export * from './search/index.js';
export * from './properties/index.js';

/**
 * Create all tool handlers
 * @param client The ObsidianClient instance
 * @returns Array of all tool handlers
 */
export function createToolHandlers(client: ObsidianClient) {
  return [
    ...createFileToolHandlers(client),
    ...createSearchToolHandlers(client),
    ...createPropertyToolHandlers(client)
  ];
}

/**
 * Get a tool handler map by name
 * @param handlers Array of tool handlers
 * @returns Map of tool names to handlers
 */
export function createToolHandlerMap<T extends BaseToolHandler<any>>(handlers: T[]) {
  const toolHandlerMap = new Map<string, BaseToolHandler>();
  handlers.forEach(handler => toolHandlerMap.set(handler.name, handler));
  return toolHandlerMap;
}